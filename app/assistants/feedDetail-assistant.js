function FeedDetailAssistant() {
    /* this is the creator function for your scene assistant object. It will be passed all the 
       additional parameters (after the scene name) that were passed to pushScene. The reference
       to the scene controller (this.controller) has not be established yet, so any initialization
       that needs the scene controller should be done in the setup function below. */
}

FeedDetailAssistant.prototype.setup = function() {

    /* setup widgets here */

    //Menu
    this.appMenuAttributes = { omitDefaultItems: true };
    this.appMenuModel = {
        label: "Settings",
        items: [{
            label: $L('Select All'),
            command: Mojo.Menu.selectAllCmd,
            shortcut: 'a',
            disabled: false
        }, {
            label: $L('Copy'),
            command: Mojo.Menu.copyCmd,
            shortcut: 'c',
            disabled: false
        }]
    };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttributes, this.appMenuModel);

    //Command Buttons
    this.cmdMenuModel = {
        visible: false,
    };

    this.controller.setupWidget(Mojo.Menu.commandMenu, {
        menuClass: 'no-fade'
    }, this.cmdMenuModel);

    /* add event handlers to listen to events from widgets */
    this.backElement = this.controller.get('icon');
    this.backTapHandler = this.backTap.bindAsEventListener(this);
    this.controller.listen(this.backElement, Mojo.Event.tap, this.backTapHandler);
};

FeedDetailAssistant.prototype.activate = function() {

    if (DrPodder.PodcastDetails) {
        //Bind selected podcast to scene elements
        this.controller.get('divPodcastTitle').innerHTML = DrPodder.PodcastDetails.title;
        this.controller.get('divPodcastImage').src = this.buildURL("image") + "?" + this.base64UrlEncode(DrPodder.PodcastDetails.image);
        this.controller.get('divPodcastDescription').innerHTML = DrPodder.PodcastDetails.description;
        this.controller.get('divPodcastAuthor').innerHTML = DrPodder.PodcastDetails.author;
        this.controller.get('divPodcastLink').innerHTML = "<a href=\"" + DrPodder.PodcastDetails.link + "\">" + DrPodder.PodcastDetails.link + "</a>"
    }
    /* put in event handlers here that should only be in effect when this scene is active. For
       example, key handlers that are observing the document */
    
    DrPodder.CurrentShareURL = "http://podcasts.webosarchive.com/detail.php?id=" + encodeURIComponent(DrPodder.PodcastDetails.id);
    Mojo.Controller.getAppController().showBanner({ messageText: 'Touch2Share Ready!' }, { source: 'notification' });
};


//Handle menu and button bar commands
FeedDetailAssistant.prototype.handleCommand = function(event) {
    Mojo.Log.info("handling command button press for command: " + event.command);
};

FeedDetailAssistant.prototype.backTap = function(event) {
	this.controller.stageController.popScene();
};

FeedDetailAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any other cleanup that should happen before
       this scene is popped or another scene is pushed on top */

    DrPodder.CurrentShareURL = null;
};

FeedDetailAssistant.prototype.cleanup = function(event) {
    /* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */

};
 
FeedDetailAssistant.prototype.buildURL = function(actionType) {
    var urlBase = directoryURLBase;

    //Make sure we don't end up with double slashes in the built URL if there's a custom endpoint
    var urlTest = urlBase.split("://");
    if (urlTest[urlTest.length - 1].indexOf("/") != -1) {
        urlBase = urlBase.substring(0, urlBase.length - 1);
    }
    var path = urlBase + "/" + actionType + ".php";
    return path;
}

FeedDetailAssistant.prototype.base64UrlEncode = function(url) {
    // First of all you should encode to Base64 string
    url = btoa(url);
    // Convert Base64 to Base64URL by replacing “+” with “-” and “/” with “_”
    url = url.replace(/\+/g, '-');
    url = url.replace(/\//g, "_");
    return url;
}
