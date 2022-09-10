var updaterModel = null;
function FeedListAssistant() {
    this.appController = Mojo.Controller.getAppController();
    this.stageController = this.appController.getStageController(DrPodder.MainStageName);
}

FeedListAssistant.prototype.appMenuAttr = {omitDefaultItems: true};
FeedListAssistant.prototype.appMenuModel = {
    visible: true,
    items: [
        // Mojo.Menu.editItem,
        {label: $L({value:"About", key:"About"}), command: "about-cmd"},
        {label:  $L({value:"Import/Export", key:"exportimportDrpodder"}),
         items: [{label: $L({value:"Import from Clipboard",    key:"importClipDrpodder"}), command: "import-clipboard-cmd"},
                 {label: $L({value:"Import from drpodder.xml", key:"importDrpodder"}), command: "import-cmd"},
                 {label: $L({value:"Export to Clipboard",      key:"exportClipDrpodder"}), command: "export-clipboard-cmd"},
                 {label: $L({value:"Export via Email",         key:"exportDrpodder"}), command: "export-cmd"}]
        },
        {label: $L("Preferences"), command: "prefs-cmd"},
        {label: $L({value:"Report a Problem", key:"reportProblem"}), command: "report-cmd"},
        //{label: $L("Help"), command: "help-cmd"}
    ]
};

FeedListAssistant.prototype.addMenuModel = {
    items: [{label: $L({value:"Add Feed URL", key:"enterFeedURL"}), command: "add-feed"},
            {label: $L({value:"Search Directory", key:"searchDirectory"}), iconPath: "images/directory-menu.png", command: "feed-search"},
            {label: $L({value:"Add Default Feeds", key:"addDefaultFeeds"}), command: "addDefault-cmd"},
            {label: $L({value:"Add Local Media", key:"addLocalMedia"}), command: "add-local"},
            {label: $L({value:"Dynamic Playlist", key:"dynamicPlaylist"}), command: "add-playlist"},
            ]
};


FeedListAssistant.prototype.viewMenuModel = {
    visible: true,
    items: []
};


FeedListAssistant.prototype.setup = function() {
    updaterModel = new UpdaterModel();

    this.cmdMenuModel = {items:[
        { items: [] },
        { items: [] }
    ]};

    this.cmdMenuModel.items[0].items.push( {icon: "new", submenu: "add-menu"});
    if(!_device_.thisDevice.hasKeyboard) { 
        // without keyboard add a search button to open virtual keyboard  
        this.cmdMenuModel.items[1].items.push({icon: "search", command: "filterField-cmd"});
    }
    this.cmdMenuModel.items[1].items.push( {icon: "refresh", command: "refresh-cmd", disabled: true});

    this.controller.setupWidget(Mojo.Menu.commandMenu, {
        menuClass: 'no-fade'
    }, this.cmdMenuModel);
    this.controller.setupWidget("add-menu", this.handleCommand, this.addMenuModel);

    // Filter
    var attr = {
        filterFieldName: "name",
        delay: 100,
        filterFieldHeight: 100
    };
    this.model = {
        disabled: false
    };
    
    // Bind them handlers!
    this.filter = this.listFilterEvent.bind(this);
    
    // Store references to reduce the use of controller.get()
    this.filterField = this.controller.get('listFilterField');
    
    // Setup the widget
    this.controller.setupWidget('listFilterField', attr, this.model);
    
    // List
    this.feedAttr = {
        itemTemplate: "feedList/feedRowTemplate",
        listTemplate: "feedList/feedListTemplate",
        swipeToDelete: true,
        reorderable: true,
        renderLimit: 40,
        formatters: {"albumArt": this.albumArtFormatter.bind(this), "details": this.detailsFormatter.bind(this)}
    };

    if (Prefs.albumArt) {
        if (Prefs.simple) {
            this.feedAttr.itemTemplate = "feedList/feedRowTemplate-simple";
        } else {
            this.feedAttr.itemTemplate = "feedList/feedRowTemplate";
        }
    } else {
        if (Prefs.simple) {
            this.feedAttr.itemTemplate = "feedList/feedRowTemplate-simpleNoAlbumArt";
        } else {
            this.feedAttr.itemTemplate = "feedList/feedRowTemplate-noAlbumArt";
        }
    }
    
    this.controller.setupWidget("feedListWgt", this.feedAttr, feedModel);
    this.feedList = this.controller.get("feedListWgt");

    this.handleSelectionHandler = this.handleSelection.bindAsEventListener(this);
    this.handleDeleteHandler = this.handleDelete.bindAsEventListener(this);
    this.handleReorderHandler = this.handleReorder.bindAsEventListener(this);

    this.controller.setupWidget("refreshSpinner", {property: "updating"});
    this.controller.setupWidget("downloadSpinner", {property: "downloading"});

    this.controller.setupWidget(Mojo.Menu.appMenu, this.appMenuAttr, this.appMenuModel);

    this.refresh = Mojo.Function.debounce(this._refreshDebounced.bind(this), this._refreshDelayed.bind(this), 1);
    this.needRefresh = false;
    this.refreshedOnce = false;

    this.onBlurHandler = this.onBlur.bind(this);
    this.onFocusHandler = this.onFocus.bind(this);
    Mojo.Event.listen(this.controller.stageController.document, Mojo.Event.stageActivate, this.onFocusHandler);
    Mojo.Event.listen(this.controller.stageController.document, Mojo.Event.stageDeactivate, this.onBlurHandler);

    try {
        this.sceneScroller = this.controller.getSceneScroller();
        this.topScrollerElement = this.controller.get('topFadeIndicator');
    } catch (e) {
        Mojo.Log.error("Error getting scroller fade: %j", e);
    }
};

FeedListAssistant.prototype.activate = function(result) {
    this.active = true;

    if (result) {
        // Utilities.dump(result);
        if (result.feedToAdd) {
            var feed = new Feed();
            feed.title = result.feedToAdd.title;
            feed.url = result.feedToAdd.url;
            feed.update(function() {});
            feedModel.add(feed);
            result.feedAdded = true;
        }
        if (result.feedChanged) {
            this.feedList.mojo.noticeUpdatedItems(result.feedIndex, [feedModel.items[result.feedIndex]]);
            this.feedList.mojo.revealItem(result.feedIndex, true);
        }
        if (result.feedAdded) {
            this.feedList.mojo.noticeAddedItems(feedModel.items.length-1, [feedModel.items[feedModel.items.length-1]]);
            this.feedList.mojo.revealItem(feedModel.items.length-1, true);
            DB.saveFeeds();
        }
    } else {
        // this.feedList.mojo.revealItem(feedModel.items.length-1, true); //  XX
    }

    if (this.foregroundVolumeMarker) {
        this.foregroundVolumeMarker.cancel();
        this.foregroundVolumeMarker = null;
    }
    //this.foregroundVolumeMarker = AppAssistant.mediaEventsService.markAppForeground();
    this.controller.listen('listFilterField', Mojo.Event.filter, this.filter);
    Mojo.Event.listen(this.feedList, Mojo.Event.listTap, this.handleSelectionHandler);
    Mojo.Event.listen(this.feedList, Mojo.Event.listDelete, this.handleDeleteHandler);
    Mojo.Event.listen(this.feedList, Mojo.Event.listReorder, this.handleReorderHandler);

    if (Prefs.freeRotation) {
        if (this.controller.stageController.setWindowOrientation) {
            this.controller.stageController.setWindowOrientation("free");
        }
    } else {
        this.controller.stageController.setWindowOrientation("up");
    }

    // without this hack, the top scroller is activated when at the top of the list if you scrolled down
    // in the episode list any
    try {
        this.topPosition = this.sceneScroller.mojo.getScrollPosition().top;
        var topIndicator = new Mojo.Widget.Scroller.Indicator(this.topScrollerElement, function(){return this.topPosition!==0;}.bind(this));
        topIndicator.update();
    } catch (e) {
        Mojo.Log.error("Error updating scroller fade: %j", e);
    }

    if (Prefs.reload) {
        delete Prefs.reload;
        DB.writePrefs();
        this.stageController.swapScene({name: "feedList", transition: Prefs.transition});
    } else {
        if (Prefs.firstRun) {
            Prefs.firstRun = false;
            DB.writePrefs();
            var dialog = new drnull.Dialog.Confirm(this, $L({value:"Add Default Feeds", key:"addDefaultFeeds"}),
                $L({value:"Welcome to drPodder Redux!<br><br>Would you like to add some podcasts to get you started?", key:"drpodderWelcome"}),
                function() {
                    var dialog = new drnull.Dialog.Info(this, $L({value:"Thanks for using drPodder Redux!", key:"drpodderThanks"}),
                        $L({value:"You can add podcasts by url or search for podcasts using the '+' icon in the bottom left.", key:"drpodderInstructions"}) +
                        "<br><br>" + $L({value:"Feel free to delete any of the default podcasts.", key:"drpodderDeleteDefaults"})
                        );
                    dialog.show();
                    this._loadDefaultFeeds();
                }.bind(this),
                function() {
                    var dialog = new drnull.Dialog.Info(this, $L({value:"Thanks for using drPodder Redux!", key:"drpodderThanks"}),
                        $L({value:"You can add podcasts by url or search for podcasts using the '+' icon in the bottom left.", key:"drpodderInstructions"})
                        );
                    dialog.show();
                }.bind(this));
            dialog.show();
        } else {
            //Check for updates
            if (!DrPodder.UpdateCheckDone) {
                DrPodder.UpdateCheckDone = true;
                updaterModel.CheckForUpdate("drPodder", this.handleUpdateResponse.bind(this));
            }
        }
    }
    this.onFocus();
};

FeedListAssistant.prototype.handleUpdateResponse = function(responseObj) {
    if (responseObj && responseObj.updateFound) {
        updaterModel.PromptUserForUpdate(function(response) {
            if (response)
                updaterModel.InstallUpdate();
        }.bind(this));
    }
}

FeedListAssistant.prototype.loadDefaultFeeds = function() {
    var dialog = new drnull.Dialog.Confirm(this, 
        $L({value:"Add Default Feeds", key:"addDefaultFeeds"}),
        $L({value:"Would you like to add the following feeds?", key:"drpodderDefaults"}) +
        "<ul><li>PalmCast (Restored)</li>" +
        "<li>This Week in Tech (Tiny Feed)</li>" +
        "<li>Stuff You Should Know (Tiny Feed)</li></ul>",
        function() {
            this._loadDefaultFeeds();
        }.bind(this),
        function() {});
    dialog.show();
};

FeedListAssistant.prototype._loadDefaultFeeds = function() {
    DB.defaultFeeds();
    this.controller.modelChanged(feedModel);
    this.updateFeeds();
};

FeedListAssistant.prototype.deactivate = function() {
    this.active = false;
    Mojo.Event.stopListening(this.feedList, Mojo.Event.listTap, this.handleSelectionHandler);
    Mojo.Event.stopListening(this.feedList, Mojo.Event.listDelete, this.handleDeleteHandler);
    Mojo.Event.stopListening(this.feedList, Mojo.Event.listReorder, this.handleReorderHandler);
};

FeedListAssistant.prototype.onBlur = function() {
    if (this.foregroundVolumeMarker) {
        this.foregroundVolumeMarker.cancel();
        this.foregroundVolumeMarker = null;
    }
    // well this is just retarded.  There's no way for somebody to be notified of the blur,
    // since we are deactivated.  Boooooo
    Mojo.Controller.getAppController().sendToNotificationChain({
        type: "onBlur"});
};

FeedListAssistant.prototype.onFocus = function() {
    Mojo.Log.info("Feed List got focus!");
    if (this.active) {
        this.refreshNow();
    }

    if (DrPodder.IncomingAddFeed != null) {
        Mojo.Log.info("Adding Feed requested: " + JSON.stringify(DrPodder.IncomingAddFeed));
        this.stageController.pushScene({name: "addFeed", transition: Prefs.transition}, null);
    }

    if (!this.foregroundVolumeMarker) {
        //this.foregroundVolumeMarker = AppAssistant.mediaEventsService.markAppForeground();
    }

    Util.closeDashboard(DrPodder.DashboardStageName);
    Util.closeDashboard(DrPodder.DownloadingStageName);
    Util.closeDashboard(DrPodder.DownloadedStageName);

    this.cmdMenuModel.items[1].items[this.cmdMenuModel.items[1].items.length-1].disabled = feedModel.updatingFeeds;
    this.controller.modelChanged(this.cmdMenuModel);

    Mojo.Controller.getAppController().sendToNotificationChain({
        type: "onFocus"});
};

FeedListAssistant.prototype.updateFeeds = function(feedIndex) {
    feedModel.updateFeeds();
};

FeedListAssistant.prototype.cleanup = function() {
    Mojo.Event.stopListening(this.controller.stageController.document, Mojo.Event.stageActivate, this.onFocusHandler);
    Mojo.Event.stopListening(this.controller.stageController.document, Mojo.Event.stageDeactivate, this.onBlurHandler);
    // this doesn't seem to actually save the feeds.  db has gone away maybe?
    //DB.saveFeeds();
    if (this.foregroundVolumeMarker) {
        this.foregroundVolumeMarker.cancel();
        this.foregroundVolumeMarker = null;
    }
};


FeedListAssistant.prototype.listFilterEvent = function(event) {
   var filterString = event.filterString;
   //Mojo.Log.error("filtervalue '" + event.filterString+"'");

   var newModel; 
   if (filterString.length == 0) {
       newModel = feedModel.items;
   } else {
       var exp = filterString.toLowerCase(); 
       filterFunc = function(e) {
           if( e.title == undefined ) return false;
           if( e.title.length == 0 ) return false;
           return (e.title.toLowerCase().indexOf(exp) >= 0)
       };
       var newModel = feedModel.items.filter(filterFunc);
   }
   this.feedList.mojo.noticeUpdatedItems(0, newModel);
   this.feedList.mojo.setLength(newModel.length);

   if (this.filterField) {
       //  Once you know how many results you have after you've pruned your results,
       //  Updated the count using mojo.setCount(). This changes the number in the little
       //  bubble, adjacent to where the filter string is displayed
       this.filterField.mojo.setCount(newModel.length);
   }
};


FeedListAssistant.prototype._refreshDebounced = function() {
    this.needRefresh = true;
    if (!this.refreshedOnce) {
        this._doRefresh();
        this.refreshedOnce = true;
    }
};

FeedListAssistant.prototype._refreshDelayed = function() {
    this.refreshedOnce = false;
    this._doRefresh();
};

FeedListAssistant.prototype._doRefresh = function() {
    if (this.needRefresh) {
        //Mojo.Log.error("fla refresh");
        this.controller.modelChanged(feedModel);
        this.needRefresh = false;
    }
};

FeedListAssistant.prototype.refreshNow = function() {
    this.needRefresh = true;
    this._doRefresh();
};

FeedListAssistant.prototype.albumArtFormatter = function(albumArt, model) {
    var formatted = albumArt;

    if (formatted && formatted.indexOf("/") === 0) {
        formatted = "/media/internal" + formatted;
        if (!formatted.toUpperCase().match(/.GIF$/)) {
            formatted = "/var/luna/data/extractfs" +
                            encodeURIComponent(formatted) +
                            ":0:0:56:56:3";
        }
    }
    return formatted;
};

FeedListAssistant.prototype.detailsFormatter = function(details, model) {
    var formatted = details;
    if (formatted) {
        formatted = model.replace(formatted);
    }
    return formatted;
};


FeedListAssistant.prototype.handleSelection = function(event) {
    var targetClass = event.originalEvent.target.className;
    var feed = event.item;
    //var feedIndex = event.item.feedIndex;
    // var feed = feedModel.items[feedIndex];
    if (targetClass.indexOf("feedStats") === 0) {
        var editCmd = {label: $L({value:"Edit Feed", key:"editFeed"}), command: "edit-cmd"};
        if (feed.playlist) {
            editCmd = {label: $L({value:"Edit Playlist", key:"editPlaylist"}), command: "editplaylist-cmd"};
        }
        // popup menu:
        // last update date/time
        // next update date/time
        // ## downloaded
        // ## new
        // ## started
        // edit feed
        this.controller.popupSubmenu({
            onChoose: this.popupHandler.bind(this, feed, 0),
            placeNear: event.originalEvent.target,
            items: [
                    //{label: "Last: "+feed.lastUpdate, command: 'dontwant-cmd', enabled: false},
                    //{label: "Next: "+feed.lastUpdate+feed.interval, command: 'dontwant-cmd'},
                    //{label: feed.numDownloaded+" downloaded", command: 'viewDownloaded-cmd'},
                    //{label: feed.numNew+" new", command: 'viewNew-cmd'},
                    //{label: feed.numStarted+" started", command: 'viewStarted-cmd'},
                    {label: $L({value:"Clear New", key:"clearNew"}), command: 'listened-cmd'},
                    editCmd
            ]});
    } else if (targetClass.indexOf("download") === 0) {
        this.controller.popupSubmenu({
            onChoose: this.popupHandler.bind(this, feed, 0),
            placeNear: event.originalEvent.target,
            items: [
                    {label: $L({value:"Cancel Downloads", key:"cancelDownloads"}), command: 'cancelDownloads-cmd'}
            ]});
    } else {
        this.stageController.pushScene({name: "episodeList", transition: Prefs.transition}, feed);
    }
};

FeedListAssistant.prototype.popupHandler = function(feed, feedIndex, command) {
    switch(command) {
        case "edit-cmd":
            this.stageController.pushScene({name: "addFeed", transition: Prefs.transition}, feed);
            break;
        case "editplaylist-cmd":
            this.stageController.pushScene({name: "addPlaylist", transition: Prefs.transition}, feed);
            break;
        case "listened-cmd":
            feed.listened();
            break;
        case "cancelDownloads-cmd":
            for (var i=0; i<feed.episodes.length; i++) {
                var episode = feed.episodes[i];
                episode.cancelDownload();
            }
            break;
    }

};


FeedListAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
        switch (event.command) {
            case "add-playlist":
                this.stageController.pushScene({name: "addPlaylist", transition: Prefs.transition}, null);
                break;
            case "add-feed":
                this.stageController.pushScene({name: "addFeed", transition: Prefs.transition}, null);
                break;
            case "add-local":
                this.stageController.pushScene({name: "addLocal", transition: Prefs.transition}, null);
                break;
            case "feed-search":
                this.stageController.pushScene({name: "feedSearch", transition: Prefs.transition}, this, null);
                break;
            case "web-search":
                this.stageController.pushScene({name: "webSearch", transition: Prefs.transition}, {startPage: "http://m.google.com/search"});
                break;
            case "pt-search":
                this.stageController.pushScene({name: "webSearch", transition: Prefs.transition}, {startPage: "http://ota.versatilemonkey.com/ptbrowse/browse.pl",
                                                             limitSite: "http://ota.versatilemonkey.com"});
                break;
            case 'about-cmd':
                this.ShowDialogBox("drPodder Redux - " + Mojo.Controller.appInfo.version, "Podcast Client for webOS. Based on Guttenpodder and drPodder. Copyright 2021, Jon Wise. Distributed under a GPLv3 license.<br>Source code available at: https://github.com/codepoet80/webos-drpodder<br>Podcast Directory provided by webOSArchive.org");
                break;
            case "refresh-cmd":
                this.updateFeeds();
                break;
            case "filterField-cmd":
                  // open virt keyboard, see https://developer.palm.com/distribution/viewtopic.php?f=11&t=17285
                  var ffAsst = this.filterField._mojoController.assistant;
                  if (ffAsst.filterOpen)
                     this.filterField.mojo.close();
                  else
                     this.filterField.mojo.open();
                break;
            case "addDefault-cmd":
                this.loadDefaultFeeds();
                break;
            case "report-cmd":
                event.assistant = this;
                event.data = "Feeds: <br/>";
                feedModel.items.forEach(function(f) {
                    event.data += f.id + " URL: " + f.url + "<br/>";
                });
                break;
            case 'cmd-backButton' :
                this.controller.stageController.popScene();
                break;

            case "import-clipboard-cmd":
                var callback, title, hint, defaultDataValue="";
                callback = this.importOpml.bind(this);
                title = $L("Import from clipboard");
                hint = $L("Paste import here");
                
                this.controller.showDialog({
                    template: "preferences/import-dialog",
                    assistant: new ImportDialogAssistant(this.controller, callback, title, hint, defaultDataValue, false)
                });

                break;
            case "import-cmd":
                var req = new Ajax.Request("/media/internal/drpodder.xml", {
                    method: 'get',
                    onFailure: function() {
                        Util.showError($L({value:"Error reading OPML File", key:"errorReadingOPML"}), $L({value:"I don't know what happened, but we couldn't read the drpodder.xml file.", key:"couldntReadDrpodder"}));
                    },
                    on404: function() {
                        Util.showError($L({value:"OPML File not found", key:"opmlNotFound"}), $L({value:"Please place the drpodder.xml file in the root of the Pre's USB directory and retry.", key:"pleasePlaceDrpodder"}));
                    },
                    onSuccess: function(transport) {
                        this.importOpml(transport.responseText);
                    }.bind(this)
                });
                break;
            case "export-cmd":
                var message = $L({value:"Copy the following out to a file named drpodder.xml (Make sure the filename is all lowercase and Windows doesn't rename the file as drpodder.xml.txt).<br>" +
                              "To restore this set of feeds to drPodder, simply copy drpodder.xml to the root of the Pre's USB directory.", key:"opmlInstructions"}) +
                              "<br><br>&lt;opml version='1.1'>&lt;body><br>";
                for (var i=0; i<feedModel.items.length; i++) {
                    var feed = feedModel.items[i];
                    if (!feed.playlist) {
                        message += "&lt;outline text='" + feed.title.replace(/&/g, "&amp;amp;").replace(/'/g, "&amp;apos;") + "'";
                        message += " type='rss' xmlUrl='" + feed.url.replace(/&/g, "&amp;amp;") + "'";
                        message += " autoDownload='" + feed.autoDownload + "'";
                        message += " autoDelete='" + feed.autoDelete + "'";
                        message += " maxDownloads='" + feed.maxDownloads + "'";
                        message += " replacements='" + feed.replacements.replace(/&/g,"&amp;amp;").replace(/'/g, "&amp;apos;") + "'";
                        message += " hideFromOS='" + feed.hideFromOS + "'";
                        if (feed.username) {
                            message += " username='" + feed.username + "'";
                            message += " password='" + feed.password + "'";
                        }
                        message += "/><br>";
                    }
                }
                message += "&lt;/body>&lt;/opml>";
                AppAssistant.applicationManagerService.email($L({value:"GuttenPodder OPML Export", key:"opmlSubject"}), message);
                break;
            case "export-clipboard-cmd":
                var message = "<opml version='1.1'><body><br>";
                for (var i=0; i<feedModel.items.length; i++) {
                    var feed = feedModel.items[i];
                    if (!feed.playlist) {
                        message += "<outline text='" + feed.title.replace(/&/g, "&amp;amp").replace(/'/g, "&amp;apos;") + "'";
                        message += " type='rss' xmlUrl='" + feed.url.replace(/&/g, "&amp;amp;") + "'";
                        message += " autoDownload='" + feed.autoDownload + "'";
                        message += " autoDelete='" + feed.autoDelete + "'";
                        message += " maxDownloads='" + feed.maxDownloads + "'";
                        message += " replacements='" + feed.replacements.replace(/&/g,"&amp;amp;").replace(/'/g, "&amp;apos;") + "'";
                        message += " hideFromOS='" + feed.hideFromOS + "'";
                        if (feed.username) {
                            message += " username='" + feed.username + "'";
                            message += " password='" + feed.password + "'";
                        }
                        message += "/><br>";
                    }
                }
                message += "</body></opml>";
                this.stageController.setClipboard(message);
                break;
        }

    }
};

FeedListAssistant.prototype.handleDelete = function(event) {
    DB.removeFeed(event.model.items[event.index]);
    event.model.items.splice(event.index, 1);
    DB.saveFeedsOnly();
};

FeedListAssistant.prototype.handleReorder = function(event) {
    event.model.items.splice(event.fromIndex, 1);
    event.model.items.splice(event.toIndex, 0, event.item);
    DB.saveFeeds();
};

FeedListAssistant.prototype.considerForNotification = function(params) {
    if (params) {
        switch (params.type) {
            case "feedUpdated":
                var feedIndex = params.feedIndex;
                var reveal = params.reveal;
                if (feedIndex === undefined) {
                    feedIndex = feedModel.items.indexOf(params.feed);
                }
                if (feedIndex !== -1) {
                    this.feedList.mojo.noticeUpdatedItems(feedIndex, [params.feed]);
                }
                if (reveal) {
                    this.feedList.mojo.revealItem(feedIndex, true);
                }
                break;
            case "feedsUpdating":
                this.cmdMenuModel.items[1].items[this.cmdMenuModel.items[1].items.length-1].disabled = params.value;
                this.controller.modelChanged(this.cmdMenuModel);
                if (!params.value) {
                    this.refreshNow();
                }
                break;
        }
    }
};

FeedListAssistant.prototype.importOpml = function(opml) {
    try {
        var doc = (new DOMParser()).parseFromString(opml, "text/xml");
        var nodes = document.evaluate("//outline", doc, null, XPathResult.ANY_TYPE, null);
        var node = nodes.iterateNext();
        var imported = 0;
        while (node) {
            var title = Util.xmlGetAttributeValue(node, "title") || Util.xmlGetAttributeValue(node, "text");
            var url   = Util.xmlGetAttributeValue(node, "xmlUrl") || Util.xmlGetAttributeValue(node, "url");
            var autoDownload = Util.xmlGetAttributeValue(node, "autoDownload");
            var autoDelete = Util.xmlGetAttributeValue(node, "autoDelete");
            var maxDownloads = Util.xmlGetAttributeValue(node, "maxDownloads");
            var replacements = Util.xmlGetAttributeValue(node, "replacements");
            var hideFromOS = Util.xmlGetAttributeValue(node, "hideFromOS");
            var username = Util.xmlGetAttributeValue(node, "username");
            var password = Util.xmlGetAttributeValue(node, "password");
            if (title !== undefined && url !== undefined) {
                Mojo.Log.warn("Importing feed: (%s)-[%s]", title, url);
                feed = new Feed();
                feed.url = url;
                feed.title = title;
                if (autoDownload !== undefined) {feed.autoDownload = (autoDownload==='1');}
                if (autoDelete !== undefined) {feed.autoDelete = (autoDelete==='1');}
                if (maxDownloads !== undefined) {feed.maxDownloads = maxDownloads;}
                if (replacements !== undefined) {feed.replacements = replacements;}
                if (hideFromOS !== undefined) {feed.hideFromOS = hideFromOS;}
                if (username !== undefined) {feed.username = username;}
                if (password !== undefined) {feed.password = password;}
                feedModel.items.push(feed);
                feed.update(null, null, true);
                imported++;
            } else {
                Mojo.Log.warn("Skipping import: (%s)-[%s]", title, url);
            }
            node = nodes.iterateNext();
        }
        if (imported > 0) {
            DB.saveFeeds();
            Util.showError($L({value:"OPML Import Finished", key:"opmlImportFinished"}), $L({value:"The #{num} imported feed" + ((imported !== 1)?"s":"") + " can be found at the END of your feed list.", key:"opmlImportStatus"}).interpolate({num:imported}));
                            } else {
            Util.showError($L({value:"OPML Import Finished", key:"opmlImportFinished"}), $L({value:"No valid feeds found in drpodder.xml", key:"noValidFeeds"}));
        }
    } catch (e){
        Mojo.Log.error("error with OPML: (%s)", e);
        Util.showError($L({value:"Error parsing OPML File", key:"errorParsingOPML"}), $L({value:"There was an error parsing the OPML file.  Please send the file to curator@webosarchive.org.", key:"errorParsingOPMLBody"}));
    }
};

FeedListAssistant.prototype.ShowDialogBox = function(title, message) {
    var stageController = Mojo.Controller.getAppController().getActiveStageController();
    if (stageController) {
        this.controller = stageController.activeScene();

        this.controller.showAlertDialog({
            onChoose: function(value) {},
            title: title,
            message: message,
            choices: [{ label: 'OK', value: 'OK' }],
            allowHTMLMessage: true
        });
    }
}

/*
AppAssistant.VideoLibrary = MojoLoader.require({
    name: "metascene.videos",
    version: "1.0"
})["metascene.videos"];
*/

  
