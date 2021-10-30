
function WifiService() {
}
WifiService.prototype.URI = "palm://com.palm.wifi/";
WifiService.prototype.connectionmanagerURI = "palm://com.palm.connectionmanager/";

WifiService.prototype._serviceRequest = function(sceneController, uri, params) {
	if (sceneController) {
		return sceneController.serviceRequest(uri, params);
	} else {
		var obj = new Mojo.Service.Request(uri, params);
		return obj;
	}
};

WifiService.prototype.getStatus = function(sceneController, callback) {
	return this._serviceRequest(sceneController, this.URI, {
		method: "getstatus",
		onSuccess: callback,
		onFailure: function() {},
		parameters: {}});
};

WifiService.prototype.setState = function(sceneController, state) {
	return this._serviceRequest(sceneController, this.URI, {
		method: "setstate",
		onSuccess: function() {},
		onFailure: function() {},
		parameters: {"state": state}});
};

WifiService.prototype.isWifiConnected = function(sceneController, callback) {
	return this._serviceRequest(sceneController, this.connectionmanagerURI, {
		method: "getstatus",
		onSuccess: function(result) {
			var state = false;
			if (result.returnValue && result.wifi && result.wifi.state === "connected") {
				state = true;
			}
			callback(state);
		},
		onFailure: function() {
			callback(false);
		},
		parameters: {}});
};
