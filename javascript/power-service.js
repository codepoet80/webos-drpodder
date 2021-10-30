
function PowerService() {
}
PowerService.prototype.URI = "palm://com.palm.power/";

PowerService.prototype._serviceRequest = function(sceneController, uri, params) {
	if (sceneController) {
		return sceneController.serviceRequest(uri, params);
	} else {
		var obj = new Mojo.Service.Request(uri, params);
		return obj;
	}
};

PowerService.prototype.activityStart = function(sceneController, id, duration) {
	if (duration === undefined) {duration=900000;}
	return this._serviceRequest(sceneController, this.URI + "com/palm/power", {
		method: "activityStart",
		onSuccess: function() {},
		onFailure: function() {},
		parameters: {"id": Mojo.Controller.appInfo.id+"."+id, "duration_ms": duration}});
};

PowerService.prototype.activityEnd = function(sceneController, id) {
	return this._serviceRequest(sceneController, this.URI + "com/palm/power", {
		method: "activityEnd",
		onSuccess: function() {},
		onFailure: function() {},
		parameters: {"id": Mojo.Controller.appInfo.id+"."+id}});
};
