
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
};

Player.prototype.pause = function() {
	this.audioObject.pause();
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
