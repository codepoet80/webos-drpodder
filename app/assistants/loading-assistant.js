
function LoadingAssistant() {
	this.appController = Mojo.Controller.getAppController();
	this.stageController = this.appController.getStageController(DrPodder.MainStageName);
}

LoadingAssistant.prototype.setup = function() {
	//this.spinnerModel = {spinning: true};
	//this.controller.setupWidget("loadingSpinner", {spinnerSize: "small"}, this.spinnerModel);
	//this.spinnerModel.spinning = true;
	//this.loadingSpinner = this.controller.get("loadingSpinner");
	this.spinnerScrim = this.controller.get("spinnerScrim");
	this.controller.get("versionDiv").update("v"+Mojo.Controller.appInfo.version);
	this.titleDiv = this.controller.get("titleDiv");
	this.versionDiv = this.controller.get("versionDiv");
	this.loadingDiv = this.controller.get("loadingDiv");
	                                                                           
	if(_device_.thisDevice.isTP){
		this.spinnerScrim.removeClassName("drpodder-large-logo");
        
        var orient = this.controller.stageController.getWindowOrientation();
        if (orient === 'left' || orient === 'right') {
		    this.spinnerScrim.addClassName("drpodder-large-logo-tp-landscape");
		} else {
            this.spinnerScrim.addClassName("drpodder-large-logo-tp-portrait");
		}

		this.titleDiv.removeClassName("titleMessage");
		this.titleDiv.addClassName("titleMessage-tp");
		
		this.versionDiv.removeClassName("versionMessage");
		this.versionDiv.addClassName("versionMessage-tp");
		
		this.loadingDiv.removeClassName("loadingMessage");
		this.loadingDiv.addClassName("loadingMessage-tp");
	}


	//this.controller.enableFullScreenMode(true);
};

LoadingAssistant.prototype.activate = function() {
	if (!DB.ready) {
		DB.waitForDB(this.waitForFeedsReady.bind(this));
	} else {
		this.waitForFeedsReady();
	}
};

LoadingAssistant.prototype.waitForFeedsReady = function() {
	//this.spinnerModel.spinning = false;
	//this.controller.modelChanged(this.spinnerModel);
	this.loadingDiv.update($L({value:"Loading Feed List", key:"loadingFeedList"}));
	this.stageController.swapScene({name: "feedList", transition: Prefs.transition});
};

LoadingAssistant.prototype.considerForNotification = function(params) {
	if (params) {
		switch (params.type) {
			case "updateLoadingMessage":
				this.loadingDiv.update(params.message);
				break;
			case "shutupJSLint":
				break;
		}
	}
};
