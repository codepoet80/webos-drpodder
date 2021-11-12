
function AddLocalAssistant(feed) {
    this.feed = feed;

    if (this.feed !== null) {
        this.newFeed = false;
        this.originalUrl = feed.url;
        this.title = this.feed.title;
        this.titleFilterExp = this.feed.titleFilterExp;  
        this.pathFilterExp = this.feed.pathFilterExp;  
        this.filterMode = this.feed.filterMode;
        this.albumArt = this.feed.albumArt;
        this.autoDelete = this.feed.autoDelete;
        this.includeOwnFiles = this.feed.hideFromOS;
        this.maxEpisodes = this.feed.maxEpisodes;
    } else {
        this.newFeed = true;
        this.title = null;
        this.titleFilterExp = null;
        this.pathFilterExp = null;  
        this.filterMode = true;
        this.albumArt = null;
        this.albumArt = "images/localmedia-icon.png";
        this.autoDelete = true;
        this.includeOwnFiles = false;
        this.maxEpisodes = 5; // default sortmode 5 = detecting numbers
    }
}

AddLocalAssistant.prototype.menuAttr = {omitDefaultItems: true};

AddLocalAssistant.prototype.setup = function() {
    this.menuModel = {
        visible: true,
        items: [
            Mojo.Menu.editItem,
            {label: $L("Help"), command: "help-cmd"}
        ]
    };
    this.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);

    // Add back button functionality for the TouchPad
    this.backElement = this.controller.get('icon');
    this.backTapHandler = this.backTap.bindAsEventListener(this);
    this.controller.listen(this.backElement, Mojo.Event.tap, this.backTapHandler);
 
	this.controller.setupWidget(Mojo.Menu.commandMenu, this.handleCommand, this.cmdMenuModel);

    this.controller.setupWidget("feedNameField", {
            hintText : $L({value:"Title", key:"titleOptional"}),
            focus : true,
            limitResize : true,
            autoReplace : false,
            textCase : Mojo.Widget.steModeTitleCase,
            enterSubmits : false
        },
        this.nameModel = { value : this.title });

    this.controller.setupWidget("titleFilterField", {
            // hintText : $L({value:"title filter hint", key:"titleFilterExp"}),
            limitResize : true,
            autoReplace : false,
            textCase : Mojo.Widget.steModeLowerCase,
            enterSubmits : false
        },
        this.titleFilterExpModel = { value : this.titleFilterExp });

    this.controller.setupWidget("andOrList",
        {label: "filter mode",
		 // labelPlacement: Mojo.Widget.labelPlacementLeft,
         choices: [
            {label: "title OR path",  value: 'or'},
            {label: "title AND path", value: 'and'}, 
            {label: "title only",     value: 'title'}, 
            {label: "path only",      value: 'path'}, 
            {label: "no filter",      value: 'none'} 
         ]},
        this.filterModeModel = { value : this.filterMode });

    this.andOrList = this.controller.get('andOrList');
    this.andOrListChanged();
    this.andOrListHandler = this.andOrListChanged.bindAsEventListener(this);

    this.controller.setupWidget("pathFilterField", {
            // hintText : $L({value:"path filter hint", key:"pathFilterExp"}),
            limitResize : true,
            autoReplace : false,
            textCase : Mojo.Widget.steModeLowerCase,
            enterSubmits : false
        },
        this.pathFilterExpModel = { value : this.pathFilterExp });

    this.controller.setupWidget("albumArt", {
            hintText : $L({value:"Album Art (space clears)", key:"albumArtSpaceClears"}),
            limitResize : true,
            autoReplace : false,
            textCase : Mojo.Widget.steModeLowerCase,
            enterSubmits : false
        },
        this.albumArtModel = { value : this.albumArt });

    this.controller.setupWidget("sortingList",
        {label: "Sorting",
		 //labelPlacement: Mojo.Widget.labelPlacementLeft,
         choices: [
            {label: "publication date, newest first", value: 0}, 
            {label: "publication date, oldest first", value: 1}, 
            {label: "title ", value: 2},
            {label: "title descending", value: 3},
            {label: "path", value: 6},
            {label: "path descending", value: 4},
            {label: "detected numbers", value: 5},
            {label: "(manual)", value: -1} 
         ]
        },
        this.sortingListModel = { value : this.maxEpisodes });

    this.controller.setupWidget("includeOwnFilesToggle",
        {},
        this.includeOwnFilesModel = { value : this.includeOwnFiles });

    this.localize.bind(this).defer();
};


AddLocalAssistant.prototype.activate = function() {
    Mojo.Event.listen(this.andOrList, Mojo.Event.propertyChange, this.andOrListHandler);
};

AddLocalAssistant.prototype.backTap = function(event)
{
    var event = Mojo.Event.make(Mojo.Event.back);
    this.handleCommand(event);
};

AddLocalAssistant.prototype.deactivate = function() {
    Mojo.Event.stopListening(this.andOrList, Mojo.Event.propertyChange, this.andOrListHandler);
};

AddLocalAssistant.prototype.localize = function() {
    if (this.newFeed) {
        Util.localize(this, "dialogTitle", "Add local media feed", "addLocalFeed");
    } else {
        Util.localize(this, "dialogTitle", "Edit local media feed", "editLocalFeed");
    }
    Util.localize(this, "titleFilterLabel", "Title filter");
    Util.localize(this, "pathFilterLabel", "Path filter");
    Util.localize(this, "titleLabel", "Title");
    Util.localize(this, "iconLabel", "Icon");
    Util.localize(this, "feedOptions", "Options", "feedOptions");
    Util.localize(this, "includeDrPodderFiles", "include drPodder's own podcast files", "includeDrPodderFiles");
};


AddLocalAssistant.prototype.updateFields = function() {
    if (this.nameModel.value) {this.feed.title = this.nameModel.value;}

    if (this.titleFilterExpModel.value)  {
        this.feed.titleFilterExp = this.titleFilterExpModel.value;
    } else { 
        this.feed.titleFilterExp = ""; 
    }
    if (this.pathFilterExpModel.value)  {
        this.feed.pathFilterExp = this.pathFilterExpModel.value;
    } else { 
        this.feed.pathFilterExp = ""; 
    }

    if (this.filterModeModel.value != this.feed.filterMode) {
        this.feed.filterMode = this.filterModeModel.value;
    }

    if (this.albumArtModel.value) {this.feed.albumArt = this.albumArtModel.value;}
    this.feed.autoDelete = false; 
    this.feed.hideFromOS = this.includeOwnFilesModel.value;
    if (this.sortingListModel != this.feed.maxEpisodes) {
        this.feed.maxEpisodes  = this.sortingListModel.value;
        this.feed.sortEpisodesAndPlaylists();
    }
};


AddLocalAssistant.prototype.checkFeed = function() {
    // If the filter is the same, then assume that it's just a title change,
    // update the feed title and close the dialog. Otherwise update the feed.
    if (!this.newFeed && this.feed !== null
        && this.feed.titleFilterExp === this.titleFilterExpModel.value 
        && this.feed.pathFilterExp  === this.pathFilterExpModel.value 
        && this.feed.filterMode     === this.filterModeModel.value 
    ) { // filter not changed
        Mojo.Log.error("feed filterexp not changed: %s", this.titleFilterExpModel.value);
        this.updateFields();
        DB.saveFeed(this.feed);
        this.controller.stageController.popScene({feedChanged: true, feedIndex: feedModel.items.indexOf(this.feed)});
    } else {
        Mojo.Log.error("feed filterexp changed: %s", this.titleFilterExpModel.value);
        if (this.titleFilterExpModel.value != null) {
            //  If a new feed, push the entered feed data on to the feedlist and
            //  call processFeed to evaluate it.
            if (this.newFeed) {
                Mojo.Log.error("new local media feed. filterexp: %s", this.titleFilterExpModel.value);
                this.feed = new Feed();
                this.feed.interval = 60000;
            }
            this.feed.isLocalMedia = true;
            this.updateFields();
            Mojo.Log.error("saving filterexp: %s", this.feed.pathFilterExp);

            var results = {};
            if (this.newFeed) {
                feedModel.items.push(this.feed);
                results.feedAdded = true;
            } else {
                results.feedChanged = true;
                results.feedIndex = feedModel.items.indexOf(this.feed);
                DB.saveFeed(this.feed);
            }
            this.feed.update(); 
            this.controller.stageController.popScene(results);
        } else {
            //If the new feed is empty, this is a cancel
            this.controller.stageController.popScene();
        }
    }
};

AddLocalAssistant.prototype.fail = function(message, log, reveal) {
    if (message) {
        Util.banner(message);
    }
    if (log) {
        Mojo.Log.error(log);
    }

    if (!reveal) {
        reveal = "titleFilterField";
    }

    this.controller.getSceneScroller().mojo.revealTop(true);
    this.controller.get(reveal).mojo.focus();
};


AddLocalAssistant.prototype.andOrListChanged = function(event) {
    // Utilities.dump(event);
    var value ;
    if( event ) { 
        value = event.value; 
    } else { 
        value = this.filterModeModel.value;
    } 

    if (value == 'or') {
        this.controller.get('titleFilterGroup').show();
        this.controller.get('pathFilterGroup').show();
    }
    if (value == 'and') {
        this.controller.get('titleFilterGroup').show();
        this.controller.get('pathFilterGroup').show();
    }
    if (value == 'title') {
        this.controller.get('titleFilterGroup').show();
        this.controller.get('pathFilterGroup').hide();
    }
    if (value == 'path') {
        this.controller.get('titleFilterGroup').hide();
        this.controller.get('pathFilterGroup').show();
    }
    if (value == 'none') {
        this.controller.get('titleFilterGroup').hide();
        this.controller.get('pathFilterGroup').hide();
    }
};


AddLocalAssistant.prototype.handleCommand = function(event) {
    if (event.type === Mojo.Event.command) {
        switch (event.command) {
            case "cancel-cmd":
                if (!this.newFeed) {
                    this.feed.url = this.originalUrl;
                }
                this.controller.stageController.popScene();
                break;
			case "save-cmd":
                this.checkFeed();
				break;
        }
    } else if (event.type === Mojo.Event.back) {
        event.stop();
        event.stopPropagation();
        this.checkFeed();
    }
};

