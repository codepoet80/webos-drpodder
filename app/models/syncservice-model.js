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
    this.busy = false;           // a flush+pull is in flight (serializes syncs)
    this.lastSyncAt = 0;         // ms timestamp of the last completed sync (throttle)
}

SyncServiceClass.prototype.DEFAULT_BASE = "http://podcasts.webosarchive.org/sync/";

// Pocket Casts playing-status vocabulary
SyncServiceClass.prototype.UNPLAYED = 0;
SyncServiceClass.prototype.IN_PROGRESS = 2;
SyncServiceClass.prototype.PLAYED = 3;

SyncServiceClass.prototype.base = function() {
    return Prefs.pcSyncURLBase || this.DEFAULT_BASE;
};

// Available on all devices: everything uses tiny feeds and sync matches by
// episode title, so there's no device requirement. The feature is inert until
// the user signs in (no token).
SyncServiceClass.prototype.isEnabled = function() {
    return !!Prefs.pcSyncToken;
};

// Normalize an episode title for matching. Title is the primary sync key because
// tiny-feed enclosure URLs are proxied (mp3.php) and never match Pocket Casts.
// Lowercase, decode common HTML entities, and collapse whitespace.
SyncServiceClass.prototype.normTitle = function(t) {
    t = (t || "").toLowerCase();
    t = t.replace(/&amp;/g, "&").replace(/&quot;/g, '"')
         .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
    return t.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
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

// Number of local changes still waiting to reach Pocket Casts (failed/retrying
// pushes). Non-zero after a sync means the push leg didn't fully land -- callers
// surface this so a silent push failure can't masquerade as "all synced".
SyncServiceClass.prototype.pendingCount = function() {
    return (Prefs.pcSyncQueue || []).length;
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

// Apply pulled playback state to local episodes. Matches by enclosure URL first
// (full feeds share the publisher's URLs with Pocket Casts), then by episode
// title as a fallback. Returns the number of episodes changed.
SyncServiceClass.prototype.applyPull = function(episodes) {
    var byEnclosure = {};
    var byTitle = {};
    episodes.forEach(function(e) {
        if (e.enclosureUrl) { byEnclosure[e.enclosureUrl] = e; }
        if (e.title) { byTitle[this.normTitle(e.title)] = e; }
    }.bind(this));

    // Newer-wins reconciliation. A local change still sitting in the push queue
    // hasn't been confirmed to Pocket Casts yet, so it is by definition newer
    // than whatever state the server last acknowledged -- it must win over this
    // pull rather than be clobbered by it. (We reconcile on "unsynced local
    // change" instead of comparing epoch timestamps because cross-device clocks
    // on retro webOS hardware are unreliable.) Successfully-pushed items have
    // already been dropped from the queue by flush(), so the pull applies to
    // them normally; only genuinely-pending edits are protected.
    var pending = this.pendingKeys();

    var changed = 0, kept = 0;
    this.applyingPull = true;
    try {
        feedModel.items.forEach(function(feed) {
            if (!feed.episodes) { return; }
            feed.episodes.forEach(function(ep) {
                var rec = (ep.enclosure && byEnclosure[ep.enclosure]) ||
                          (ep.title && byTitle[this.normTitle(ep.title)]);
                if (!rec) { return; }
                if (this.isPending(ep, pending)) { kept++; return; }
                if (this.applyRecordToEpisode(ep, rec)) { changed++; }
            }.bind(this));
        }.bind(this));
    } finally {
        this.applyingPull = false;
    }
    if (kept) {
        Mojo.Log.info("SyncService.applyPull kept %d unsynced local change(s)", kept);
    }
    return changed;
};

// Build a lookup of episodes that have an unflushed local change (still queued
// for push), keyed both by enclosure URL and by normalized episode title so a
// pull can recognize the same episode regardless of which key it matched on.
SyncServiceClass.prototype.pendingKeys = function() {
    var byEnclosure = {}, byTitle = {};
    (Prefs.pcSyncQueue || []).forEach(function(r) {
        if (r.enclosureUrl) { byEnclosure[r.enclosureUrl] = true; }
        if (r.episodeTitle) { byTitle[this.normTitle(r.episodeTitle)] = true; }
    }.bind(this));
    return {byEnclosure: byEnclosure, byTitle: byTitle};
};

// True if this local episode has a change queued for push (see pendingKeys).
SyncServiceClass.prototype.isPending = function(ep, pending) {
    return !!((ep.enclosure && pending.byEnclosure[ep.enclosure]) ||
              (ep.title && pending.byTitle[this.normTitle(ep.title)]));
};

SyncServiceClass.prototype.applyRecordToEpisode = function(ep, rec) {
    var changed = false;
    var status = rec.playingStatus;
    var pos = parseInt(rec.playedUpTo, 10) || 0;

    // Seed the episode duration from Pocket Casts when we don't already know it.
    // An episode never played on this device has length 0, so the in-progress
    // (bookmark) bar would compute 0% and stay empty until playback finally loads
    // the media. Knowing the duration up front lets the bar render immediately.
    var dur = parseInt(rec.duration, 10) || 0;
    if (dur > 0 && !ep.length) { ep.length = dur; changed = true; }

    if (status === this.PLAYED) {
        if (!ep.listened) { ep.setListened(false); changed = true; }
    } else {
        if (ep.listened) { ep.setUnlistened(false); changed = true; }
        // reflect in-progress position as a bookmark
        if (pos === 0) {
            if (ep.position) { ep.clearBookmark(false); changed = true; }
        } else {
            if (ep.position !== pos) { ep.bookmark(pos); changed = true; }
            // bookmark() doesn't repaint the list row, and on a re-pull the
            // position can be unchanged while the duration is newly known --
            // recompute the bar width and, if anything changed, repaint in place.
            var pct = ep.length ? (100 * pos / ep.length) : 0;
            if (ep.bookmarkPercent !== pct) { ep.bookmarkPercent = pct; ep.save(false); changed = true; }
            if (changed) { ep.updateUIElements(false); }
        }
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
        title: ep.feedObject.title,       // podcast/feed title -> resolve podcast
        episodeTitle: ep.title,           // episode title -> resolve episode fallback
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
    Mojo.Log.info("SyncService.queued status=%d pos=%d feed=[%s] ep=[%s] enc=[%s]",
                  rec.playingStatus, rec.playedUpTo, rec.title, rec.episodeTitle, rec.enclosureUrl);
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
                if (!r.ok) {
                    failed[r.enclosureUrl] = true;
                    Mojo.Log.warn("SyncService.flush push FAILED [%s]: %s", r.enclosureUrl, r.error);
                } else {
                    Mojo.Log.info("SyncService.flush push ok [%s]", r.enclosureUrl);
                }
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

// Queue this episode's current state and immediately flush (push only).
// Used for near-real-time updates on play/pause/complete. Never pulls, so it
// can't clobber the position of the episode currently playing.
SyncServiceClass.prototype.pushEpisode = function(ep, callback) {
    if (!this.isEnabled()) { if (callback) { callback(false, "not logged in"); } return; }
    this.onEpisodeChanged(ep);
    this.flush(callback);
};

// Full two-way sync: push local changes, then pull remote state. Serialized via
// `busy` so overlapping triggers (rapid navigation, feed refresh) can't stack up
// concurrent flush+pull chains against the service.
SyncServiceClass.prototype.syncNow = function(callback) {
    if (!this.isEnabled()) { if (callback) { callback(false, "not logged in"); } return; }
    if (this.busy) { if (callback) { callback(false, "sync already in progress"); } return; }
    this.busy = true;
    this.flush(function(ok, info) {
        this.pull(function(pok, pinfo) {
            this.busy = false;
            this.lastSyncAt = (new Date()).getTime();
            if (callback) { callback(pok, pinfo); }
        }.bind(this));
    }.bind(this));
};

// Automatic sync for UI triggers (returning to the feed list, a feed just added,
// etc). Bails when disabled or a sync is already running, and throttles routine
// triggers so casual navigation doesn't hammer the service. Pass force=true right
// after a feed is added so the new podcast's playback state comes down at once.
SyncServiceClass.prototype.AUTO_SYNC_MIN_INTERVAL = 90000;   // ms between auto syncs
SyncServiceClass.prototype.autoSync = function(force, callback) {
    if (!this.isEnabled()) { if (callback) { callback(false, "not logged in"); } return; }
    if (this.busy) { if (callback) { callback(false, "busy"); } return; }
    if (!force && this.lastSyncAt &&
        ((new Date()).getTime() - this.lastSyncAt) < this.AUTO_SYNC_MIN_INTERVAL) {
        if (callback) { callback(false, "throttled"); }
        return;
    }
    this.syncNow(callback);
};

var SyncService = new SyncServiceClass();
