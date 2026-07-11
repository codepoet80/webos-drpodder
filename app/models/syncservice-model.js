/* Pocket Casts playback sync (OPTIONAL).
 *
 * Talks to the Python sync service (see Pocket-Casts/sync-service). Only active
 * when the user has logged in to Pocket Casts in Preferences. Catalog/search and
 * all offline behaviour are unchanged when disabled.
 *
 * State lives in Prefs (persisted via the existing Prefs cookie):
 *   Prefs.pcSyncURLBase  - service base, e.g. "http://podcasts.webosarchive.org/sync/"
 *   Prefs.pcSyncEmail    - remembered for display only
 *   Prefs.pcSyncToken    - the session/bearer token (null when logged out)
 *   Prefs.pcSyncQueue    - array of pending push records
 *
 * Join keys are URLs, never Pocket Casts UUIDs:
 *   feed.url        <-> service feedUrl
 *   episode.enclosure <-> service enclosureUrl
 */

function SyncServiceClass() {
    this.applyingPull = false;   // guard so applying a pull doesn't re-queue pushes
    this.busy = false;
}

SyncServiceClass.prototype.DEFAULT_BASE = "http://podcasts.webosarchive.org/sync/";

// Pocket Casts playing-status vocabulary
SyncServiceClass.prototype.UNPLAYED = 0;
SyncServiceClass.prototype.IN_PROGRESS = 2;
SyncServiceClass.prototype.PLAYED = 3;

SyncServiceClass.prototype.base = function() {
    return Prefs.pcSyncURLBase || this.DEFAULT_BASE;
};

SyncServiceClass.prototype.isEnabled = function() {
    return !!Prefs.pcSyncToken;
};

// ---- auth ----------------------------------------------------------------

SyncServiceClass.prototype.login = function(email, password, callback) {
    var url = this.base() + "login";   // base ends in "/"
    Mojo.Log.info("SyncService.login(%s)", email);
    new Ajax.Request(url, {
        method: "post",
        contentType: "application/json",
        postBody: Object.toJSON({email: email, password: password}),
        evalJSON: "false",
        onSuccess: function(transport) {
            var resp;
            try { resp = JSON.parse(transport.responseText); }
            catch (e) { resp = {status: "error", msg: "bad response"}; }
            if (resp.status === "ok" && resp.token) {
                Prefs.pcSyncToken = resp.token;
                Prefs.pcSyncEmail = email;
                if (!Prefs.pcSyncURLBase) { Prefs.pcSyncURLBase = this.base(); }
                if (!Prefs.pcSyncQueue) { Prefs.pcSyncQueue = []; }
                DB.writePrefs();
                Mojo.Log.info("SyncService.login OK");
                if (callback) { callback(true, null); }
            } else {
                Mojo.Log.error("SyncService.login failed: %s", resp.msg);
                if (callback) { callback(false, resp.msg || "login failed"); }
            }
        }.bind(this),
        onFailure: function(transport) {
            Mojo.Log.error("SyncService.login transport error: %d", transport.status);
            if (callback) { callback(false, "could not contact sync service (" + transport.status + ")"); }
        }
    });
};

SyncServiceClass.prototype.logout = function() {
    Prefs.pcSyncToken = null;
    Prefs.pcSyncQueue = [];
    DB.writePrefs();
    Mojo.Log.info("SyncService.logout");
};

// ---- pull (service -> device) --------------------------------------------

SyncServiceClass.prototype.pull = function(callback) {
    if (!this.isEnabled()) { if (callback) { callback(false, "not logged in"); } return; }
    var url = this.base() + "pull?token=" + encodeURIComponent(Prefs.pcSyncToken);
    Mojo.Log.info("SyncService.pull");
    new Ajax.Request(url, {
        method: "get",
        evalJSON: "false",
        onSuccess: function(transport) {
            var resp;
            try { resp = JSON.parse(transport.responseText); }
            catch (e) { if (callback) { callback(false, "bad response"); } return; }
            if (resp.status !== "ok") {
                if (resp.msg && /token/i.test(resp.msg)) { this.logout(); }
                if (callback) { callback(false, resp.msg || "pull failed"); }
                return;
            }
            var n = this.applyPull(resp.episodes || []);
            Mojo.Log.info("SyncService.pull applied %d updates", n);
            if (callback) { callback(true, n); }
        }.bind(this),
        onFailure: function(transport) {
            if (transport.status === 401) { this.logout(); }
            if (callback) { callback(false, "sync service error (" + transport.status + ")"); }
        }.bind(this)
    });
};

// Apply pulled playback state to local episodes, matched by enclosure URL.
// Returns the number of episodes changed.
SyncServiceClass.prototype.applyPull = function(episodes) {
    // index remote records by enclosure URL for O(1) lookup
    var byEnclosure = {};
    episodes.forEach(function(e) { if (e.enclosureUrl) { byEnclosure[e.enclosureUrl] = e; } });

    var changed = 0;
    this.applyingPull = true;
    try {
        feedModel.items.forEach(function(feed) {
            if (!feed.episodes) { return; }
            feed.episodes.forEach(function(ep) {
                var rec = ep.enclosure && byEnclosure[ep.enclosure];
                if (!rec) { return; }
                if (this.applyRecordToEpisode(ep, rec)) { changed++; }
            }.bind(this));
        }.bind(this));
    } finally {
        this.applyingPull = false;
    }
    return changed;
};

SyncServiceClass.prototype.applyRecordToEpisode = function(ep, rec) {
    var changed = false;
    var status = rec.playingStatus;
    var pos = parseInt(rec.playedUpTo, 10) || 0;

    if (status === this.PLAYED) {
        if (!ep.listened) { ep.setListened(false); changed = true; }
    } else {
        if (ep.listened) { ep.setUnlistened(false); changed = true; }
        // reflect in-progress position as a bookmark
        if (pos > 0 && ep.position !== pos) { ep.bookmark(pos); changed = true; }
        else if (pos === 0 && ep.position) { ep.clearBookmark(false); changed = true; }
    }
    return changed;
};

// ---- push (device -> service) --------------------------------------------

// Called from episode.js when playback state changes locally.
SyncServiceClass.prototype.onEpisodeChanged = function(ep) {
    if (!this.isEnabled() || this.applyingPull) { return; }
    if (!ep || !ep.enclosure || !ep.feedObject || !ep.feedObject.url) { return; }
    var status = this.UNPLAYED;
    if (ep.listened) { status = this.PLAYED; }
    else if (ep.position > 0) { status = this.IN_PROGRESS; }

    var rec = {
        feedUrl: ep.feedObject.url,
        enclosureUrl: ep.enclosure,
        title: ep.feedObject.title,
        playingStatus: status,
        playedUpTo: ep.position || 0
    };
    if (!Prefs.pcSyncQueue) { Prefs.pcSyncQueue = []; }
    // de-dupe by enclosure: last write wins
    Prefs.pcSyncQueue = Prefs.pcSyncQueue.filter(function(r) {
        return r.enclosureUrl !== rec.enclosureUrl;
    });
    Prefs.pcSyncQueue.push(rec);
    DB.writePrefs();
};

SyncServiceClass.prototype.flush = function(callback) {
    if (!this.isEnabled()) { if (callback) { callback(false, "not logged in"); } return; }
    var queue = Prefs.pcSyncQueue || [];
    if (queue.length === 0) { if (callback) { callback(true, 0); } return; }

    var url = this.base() + "push?token=" + encodeURIComponent(Prefs.pcSyncToken);
    Mojo.Log.info("SyncService.flush %d records", queue.length);
    new Ajax.Request(url, {
        method: "post",
        contentType: "application/json",
        postBody: Object.toJSON({episodes: queue}),
        evalJSON: "false",
        onSuccess: function(transport) {
            var resp;
            try { resp = JSON.parse(transport.responseText); }
            catch (e) { if (callback) { callback(false, "bad response"); } return; }
            if (resp.status !== "ok") { if (callback) { callback(false, resp.msg); } return; }
            // Drop items that succeeded; keep failures for retry.
            var failed = {};
            (resp.results || []).forEach(function(r) {
                if (!r.ok) { failed[r.enclosureUrl] = true; }
            });
            Prefs.pcSyncQueue = queue.filter(function(r) { return failed[r.enclosureUrl]; });
            DB.writePrefs();
            Mojo.Log.info("SyncService.flush done, %d remaining", Prefs.pcSyncQueue.length);
            if (callback) { callback(true, queue.length - Prefs.pcSyncQueue.length); }
        }.bind(this),
        onFailure: function(transport) {
            if (transport.status === 401) { this.logout(); }
            if (callback) { callback(false, "sync service error (" + transport.status + ")"); }
        }.bind(this)
    });
};

// Full two-way sync: push local changes, then pull remote state.
SyncServiceClass.prototype.syncNow = function(callback) {
    if (!this.isEnabled()) { if (callback) { callback(false, "not logged in"); } return; }
    this.flush(function(ok, info) {
        this.pull(function(pok, pinfo) {
            if (callback) { callback(pok, pinfo); }
        });
    }.bind(this));
};

var SyncService = new SyncServiceClass();
