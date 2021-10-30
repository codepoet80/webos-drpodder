
function MediaEventsService() {
}

MediaEventsService.prototype.URI = "palm://com.palm.mediaevents/";
MediaEventsService.prototype.MEDIA_KEYS_URI = "palm://com.palm.keys/media";
MediaEventsService.prototype.HEADSET_KEYS_URI = "palm://com.palm.keys/headset";

MediaEventsService.prototype._serviceRequest = function(sceneController, uri, params) {
	if (sceneController) {
		return sceneController.serviceRequest(uri, params);
	} else {
		var obj = new Mojo.Service.Request(uri, params);
		return obj;
	}
};

MediaEventsService.prototype.registerForMediaEvents = function(sceneController, callback) {
	var req = this._serviceRequest(sceneController, this.MEDIA_KEYS_URI, {
		method: "status",
		onSuccess: callback,
		parameters: {"subscribe": true}});

	req = this._serviceRequest(sceneController, this.HEADSET_KEYS_URI, {
		method: "status",
		onSuccess: callback,
		parameters: {"subscribe": true}});

	return this._serviceRequest(sceneController, this.URI, {
		method: "mediaEvents",
		onSuccess: callback,
		parameters: {"appName": Mojo.appName, "subscribe": true}});
};

MediaEventsService.prototype.markAppForeground = function(sceneController, callback) {
	return this._serviceRequest(sceneController, "palm://com.palm.audio/media", {
		method: "lockVolumeKeys",
		onSuccess: callback,
		parameters: {"foregroundApp": true, "subscribe": true}});
};
