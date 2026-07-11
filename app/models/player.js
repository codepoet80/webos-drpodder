
function Player(audioObject, episode) {
	this.audioObject = audioObject;
	this.episode = episode;
	this.appController = Mojo.Controller.appController;
	this.stageName = "dashboardPlayer";
}

Player.prototype.getProgress = function() {
	var progress = {current: 0, remain: 0, duration: 0, currentPer: 0, progressStart: 0, progressEnd: 1};
	if (!isNaN(this.audioObject.currentTime) &&
		isFinite(this.audioObject.duration) && !isNaN(this.audioObject.duration) && this.audioObject.duration !== 0) {
		progress.current = this.audioObject.currentTime;
		progress.duration = this.audioObject.duration;
		progress.remain = progress.duration - progress.current;
		progress.currentPer = progress.current / progress.duration;
		if (!this.episode.downloaded) {
			var buffered = this.audioObject.buffered;
			if (buffered !== undefined && buffered !== null) {
				// webOS 1.4 broke this
				//this.progressModel.progressStart = buffered.start(0)/this.audioObject.duration;
				//Mojo.Log.info("buffered.start(0)=%d", buffered.start(0));
				progress.progressStart = this.audioObject.currentTime/this.audioObject.duration;
				progress.progressEnd = buffered.end(0)/this.audioObject.duration;
			}
		}
	}
	return progress;
};

Player.prototype.getStatus = function() {
	var status = {playing: true};
	if (this.audioObject && this.audioObject.paused) {
		status.playing = false;
	}
	return status;
};

Player.prototype.play = function() {
	this.audioObject.play();
	this.syncPlayback();
};

Player.prototype.pause = function() {
	this.audioObject.pause();
	// Persist the current position so the pushed state is accurate even when the
	// episodeDetails scene (which normally bookmarks on pause) isn't active, e.g.
	// when pausing from the dashboard.
	if (this.episode && !isNaN(this.audioObject.currentTime)) {
		this.episode.bookmark(Math.floor(this.audioObject.currentTime));
	}
	this.syncPlayback();
};

// Push the current episode's playback state to Pocket Casts (if signed in).
// Push-only and de-duped, so calling it alongside the episodeDetails media-event
// hooks is harmless. No-op unless the user has signed in.
Player.prototype.syncPlayback = function() {
	if (typeof SyncService !== "undefined" && SyncService.isEnabled() && this.episode) {
		try { SyncService.pushEpisode(this.episode); }
		catch (e) { Mojo.Log.error("Player.syncPlayback error: %j", e); }
	}
};

Player.prototype.skip = function(secs) {
	var wasPlaying = !this.audioObject.paused;
	this.audioObject.currentTime += secs;
	if (wasPlaying) {this.audioObject.play();}
};

Player.prototype.showDashboard = function(mainStageController) {
	if (!Prefs.playbackDashboard) { return; }
	var cont = this.appController.getStageProxy(this.stageName);
	if (cont) {
		// already have a dashboard, just update items
		cont.delegateToSceneAssistant("updatePlayer", this);
	} else {
		// no dashboard, make one
		var callback = function(stageController) {
			stageController.pushScene('dashboardPlayer', this, mainStageController);
		}.bind(this);

		var params = {
			name: this.stageName,
			clickableWhenLocked: true,
			lightweight: true
		};

		this.appController.createStageWithCallback(params, callback, "dashboard");
	}

};

Player.prototype.hideDashboard = function() {
	if (!Prefs.playbackDashboard) { return; }
	var cont = this.appController.getStageProxy(this.stageName);
	if (cont) {cont.window.close();}
};
