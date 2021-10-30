
function DownloadService() {
}
DownloadService.prototype.URI = "palm://com.palm.downloadmanager/";

DownloadService.prototype._serviceRequest = function(sceneController, uri, params) {
	if (sceneController) {
		return sceneController.serviceRequest(uri, params);
	} else {
		var obj = new Mojo.Service.Request(uri, params);
		return obj;
	}
};

	// the download manager currently has a bug where if you cancel a download
	// with another download in the queue, it will then start the next download
	// but the amountTotal will never be set to the filesize
	// bug seems to be resolved now?

	// possible solutions:
	//  hold the download call until there are no downloads pending, thus never calling
	//   callback until we are ready?
	//  in downloadStatus, capture the 0 amountTotal error and restart the download? (ugh)
DownloadService.prototype.download = function(sceneController, target, dir, filename, callback, subscribe) {
	//if (force) { // has palm fixed the downloadmanager bug yet?
	Mojo.Log.info("downloading:", target);
	if (subscribe === undefined) { subscribe = true;}
	return this._serviceRequest(sceneController, this.URI, {
		method: "download",
		onSuccess: callback,
		onFailure: callback,
//          onCreate:   function(){ Mojo.Log.info("*** onCreate ds request")},
//          onLoading:  function(){ Mojo.Log.info("*** onLoading ds request")},
//          onLoaded:   function(){ Mojo.Log.info("*** onLoaded ds request")},
//          on301:      function(){ Mojo.Log.info("*** on301 ds")},
//          on302:      function(){ Mojo.Log.info("*** on302 ds")},
//          on401:      function(){ Mojo.Log.info("*** on401 ds")},
//          on404:      function(){ Mojo.Log.info("*** on404 ds")},
//          on500:      function(){ Mojo.Log.info("*** on500 ds")},
//          onComplete: function(event,unk,unk3){ },
		parameters: {"target": target,
					"targetDir": "/media/internal/drPodder/" + dir,
					"targetFilename": filename,
					"subscribe": subscribe}});
	//} else {
	//return this.downloadWhenEmpty(sceneController, target, callback);
	//}
};

DownloadService.prototype.allow1x = function(sceneController, callback) {
	return this._serviceRequest(sceneController, this.URI, {
		method: "allow1x",
		onSuccess: function() {Mojo.Log.info("allow1x Success"); callback();},
		onFailure: function() {Mojo.Log.error("allow1x Failure"); callback();},
		parameters: {"value": true}
	});
};


	// what we need to do:
	// intercept the callback from a download.
	//  if its complete, check a queue and download the next one if available
	// also, when adding a new download, we should immediately notify the gui so it can "start" it

DownloadService.prototype.downloadWhenEmpty = function(sceneController, target, callback) {
	return sceneController.serviceRequest(this.URI, {
		method: "listPending",
		onSuccess: function(event) {
			callback({returnValue: true});
			if (event.count === 0) {
				this.download(sceneController, target, callback, true);
			} else {
				Mojo.Log.warn("Waiting for pending to empty before downloading:", target, "count:", event.count);
				this.controller.window.setTimeout(this.downloadWhenEmpty.bind(this, sceneController, target, callback), 2000);
			}
		}.bind(this),
		parameters: {}});
};

DownloadService.prototype.downloadStatus = function(sceneController, ticket, callback) {
	return this._serviceRequest(sceneController, this.URI, {
		method: "downloadStatusQuery",
		onSuccess: callback,
		onFailure: callback,
		parameters: {ticket: ticket, subscribe: true}});
};

DownloadService.prototype.resumeDownload = function(sceneController, ticket, callback) {
	return this._serviceRequest(sceneController, this.URI, {
		method: "resumeDownload",
		onSuccess: callback,
		onFailure: callback,
		parameters: {ticket: ticket, subscribe: true}});
};

DownloadService.prototype.cancelDownload = function(sceneController, ticket, callback) {
	return this._serviceRequest(sceneController, this.URI, {
		method: "cancelDownload",
		onSuccess: callback,
		onFailure: callback,
		parameters: {ticket: ticket}});
};

DownloadService.prototype.deleteFile = function(sceneController, ticket, callback){
    return this._serviceRequest(sceneController, this.URI, {
        method: 'deleteDownloadedFile',
        onSuccess: callback,
        onFailure: callback,
        parameters: {ticket: ticket}
    });
};
