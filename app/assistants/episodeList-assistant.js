var shareServiceModel = null;
function EpisodeListAssistant(feedObject) {
    this.feedObject = feedObject;
    this.episodeModel = {items: []};
    this.feedTitleFilterExp = "";
    shareServiceModel = new ShareServiceModel();
    this.appController = Mojo.Controller.getAppController();
    this.stageController = this.appController.getStageController(DrPodder.MainStageName);
}

EpisodeListAssistant.prototype.items = [];

EpisodeListAssistant.prototype.menuAttr = {omitDefaultItems: true};

EpisodeListAssistant.prototype.filterMenuModel = {
    items: [
        {label: $L("ALL"), command: "filter-all-cmd"},
        {label: $L("New"), command: "filter-new-cmd"},
        {label: $L("Old"), command: "filter-old-cmd"},
        {label: $L("Downloaded"), command: "filter-downloaded-cmd"},
        {label: $L("Downloaded & New"), command: "filter-downloadednew-cmd"},
        {label: $L("Downloaded & Old"), command: "filter-downloadedold-cmd"},
        {label: $L("Downloading"), command: "filter-downloading-cmd"},
        {label: $L("Undownloaded & New"), command: "filter-notdownloadednew-cmd"},
        {label: $L("Paused"), command: "filter-paused-cmd"}
    ]
};

EpisodeListAssistant.prototype.viewMenuModel = {
    visible: true,
    items: []
};

EpisodeListAssistant.prototype.menuModel = {
    visible: true,
    items: []
};

EpisodeListAssistant.prototype.filterEpisodes = function() {
    var newModel = this.feedObject.episodes;
    Mojo.Log.info("feed %s  filterEpisodes: %s", this.feedObject, this.feedObject.viewFilter);

    if (this.feedObject.viewFilter !== "ALL") {

        var filterFunc = function(e) {return !e.listened;};  // new; is default function
        switch (this.feedObject.viewFilter) {
            case "old":
                filterFunc = function(e) {return e.listened;};
                break;
            case "downloaded":
                filterFunc = function(e) {return e.isLocalPlayable();};
                break;
            case "undownloaded & new":
                filterFunc = function(e) {return !e.isLocalPlayable() && !e.listened;};
                break;
            case "downloaded & new":
                filterFunc = function(e) {return e.isLocalPlayable() && !e.listened;};
                break;
            case "downloaded & old":
                filterFunc = function(e) {return e.isLocalPlayable() && e.listened;};
                break;
            case "downloading":
                filterFunc = function(e) {return e.downloading;};
                break;
            case "paused":
                filterFunc = function(e) {return e.position;};
                break;
            case "New": // is already default (see above switch statement)
                break;
            default:
                break;
        }
        newModel = this.feedObject.episodes.filter(filterFunc);
    }

    if (this.feedTitleFilterExp !== "") {
        var exp = this.feedTitleFilterExp.toLowerCase(); 
        filterFunc = function(e) {
           if( e.title == undefined ) return false;
           if( e.title.length == 0 ) return false;
            return (e.title.toLowerCase().indexOf(exp) >= 0)
        };
        newModel = newModel.filter(filterFunc);
    }

    var refreshNeeded = false;
    if (newModel.length !== this.episodeModel.items.length) {
        refreshNeeded = true;
    } else {
        for (var i=0,len=newModel.length; i<len; ++i) {
            if (this.episodeModel.items[i] !== newModel[i]) {
                refreshNeeded = true;
                break;
            }
        }
    }

    if (refreshNeeded) {
        this.episodeModel.items = newModel;
        this.refreshNow();
    }

    // show stage title
    if( this.feedTitleFilterExp == '' ) {
       this.viewMenuModel.items[1].items[1].label = this.feedObject.title + ' (' + this.episodeModel.items.length + ' epis.)';
    } else {
       this.viewMenuModel.items[1].items[1].label = '"' + this.feedTitleFilterExp + '": ' + this.episodeModel.items.length + ' epis. "' + this.feedObject.title + '"';
    }

    if (this.filterField) {
       //  Once you know how many results you have after you've pruned your results,
       //  Updated the count using mojo.setCount(). This changes the number in the little
       //  bubble, adjacent to where the filter string is displayed
       this.filterField.mojo.setCount(this.episodeModel.items.length);
    }

    this.controller.modelChanged(this.viewMenuModel);
};

EpisodeListAssistant.prototype.setup = function() {
    this.cmdMenuModel = {items:[]};

    this.backButton = {items:[ {label: $L('Back'), iconPath: 'images/back-flat-flat.png', command:'cmd-backButton'} ] };
    this.filterArea = {items: [ {label: $L("View") + ": " + this.titleCaseString($L(this.feedObject.viewFilter)), submenu: "filter-menu"} ] };
    //this.viewButton = {label: $L("View") + ": " + this.titleCaseString($L(this.feedObject.viewFilter)), submenu: "filter-menu"};
    this.filterFieldButton = {icon: "search", command: "filterField-cmd"};
    this.refreshButton = {items: [ { icon: "refresh", command: "refresh-cmd"} ] };
    
    this.cmdMenuViewButtonPos    = 0;
    this.cmdMenuRefreshButtonPos = 1;
    //TODO: JW - This was necessary for old approach to back button and should be cleaned up
    this.cmdMenuModel.items.push(this.backButton);
    this.cmdMenuViewButtonPos++;
    this.cmdMenuRefreshButtonPos++;

    if(!_device_.thisDevice.hasKeyboard) { 
        // without keyboard add a search button to open virtual keyboard 
        this.filterArea.items.push(this.filterFieldButton); 
    }
    this.cmdMenuModel.items.push(this.filterArea);
    this.cmdMenuModel.items.push(this.refreshButton);

    this.controller.setupWidget(Mojo.Menu.commandMenu, {}, this.cmdMenuModel);

    this.menuModel = {
        visible: true,
        items: [
              //  Mojo.Menu.editItem,
            {label: "dummyeditfeed", command: "edit-cmd"},
            {label: $L({value:"Mark Visible as New", key:"markVisibleNew"}), command: "unlistened-cmd"},
            {label: $L({value:"Mark Visible as Old", key:"markVisibleOld"}), command: "listened-cmd"},
            {label: $L({value:"Share Podcast", key:"sharePodcast"}),
            items: [{label: "Touch2Share Ready", disabled:true, command:"share-cmd" },
                    {label: "Recommend", iconPath:"images/share-menu.png", command: "sharespace-cmd"},
                    {label: $L({value:"Email Links",        key:"viaEmail"      }), command: "share-cmd"},
                    {label: $L({value:"Copy Feed URL",    key:"copyFeedURL"   }), command: "copyFeed-cmd"}]
            },
            {label: $L({value:"Report a Problem", key:"reportProblem"}), command: "report-cmd"},
        ]
    };

    if (this.feedObject.playlist) {
        this.menuModel.items[0].label = $L({value:"Edit Playlist", key:"editPlaylist"});
    } else if (this.feedObject.isLocalMedia){
        this.menuModel.items[0].label = $L({value:"Edit Local Media", key:"editLocal"});
    } else {
        this.menuModel.items[0].label = $L({value:"Edit Feed",     key:"editFeed"    }); 
    }

    this.controller.setupWidget(Mojo.Menu.commandMenu, this.handleCommand, this.cmdMenuModel);
    this.controller.setupWidget("filter-menu", this.handleCommand, this.filterMenuModel);

    var viewMenuPrev = {icon: "", command: "", label: " "};
    var viewMenuNext = {icon: "", command: "", label: " "};
    if (this.feedObject.displayOrder > 0) {
        viewMenuPrev = {icon: "back", command: "feedPrev-cmd"};
    }
    if (this.feedObject.displayOrder < feedModel.items.length-1) {
        viewMenuNext = {icon: "forward", command: "feedNext-cmd"};
    }
    Mojo.Log.info("window width: " + Mojo.Environment.DeviceInfo.screenWidth);
    Mojo.Log.info("window height: " + Mojo.Environment.DeviceInfo.screenHeight);
    var baseWidth = Math.min(Mojo.Environment.DeviceInfo.screenWidth, Mojo.Environment.DeviceInfo.screenHeight)
    centerItemWidth = Math.floor(baseWidth - 120);
    centerItemWidth = Math.max(centerItemWidth, 200);
    Mojo.Log.warn("USING WIDTH: " + centerItemWidth);

    this.viewMenuModel.items = [{},{items: [viewMenuPrev,
                                        {label: this.feedObject.title,  width: centerItemWidth,  command: "feed-cmd"},
                                        viewMenuNext]
                                },{}];
    this.controller.setupWidget(Mojo.Menu.viewMenu, {}, this.viewMenuModel);

    // Filter
    var attr = {
        filterFieldName: "name",
        delay: 100 /*,
        filterFieldHeight: 100 */
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
    var itemTemplate ="episodeList/episodeRowTemplate";
    if (this.feedObject.playlist) {
        itemTemplate = "episodeList/playlistRowTemplate";
    }

    this.episodeAttr = {
        itemTemplate: itemTemplate,
        listTemplate: "episodeList/episodeListTemplate",
        renderLimit: 40,
        reorderable: true,  
        swipeToDelete: true,
        // preventDeleteProperty: "noDelete", // based on !listened || downloaded || position
        // autoconfirmDelete: true,
        formatters: {"title": this.titleFormatter.bind(this), "pubDate": this.pubDateFormatter.bind(this),
                     "albumArt": this.albumArtFormatter.bind(this),
                     "bookmarkPercent": this.bookmarkPercentFormatter.bind(this),
                     "downloadingPercent": this.downloadingPercentFormatter.bind(this)}};

    this.controller.setupWidget("episodeListWgt", this.episodeAttr, this.episodeModel);
    this.episodeList = this.controller.get("episodeListWgt");

    this.handleSelectionHandler = this.handleSelection.bindAsEventListener(this);
    this.handleDeleteHandler = this.handleDelete.bindAsEventListener(this);
    this.handleReorderHandler = this.handleReorder.bindAsEventListener(this);
    this.handleHoldHandler = this.handleHold.bindAsEventListener(this);
    this.dragStartHandler = this.clearPopupMenuOnSelection.bindAsEventListener(this);

    this.controller.setupWidget("episodeSpinner", {property: "downloading"});

    this.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);

    this.refresh = Mojo.Function.debounce(this._refreshDebounced.bind(this), this._refreshDelayed.bind(this), 1);
    this.needRefresh = false;

    this.d_names = Mojo.Locale.getDayNames('medium');
    this.m_names = Mojo.Locale.getMonthNames('medium');
    if (!this.d_names) {
        Mojo.Locale.set(Prefs.systemTranslation);
        this.d_names = Mojo.Locale.getDayNames('medium');
        this.m_names = Mojo.Locale.getMonthNames('medium');
        Mojo.Locale.set(Prefs.translation);
    }

    this.orientationChanged(this.stageController.getWindowOrientation());
};


EpisodeListAssistant.prototype.orientationChanged = function(orientation) {
    if (Prefs.freeRotation) {
        // change viewMenu size
        //TODO: Fix this
        /*
        try {
           var item = this.viewMenuModel.items[1].items[1];
           if (orientation === 'left' || orientation === 'right') {
              item.width = Mojo.Environment.DeviceInfo.screenHeight * 0.5 ;
           } else if (orientation === 'up' || orientation === 'down') {
              item.width = Mojo.Environment.DeviceInfo.screenWidth  * 0.4 ;
           }
           this.controller.modelChanged(this.viewMenuModel);
        } catch (f) {
           Mojo.Log.error("Exception orientation %s", f);
        }*/
    }
};

EpisodeListAssistant.prototype.downloadingPercentFormatter = function(downloadingPercent, model) {
    var formatted = downloadingPercent;
    if (formatted && this.feedObject.playlist) {
        formatted = "" + (formatted * 0.82);
    }
    return formatted;
};

EpisodeListAssistant.prototype.bookmarkPercentFormatter = function(bookmarkPercent, model) {
    var formatted = bookmarkPercent;
    if (formatted && this.feedObject.playlist) {
        formatted = "" + (formatted * 0.82);
    }
    return formatted;
};

EpisodeListAssistant.prototype.albumArtFormatter = function(albumArt, model) {
    var formatted = albumArt;

    if (formatted && formatted.indexOf("/") === 0) {
        formatted = "/media/internal" + formatted;
        if (!formatted.toUpperCase().match(/.GIF$/)) {
            formatted = "/var/luna/data/extractfs" +
                            encodeURIComponent(formatted) +
                            ":0:0:48:48:3";
        }
    }

    return formatted;
};

EpisodeListAssistant.prototype.activate = function(changes) {
    this.refresh();
    this.filterEpisodes();
    this.controller.listen('listFilterField', Mojo.Event.filter, this.filter);
    Mojo.Event.listen(this.episodeList, Mojo.Event.listTap, this.handleSelectionHandler);
    Mojo.Event.listen(this.episodeList, Mojo.Event.listDelete, this.handleDeleteHandler);
    Mojo.Event.listen(this.episodeList, Mojo.Event.listReorder, this.handleReorderHandler);
//  Mojo.Event.listen(this.episodeList, Mojo.Event.hold, this.handleHoldHandler);
    Mojo.Event.listen(this.episodeList, Mojo.Event.dragStart, this.dragStartHandler);
}

EpisodeListAssistant.prototype.deactivate = function(changes) {
    this.controller.stopListening('listFilterField', Mojo.Event.filter, this.filter);
    Mojo.Event.stopListening(this.episodeList, Mojo.Event.listTap, this.handleSelectionHandler);
    Mojo.Event.stopListening(this.episodeList, Mojo.Event.listDelete, this.handleDeleteHandler);
    Mojo.Event.stopListening(this.episodeList, Mojo.Event.listReorder, this.handleReorderHandler);
//  Mojo.Event.stopListening(this.episodeList, Mojo.Event.hold, this.handleHoldHandler);
    Mojo.Event.stopListening(this.episodeList, Mojo.Event.dragStart, this.dragStartHandler);
    DrPodder.CurrentShareURL = null;
};

EpisodeListAssistant.prototype.cleanup = function(changes) {
};

EpisodeListAssistant.prototype.handleCommand = function(event) {
    //Mojo.Log.info("hdlcmd: %s", event.command);
    if (event.type === Mojo.Event.command) {
        switch (event.command) {
            case "unlistened-cmd":
                for (var i=0, len=this.episodeModel.items.length; i<len; ++i) {
                    var episode = this.episodeModel.items[i];
                    if (episode.enclosure) {
                        episode.setUnlistened(true);
                    }
                }
                this.feedObject.doThatUpdate();
                break;
            case "listened-cmd":
                for (var i=0, len=this.episodeModel.items.length; i<len; ++i) {
                    var episode = this.episodeModel.items[i];
                    if (episode.enclosure) {
                        episode.setListened(true);
                    }
                }
                this.feedObject.doThatUpdate();
                break;
            case "edit-cmd":
                if (this.feedObject.playlist) {
                    this.stageController.pushScene({name: "addPlaylist", transition: Prefs.transition}, this.feedObject);
                } else if (this.feedObject.isLocalMedia) {
                    this.stageController.pushScene({name: "addLocal", transition: Prefs.transition}, this.feedObject);
                } else {
                    this.stageController.pushScene({name: "addFeed", transition: Prefs.transition}, this.feedObject);
                }
                break;
            case "refresh-cmd":
                this.cmdMenuModel.items[this.cmdMenuRefreshButtonPos].disabled = true;
                this.controller.modelChanged(this.cmdMenuModel);
                this.feedObject.update(function() {
                    // we may have navigated away from the scene
                    this.cmdMenuModel.items[this.cmdMenuRefreshButtonPos].disabled = false;
                    if(this.controller) {
                        this.controller.modelChanged(this.cmdMenuModel); 
                    }
                    this.feedObject.download();
                    Util.closeDashboard(DrPodder.DashboardStageName);
                    this.filterEpisodes();
                }.bind(this));
                break;
            case "filterField-cmd":
                  // open virt keyboard, see https://developer.palm.com/distribution/viewtopic.php?f=11&t=17285
                  var ffAsst = this.filterField._mojoController.assistant;
                  if (ffAsst.filterOpen)
                     this.filterField.mojo.close();
                  else
                     this.filterField.mojo.open();
                break;
            case "playFromNewest-cmd":
                this.playFrom();
                break;
            case "playFromOldest-cmd":
                this.playFrom(true);                             
                break;
            case "feedPrev-cmd":
                var feed = feedModel.items[this.feedObject.displayOrder-1];
                this.stageController.swapScene({name: "episodeList", transition: Prefs.transition}, feed);
                break;
            case "feedNext-cmd":
                feed = feedModel.items[this.feedObject.displayOrder+1];
                this.stageController.swapScene({name: "episodeList", transition: Prefs.transition}, feed);
                break;
            case "feed-cmd":
                if( !this.feedObject.isLocalMedia ) {
                   this.controller.popupSubmenu({
                       onChoose: this.handleFeedPopup.bind(this),
                       //manualPlacement: true,
                       //: "titlePopup1",
                       placeNear: event.originalEvent.target,
                       items: [{label: $L({value: "Play from Top", key: "playFromTop"}), command: "playFromNewest-cmd"},
                               {label: $L({value: "Play from Bottom", key: "playFromBottom"}), command: "playFromOldest-cmd"},
                               {label: $L({value: "Download New Episodes", key: "downloadNew"}), command: "downloadNew-cmd"}]
                   });
                } else {
                   this.controller.popupSubmenu({
                       onChoose: this.handleFeedPopup.bind(this),
                       //manualPlacement: true,
                       //popupClass: "titlePopup1",
                       placeNear: event.originalEvent.target,
                       items: [{label: $L({value: "Play from Top", key: "playFromTop"}), command: "playFromNewest-cmd"},
                               {label: $L({value: "Play from Bottom", key: "playFromBottom"}), command: "playFromOldest-cmd"}]
                               // no "download new Episodes"
                   });
                }
                break;
            case "filter-all-cmd":
                this.handleFilterCommand("ALL");
                break;
            case "filter-new-cmd":
                this.handleFilterCommand("New");
                break;
            case "filter-downloadednew-cmd":
                this.handleFilterCommand("downloaded & new");
                break;
            case "filter-notdownloadednew-cmd":
                this.handleFilterCommand("undownloaded & new");
                break;
            case "filter-old-cmd":
                this.handleFilterCommand("old");
                break;
            case "filter-downloaded-cmd":
                this.handleFilterCommand("downloaded");
                break;
            case "filter-downloadedold-cmd":
                this.handleFilterCommand("downloaded & old");
                break;
            case "filter-downloading-cmd":
                this.handleFilterCommand("downloading");
                break;
            case "filter-paused-cmd":
                this.handleFilterCommand("paused");
                break;
            case "sharespace-cmd":
                this.controller.showAlertDialog({
                    onChoose: function(value) {
                        if (value == "yes") {
                            this.getPodcastDetailsAndShare(this.feedObject.url);
                        }
                    },
                    title: "webOS Sharing Service",
                    message: "This will share the selected podcast with all other webOS users. Do you want to proceed?",
                    choices: [
                        { label: "Share", value: "yes", type: "affirmative" },
                        { label: "Cancel", value: "no", type: "negative" }
                    ]
                });
                break;
            case "share-cmd":
                var args = {podcastURL: this.feedObject.url,
                            podcastTitle: this.feedObject.title};
                var subject = $L({value: "Check out this podcast I found with drPodder!", key: "shareEpisodeSubject"});
                var message = $L({value: "Hi,<br/><br/>I thought you'd like to check out this nice podcast I'm enjoying in " +
                                    "<a href=\"http://www.webosarchive.com/drpodder\">drPodder Redux</a> " +
                                    "on my webOS device.<br/><br/>" +
                                    "To subscribe to this podcast yourself, copy the following link and " +
                                    "paste it into your favorite Podcatcher!<br/><br/>" +
                                    "Podcast Title: <a href=\"#{podcastURL}\">#{podcastTitle}</a><br/>" +
                                    "Podcast URL:<br/>#{podcastURL}<br/><br/>", key: "sharePodcastBody"}).interpolate(args);
                AppAssistant.applicationManagerService.email(subject, message);
                break;
            case "copyFeed-cmd":
                this.controller.stageController.setClipboard(DrPodder.CurrentShareURL);
                Util.banner($L({value:"Feed URL copied", key:"feedURLCopied"}));
                break;
            case "report-cmd":
                event.assistant = this;
                event.data = "Feed Information:<br/>";
                if (this.feedObject.playlist) {
                    event.data += "Playlist:<br/>";
                    if (this.feedObject.feedIds.length) {
                        this.feedObject.feedIds.forEach(function (fid) {
                            Mojo.Log.error('fid: %s', fid);
                            event.data += "URL: " + feedModel.getFeedById(fid).url + "<br/>";
                        });
                    } else {
                        feedModel.items.forEach(function (feed) {
                            Mojo.Log.error('feed: %s', feed.title);
                            event.data += "URL: " + feed.url + "<br/>";
                        });
                    }
                } else {
                    event.data += "URL: " + this.feedObject.url + "<br/>";
                }
                break;
            case 'cmd-backButton' :
                this.controller.stageController.popScene();
                break;
        }
    }
};

EpisodeListAssistant.prototype.handleFilterCommand = function(filter) {
    this.feedObject.viewFilter = filter;
    this.cmdMenuModel.items[1].items[0].label = $L("View") + ": " + this.titleCaseString($L(filter));
    this.controller.modelChanged(this.cmdMenuModel);
    this.filterEpisodes();
    DB.saveFeed(this.feedObject);
    this.controller.getSceneScroller().mojo.scrollTo(0, 0, true);
};

EpisodeListAssistant.prototype.titleCaseString = function(str) {
    str = str.toLowerCase().split(' ');
    for (var i = 0; i < str.length; i++) {
        str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
    }
    return str.join(' ');
};

EpisodeListAssistant.prototype.handleFeedPopup = function(value) {
    switch(value) {
        case "playFromNewest-cmd":
            this.playFrom();
            break;
        case "playFromOldest-cmd":
            this.playFrom(true);
            break;
        case "downloadNew-cmd":
            for (var i=0,len=this.episodeModel.items.length; i<len; ++i) {
                var episode = this.episodeModel.items[i];
                if (!episode.downloading && !episode.downloaded && !episode.listened) {
                    episode.download(true);
                }
            }
            break;
    }
};

EpisodeListAssistant.prototype.playFrom = function(oldest,startepisode) {
    var playlist = [];
    if (startepisode === undefined) {
       for (var i=0, len=this.episodeModel.items.length; i<len; ++i) {
           var episode = this.episodeModel.items[i];
           if (episode.enclosure) {
               playlist.push(episode);
           }
       }
    } else {
       var found=false;
       for (var i=this.episodeModel.items.length-1; i>=0; --i) {
           var episode = this.episodeModel.items[i];
           if (episode === startepisode) { found = true }
           if (episode.enclosure && found) {
               //Mojo.Log.info("---c-%d-%s-%s",i,found, episode.title);
               playlist.push(episode);
           }
       }
    }
    if (oldest) {playlist.reverse();}

    if (playlist.length > 0) {
        var e = playlist.shift();
        this.stageController.pushScene({name: "episodeDetails", transition: Mojo.Transition.none}, e, {autoPlay: true, resume: true, playlist: playlist});
    } else {
        Util.showError($L({value:"Error playing episodes", key:"errorPlayingEpisodes"}), $L({value:"No new Episodes found", key:"noNewEpisodes"}));
    }
};

EpisodeListAssistant.prototype.titleFormatter = function(title, model) {
    var formatted = title;
    if (formatted) {
        formatted = model.feedObject.replace(formatted);
    }
    return formatted;
};

EpisodeListAssistant.prototype.pubDateFormatter = function(pubDate, model) {
    var formatted = pubDate;
    if (formatted) {
        var d = formatted;
        var y = d.getFullYear();
        var m = d.getMonth();
        var dom=d.getDate();
        var dow=d.getDay();
        var h=d.getHours();
        var min=d.getMinutes();
        var pm = (d.getHours() >= 12)?$L("pm"):$L("am");
        if ($L("pm") === "pm") {
            h = (h%12);
            if (h===0) {h=12;}
        }
        //if (m<10) {m="0"+m;}
        if (min<10) {min="0"+min;}

        // Mojo.Format.formatDate(pubDate, 'medium') does not show dow, but show seconds
        if( Prefs.translation.substr(0,2) === "de" ) { // normal  :-)
           formatted = this.d_names[dow] + " " + dom + ". " + this.m_names[m] + ". " + y + ", " + h + ":" + min + " " + pm;
        } else { // imperial
           if (dom<10) {dom="0"+dom;}
           formatted = this.d_names[dow] + " " + this.m_names[m] + " " + dom + ", " + y + " " + h + ":" + min + " " + pm;
        }
    /*
    // I'd use this formatter, but I couldn't make it do what I wanted, i.e.,
    // Mon Mar 29, 2010 03:54:00 PM
    } else if (formatted) {
        formatted = Mojo.Format.formatDate(formatted, 'full');
    */
    }

    return formatted;
};

EpisodeListAssistant.prototype._refreshDebounced = function() {
    DrPodder.CurrentShareURL = "http://podcasts.webosarchive.com/detail.php?url=" + encodeURIComponent(this.feedObject.url);

    this.needRefresh = true;
    if (!this.refreshedOnce) {
        this._doRefresh();
        this.refreshedOnce = true;
    }
    if (this.feedObject.title.toLowerCase() == "all") {
        //Disable Share Menu Options for "All" podcasts
        this.menuModel.items[3].items[0].label = "Touch2Share Unavailable";
        this.menuModel.items[3].items[1].disabled = true;
        this.menuModel.items[3].items[2].disabled = true;
        this.menuModel.items[3].items[3].disabled = true;
        this.controller.modelChanged(this.menuModel);
    } else {
        //Enable Share Menu Options for Individual podcasts
        this.menuModel.items[3].items[0].label = "Touch2Share Ready";
        this.menuModel.items[3].items[1].disabled = false;
        this.menuModel.items[3].items[2].disabled = false;
        this.menuModel.items[3].items[3].disabled = false;
        this.controller.modelChanged(this.menuModel);
    }
};

EpisodeListAssistant.prototype._refreshDelayed = function() {
    this.refreshedOnce = false;
    this._doRefresh();
};

EpisodeListAssistant.prototype._doRefresh = function() {
    if (this.needRefresh) {
        //Mojo.Log.info("ela refresh %d", this.episodeModel.items.length);
        //this.controller.modelChanged(this.episodeModel);
        this.episodeList.mojo.noticeUpdatedItems(0, this.episodeModel.items);
        this.episodeList.mojo.setLength(this.episodeModel.items.length);
        // this is causing a blank list.  See: https://developer.palm.com/distribution/viewtopic.php?f=11&t=6242&view=unread#unread
        this.needRefresh = false;
    }
};

EpisodeListAssistant.prototype.refreshNow = function() {
    this.needRefresh = true;
    this._doRefresh();
};

EpisodeListAssistant.prototype.handleDelete = function(event) {
    event.stop();
    // item are episodes
    if (event.item.downloading) {
        event.item.cancelDownload();
    } else {
        event.item.setListened(true);
        event.item.deleteFile(true);
        event.item.clearBookmark(true);
        event.item.updateUIElements();
        event.item.save();
    }
};

EpisodeListAssistant.prototype.handleReorder = function(event) {
    var fromIndex = event.fromIndex;
    var toIndex   = event.toIndex;

    var fromEpi = event.model.items[fromIndex];
    var toEpi   = event.model.items[toIndex];
    
    event.model.items.splice(fromIndex, 1);
    event.model.items.splice(toIndex, 0, event.item);

    // after changing model.items[] (=displayed items), we also have to change
    // feedObject.epsiodes[], because that's the source for next filtering
    fromIndex = toIndex = 0;
    self = this;
    var i = 0;
    this.feedObject.episodes.forEach(function (e) {
        if( e === fromEpi ) { fromIndex = i; }
        if( e === toEpi   ) { toIndex   = i; }
        i++;
    });
    this.feedObject.episodes.splice(fromIndex, 1);
    this.feedObject.episodes.splice(toIndex, 0, fromEpi);
   
    if( this.feedObject.maxEpisodes != -1 ) {
        this.feedObject.maxEpisodesOriginal = this.feedObject.maxEpisodes; 
        this.feedObject.maxEpisodes = -1; // Setting feed ordering to 'manual'/do not sort
        Util.banner("info: sorting set to 'manual'");
    }
};

EpisodeListAssistant.prototype.cmdItems = {
    deleteCmd     : {label: $L("Delete"), command: "delete-cmd"},
    downloadCmd   : {label: $L("Download"), command: "download-cmd"},
    cancelCmd     : {label: $L("Cancel"), command: "cancel-cmd"},
    playallCmd    : {label: $L("Play all from here"), command: "playallfromhere-cmd"},
    playCmd       : {label: $L("Play"), command: "resume-cmd"},
    resumeCmd     : {label: $L("Resume"), command: "resume-cmd"},
    restartCmd    : {label: $L("Restart"), command: "restart-cmd"},
    listenedCmd   : {label: $L({value:"Mark as Old", key:"markOld"}), command: "listen-cmd"},
    unlistenedCmd : {label: $L({value:"Mark as New", key:"markNew"}), command: "unlisten-cmd"},
  //  pickupCmd     : {label: $L({value:"put in Pickuplist", key:"putPickuplist"}), command: "pickup-cmd"},
    clearCmd      : {label: $L({value:"Clear Bookmark", key:"clearBookmark"}), command: "clear-cmd"},
    detailsCmd    : {label: $L({value:"Episode Details", key:"episodeDetails"}), command: "details-cmd"},
    noEnclosureCmd: {label: $L({value:"No enclosure found", key:"noEnclosureFound"}), command: "noenclosure-cmd", disabled: true}
};

EpisodeListAssistant.prototype.clearPopupMenuOnSelection = function(event) {
    this.popupMenuOnSelection = false;
};

EpisodeListAssistant.prototype.handleHold = function(event) {
    this.popupMenuOnSelection = true;
};

EpisodeListAssistant.prototype.handleSelection = function(event) {
    var targetClass = event.originalEvent.target.className;
    var episode = event.item;
    var items = [];

    // constructing context senisitve popup menu
    if (!Prefs.singleTap || this.popupMenuOnSelection ||
        (targetClass.indexOf("episodeStatus") !== -1 &&
            !episode.downloading &&
            (episode.listened || !episode.enclosure) &&
            !episode.downloaded)) {
        this.popupMenuOnSelection = false;
        if (episode.downloading) {
            items.push(this.cmdItems.cancelCmd);
            items.push(this.cmdItems.playCmd);
            items.push(this.cmdItems.detailsCmd);
        } else {
            if (episode.enclosure) {
                if (episode.isDownloadable()) {
                    items.push(this.cmdItems.downloadCmd);
                }
                if (episode.position) {
                    items.push(this.cmdItems.playallCmd);
                    items.push(this.cmdItems.resumeCmd);
                    items.push(this.cmdItems.clearCmd);
                    items.push(this.cmdItems.restartCmd);
                } else {
                    items.push(this.cmdItems.playCmd);
                    items.push(this.cmdItems.playallCmd);
                }
                if (episode.isDeletable()) {
                    items.push(this.cmdItems.deleteCmd);
                }
            } else {
                items.push(this.cmdItems.noEnclosureCmd);
            }
            if (episode.listened) {
                items.push(this.cmdItems.unlistenedCmd);
            } else {
                items.push(this.cmdItems.listenedCmd);
            }
            // items.push(this.cmdItems.pickupCmd);
            items.push(this.cmdItems.detailsCmd);
        }
    } else { // single tap popup menu 
        if (targetClass.indexOf("episodeStatus") === -1) {
            // we clicked on the row, just push the scene
            this.play(episode, true, true);
        } else {
            // we clicked on the icon, do something different
            if (episode.downloading) {
                // if we're downloading, just cancel the download
                episode.cancelDownload();
            } else {
                if (episode.enclosure) {
                    if (episode.listened) {
                        if (episode.downloaded) {
                            episode.setListened();
                            episode.deleteFile();
                        } else {
                            this.handleHold(event);
                        }
                    } else {
                        if (episode.downloaded) {
                            this.play(episode, true, true);
                        } else {
                            episode.download(true);
                        }
                    }
                }
            }
        }
    }
    if (items.length > 0) {
        this.controller.popupSubmenu({
            onChoose: this.menuSelection.bind(this, episode),
            placeNear: event.originalEvent.target,
            items: items
        });
    }
};


EpisodeListAssistant.prototype.listFilterEvent = function(event) {
   this.feedTitleFilterExp = event.filterString;
   // filter anstossen 
   this.filterEpisodes();
};
    

EpisodeListAssistant.prototype.menuSelection = function(episode, command) {
    //Mojo.Log.info("we try to do:", command, "to", episode.title);
    switch (command) {
        case "listen-cmd":
            episode.setListened();
            break;
        case "unlisten-cmd":
            episode.setUnlistened();
            break;
  //    case "pickup-cmd":
  //        pickuplist.insertEpisodeTop(episode);
  //        break;
        case "cancel-cmd":
            episode.cancelDownload();
            break;
        case "download-cmd":
            episode.download(true);
            break;
        case "stream-cmd":
            this.play(episode, true, true);
            break;
        case "restart-cmd":
            this.play(episode, true, false);
            break;
        case "resume-cmd":
            this.play(episode, true, true);
            break;
        case "details-cmd":
            this.play(episode, false, true);
            break;
        case "play-cmd":
            this.play(episode, true, true);
            break;
        case "playallfromhere-cmd":
            this.playFrom(false,episode);
            break;
        case "clear-cmd":
            episode.clearBookmark();
            break;
        case "delete-cmd":
            episode.setListened();
            episode.deleteFile();
            break;
    }
};

EpisodeListAssistant.prototype.play = function(episode, autoPlay, resume) {
    this.stageController.pushScene({name: "episodeDetails", transition: Mojo.Transition.none}, episode, {"autoPlay": autoPlay, "resume": resume, playlist: []});
};

EpisodeListAssistant.prototype.updatePercent = function(episode) {
    //Mojo.Log.error("Setting percent to:", episode.downloadingPercent);
    var episodeIndex = this.episodeModel.items.indexOf(episode);
    if (episodeIndex !== -1) {
        var node = this.controller.get("episodeListWgt").mojo.getNodeByIndex(episodeIndex);
        var nodes;
        if (this.feedObject.playlist) {
            nodes = node.getElementsByClassName("progressDonePlaylist");
            nodes[0].style.width = episode.downloadingPercent*0.82 + "%";
        } else {
            nodes = node.getElementsByClassName("progressDone");
            nodes[0].style.width = episode.downloadingPercent + "%";
        }
    }
};

EpisodeListAssistant.prototype.eventApplies = function(ef) {
    return (ef === this.feedObject || (
        this.feedObject.playlist && (this.feedObject.feedIds.length === 0 ||
                                     this.feedObject.feedIds.some(function(f) {return ef.id == f;}))
    ));
};

EpisodeListAssistant.prototype.considerForNotification = function(params) {
    if (params) {
        switch (params.type) {
            case "feedEpisodesUpdated":
                if (this.eventApplies(params.feed)) {
                    this.refresh();
                    this.filterEpisodes();
                }
                break;
            case "episodeUpdated":
                if (this.eventApplies(params.episode.feedObject)) {
                    var episodeIndex = params.episodeIndex;
                    if (episodeIndex === undefined) {
                        episodeIndex = this.episodeModel.items.indexOf(params.episode);
                    }
                    if (episodeIndex !== -1) {
                        this.episodeList.mojo.noticeUpdatedItems(episodeIndex, [params.episode]);
                        this.filterEpisodes();
                    }
                }
                break;
            case "downloadProgress":
                if (this.eventApplies(params.episode.feedObject)) {
                    this.updatePercent(params.episode);
                }
                break;
            case "onFocus":
                this.refresh();
                this.filterEpisodes();
                break;
        }
    }
};

EpisodeListAssistant.prototype.getPodcastDetailsAndShare = function(url) {
    this.searchService = "wosaPodcastDirectorySearch";
	this.searchServices = {"wosaPodcastDirectorySearch": new wosaPodcastDirectorySearch()};
    var ss = this.searchServices[this.searchService];
    ss.getDetail(url, function(result) {
        shareServiceModel.DoShareAddRequest(JSON.stringify(result), "application/json", function(response) {
            if (response) {
                Mojo.Controller.getAppController().showBanner({ messageText: "Podcast shared!" }, "notifications", "");
            }
        }.bind(this));
    }.bind(this))
}