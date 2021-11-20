
function EpisodeDetailsAssistant(episode, options) {
    this.episodeObject = episode;
    if (!options) { options = {}; }
    this.resume = options.resume && (this.episodeObject.position !== 0);
    this.autoPlay = options.autoPlay;
    this.playlist = options.playlist;
    this.isForeground = true;
    this.bak60Pos=0;
    this.bak30Pos=1;
    this.playPausePos=2;
    this.fwd30Pos=3;
    this.fwd60Pos=4;   
};

EpisodeDetailsAssistant.prototype.progressAttr = {
    sliderProperty: "value",
    progressStartProperty: "progressStart",
    progressProperty: "progressEnd",
    round: false,
    updateInterval: 0.2
};

EpisodeDetailsAssistant.prototype.progressModel = {
    value: 0,
    minValue: 0,
    maxValue: 1
};

EpisodeDetailsAssistant.prototype.menuAttr = {omitDefaultItems: true};
EpisodeDetailsAssistant.prototype.menuModel = {
    visible: true,
    items: [
        {label: $L({value:"Play in webOS Player", key:"playExternal"}), command: "playExternal-cmd"},
        {label: $L({value:"Sleep Timer", key:"sleeptimer"}),
         items: [{label: $L({value:"Off",               key:"off"      }), command: "sleeptimer-off-cmd"},
                 {label: $L({value:"30 seconds",        key:"30s"      }), command: "sleeptimer-30-cmd"},
                 {label: $L({value:"5 Minutes",         key:"5minutes" }), command: "sleeptimer-300-cmd"},
                 {label: $L({value:"10 Minutes",        key:"10minutes"}), command: "sleeptimer-600-cmd"},
                 {label: $L({value:"20 Minutes",        key:"20minutes"}), command: "sleeptimer-1200-cmd"},
                 {label: $L({value:"30 Minutes",        key:"30minutes"}), command: "sleeptimer-1800-cmd"},
                 {label: $L({value:"45 Minutes",        key:"45minutes"}), command: "sleeptimer-2700-cmd"},
                 {label: $L({value:"1 hour",            key:"1h"       }), command: "sleeptimer-3600-cmd"}]
        },
        {label: $L({value:"Share Episode", key:"shareEpisode"}),
         items: [{label: "Touch2Share Ready", disabled:true, command:"share-cmd" },
                 {label: $L({value:"Email Links",        key:"viaEmail"      }), command: "share-cmd"},
                 {label: $L({value:"Copy Episode URL", key:"copyEpisodeURL"}), command: "copyEpisode-cmd"},
                 {label: $L({value:"Copy Feed URL",    key:"copyFeedURL"   }), command: "copyFeed-cmd"}]
        },
        {label: $L({value:"Report a Problem", key:"reportProblem"}), command: "report-cmd"},
    ]
};

EpisodeDetailsAssistant.prototype.menuCommandItems = {
    playerControls: {
        items: [
            {iconPath: "images/menu-icon-music-rewind2.png", command: "skipBack2-cmd"},
            {iconPath: "images/menu-icon-music-rewind.png", command: "skipBack-cmd"},
            {iconPath: "images/mini-player-icon-pause.png",  command: "play-cmd"},
            {iconPath: "images/menu-icon-music-forward.png", command: "skipForward-cmd"},
            {iconPath: "images/menu-icon-music-forward2.png", command: "skipForward2-cmd"},
        ]
    },
    play:        {iconPath: "images/mini-player-icon-play.png",  command: "play-cmd"},
    pause:       {iconPath: "images/mini-player-icon-pause.png", command: "pause-cmd"},
    //streamPlay:  {iconPath: "images/mini-player-icon-streamPlay.png", command: "streamPlay-cmd"},
    //streamPause: {iconPath: "images/mini-player-icon-streamPause.png", command: "streamPause-cmd"},
    download:    {icon: "save", command: "download-cmd"},
    cancel:      {icon: "stop", command: "cancel-cmd"},
    deleteFile:  {icon: "delete", command: "delete-cmd"},
    nil:         {icon: "", command: "", label: " "},
    back:        {items: [ {label:$L('Back'), icon: "back", command:'cmd-backButton'} ] }
}

EpisodeDetailsAssistant.prototype.cmdMenuModel = {
    items: [
        { items: [] },
        { items: [] },
        { items: [] }
    ]
};

EpisodeDetailsAssistant.prototype.viewMenuModel = {
    visible: true,
    items: []
};

EpisodeDetailsAssistant.prototype.setup = function() {
    this.isForeground = this.controller.stageController.isActiveAndHasScenes();
    this.progressInfo = this.controller.get("progress-info");
    this.header = this.controller.get("header");
    this.episodeDetailsTitle = this.controller.get("episodeDetailsTitle");
    this.statusDiv = this.controller.get("statusDiv");
    this.statusDiv.hide();
    this.setStatus('Setup');
    this.controller.getSceneScroller().mojo.setMode("dominant");

    this.controller.update(this.episodeDetailsTitle, this.episodeObject.title);

    // Add back button functionality for the TouchPad
    this.backElement = this.controller.get('icon');
    this.backTapHandler = this.backTap.bindAsEventListener(this);
    this.controller.listen(this.backElement, Mojo.Event.tap, this.backTapHandler);

    var self = this;
    DB.getEpisodeDescription(this.episodeObject, function(description) {
        // Mojo.Format.runTextIndexer doesn't alway work right...
        if (description.indexOf("<a") === 0) {
           description = Mojo.Format.runTextIndexer(description);
        }

        //Kill iframes, eg. in    http://psycomedia.wordpress.com/feed/ 
        description = description.replace(/<iframe[^>]*>/g, '<div>');
        description = description.replace(/<\/iframe/g, '</div');
        description = description.replace(/<object[^>]*>/g, '<div>');
        description = description.replace(/<\/object/g, '</div');

        self.controller.update(self.controller.get("episodeDetailsDescription"), description);

     // if( Prefs.debugSwitch ) {
     //     var s = "<table border=1>";
     //       for (var key in self.episodeObject) {
     //         if (self.episodeObject.hasOwnProperty(key)) {
     //             s = s + "<tr><td> " + key + "</td><td>" + self.episodeObject[key] + "</td></tr>";
     //         }
     //     }
     //     // s = s + "<tr><td> " +  + "</td><td>" + self. + "</td></tr>";
     //     self.controller.update(self.controller.get("episodeDetailsExtended"), s + "</table>");
     // }

    }.bind(this));

    this.progressModel.value = 0;
    this.progressModel.progressStart = 0;
    this.progressModel.progressEnd = 0;

    this.controller.setupWidget("progress", this.progressAttr, this.progressModel);
    this.progress = this.controller.get("progress");
    this.titleTapHandler = this.titleTap.bind(this);
    this.audioObject = {};
    this.player = {};

    this.cmdMenuModel.items[1] = this.menuCommandItems.playerControls;
    this.refreshMenu();
    if (this.episodeObject.enclosure || this.episodeObject.downloaded) {
        this.controller.setupWidget(Mojo.Menu.commandMenu, this.handleCommand, this.cmdMenuModel);
        if (!this.isVideo()) {

            //this.libs = MojoLoader.require({ name: "mediaextension", version: "1.0"});
            this.audioObject = this.controller.get('audioTag');
            this.player = new Player(this.audioObject, this.episodeObject);
            if (!this.isForeground) {
                this.player.showDashboard(this.controller.stageController);
            }
            //this.audioExt = this.libs.mediaextension.MediaExtension.getInstance(this.audioObject);
            //this.audioExt.audioClass = Media.AudioClass.MEDIA;

            //this.audioObject.addEventListener(Media.Event.PROGRESS, this.updateProgress.bind(this));
            //this.audioObject.addEventListener(Media.Event.DURATIONCHANGE, this.updateProgress.bind(this));
            this.setStatus($L("Loading"));
            this.disablePlay(true);
            this.progressChangedHandler = this.progressChange.bind(this);
            this.sliderDragStartHandler = this.sliderDragStart.bind(this);
            this.sliderDragEndHandler = this.sliderDragEnd.bind(this);

            this.handleErrorHandler = this.handleError.bind(this);
            this.handleAudioEventsHandler = this.handleAudioEvents.bind(this);

            this.updateProgressHandler = this.updateProgress.bind(this);

            this.audioObject.addEventListener(Media.Event.ERROR, this.handleErrorHandler);

            this.audioObject.addEventListener(Media.Event.PAUSE, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.PLAY, this.handleAudioEventsHandler);

            this.audioObject.addEventListener(Media.Event.ENDED, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.ABORT, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.CANPLAY, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.CANPLAYTHROUGH, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.CANSHOWFIRSTFRAME, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.DURATIONCHANGE, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.EMPTIED, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.LOAD, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.LOADEDFIRSTFRAME, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.LOADEDMETADATA, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.LOADSTART, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.SEEKED, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.SEEKING, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.STALLED, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.WAITING, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.X_PALM_DISCONNECT, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.X_PALM_RENDER_MODE, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.X_PALM_SUCCESS, this.handleAudioEventsHandler);
            this.audioObject.addEventListener(Media.Event.X_PALM_WATCHDOG, this.handleAudioEventsHandler);

            //this.audioObject.addEventListener(Media.Event.TIMEUPDATE, this.updateProgressHandler);

            this.keyDownEventHandler = this.keyDownHandler.bind(this);

            // as soon as setup finishes, we are ready to play
            this.readyToPlay.bind(this).defer();
        } else { // Video 
            this.progressInfo.hide();
            this.progressInfoHidden = true;
            this.adjustHeader();
            this.setStatus();
            if (this.autoPlay) {
                this.disablePlay();
                this.controller.window.setTimeout(this.enablePlay.bind(this), 10000);
                this.play();
            } else {
                this.enablePlay();
            }
        }

        this.updateTimer = null;
    } else {
        this.progressInfo.hide();
        this.progressInfoHidden = true;
        this.adjustHeader();
        this.setStatus();
    }

    this.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);

    this.onBlurHandler = this.onBlur.bind(this);
    Mojo.Event.listen(this.controller.stageController.document, Mojo.Event.stageDeactivate, this.onBlurHandler);

    this.orientationChanged(this.controller.stageController.getWindowOrientation());
};

EpisodeDetailsAssistant.prototype.backTap = function(event)
{
    Mojo.Log.error("*** Event notice: doing backTap");

    this.poppingScene = true;
    this.controller.stageController.popScene();
};

EpisodeDetailsAssistant.prototype.orientationChanged = function(orientation) {
    if (!Prefs.freeRotation) {
        orientation = 'up';
    }

    try {
       var item = this.controller.get('progress');

       if (orientation === 'left' || orientation === 'right') {
           item.style.width = (Mojo.Environment.DeviceInfo.screenHeight * 0.9) + 'px'; 
       } else if (orientation === 'up' || orientation === 'down') {
           item.style.width = (Mojo.Environment.DeviceInfo.screenWidth * 0.9) + 'px'; 
       }
       this.adjustHeader();
    } catch (f) {
       Mojo.Log.error("Exception orientationChanged orientationChanged %s", f);
    }
};

EpisodeDetailsAssistant.prototype.adjustHeader = function() {
    var height=this.controller.get("topContent").getHeight();
    try {
       this.controller.get("topSpacer").style.height = height + 'px';
       this.controller.get("descriptionFade").style.top = height + 'px';
    } catch (f) {
       Mojo.Log.error("Exception adjustheader %s", f);
    }
};

EpisodeDetailsAssistant.prototype.activate = function() {
    this.adjustHeader();
    this.isForeground = true;
    Mojo.Log.info("EpisodeDetails.activate isForeground = true");
    Mojo.Event.listen(this.controller.get("episodeDetailsTitle"), Mojo.Event.tap, this.titleTapHandler);

    if ((this.episodeObject.enclosure || this.episodeObject.downloaded) && !this.isVideo()) {
        Mojo.Event.listen(this.progress, Mojo.Event.propertyChange, this.progressChangedHandler);
        Mojo.Event.listen(this.progress, Mojo.Event.sliderDragStart, this.sliderDragStartHandler);
        Mojo.Event.listen(this.progress, Mojo.Event.sliderDragEnd, this.sliderDragEndHandler);
        Mojo.Event.listen(this.controller.sceneElement, Mojo.Event.keydown, this.keyDownEventHandler);

        if (Prefs.dashboardControls) {
            // throw away dashboard
        }
        this.mediaEvents = AppAssistant.mediaEventsService.registerForMediaEvents(this.controller, this.mediaKeyPressHandler.bind(this));
    }
    //Try to share the MP3 itself, fallback to podcast detail page
    if (this.episodeObject.enclosure && this.episodeObject.enclosure != "")
        DrPodder.CurrentShareURL = this.episodeObject.enclosure;
    else
        DrPodder.CurrentShareURL = "http://podcasts.webosarchive.com/detail.php?url=" + encodeURIComponent(this.episodeObject.feedObject.url);
};

EpisodeDetailsAssistant.prototype.deactivate = function() {

    Mojo.Event.stopListening(this.backElement, Mojo.Event.tap, this.backTapHandler);
    Mojo.Event.stopListening(this.controller.get("episodeDetailsTitle"), Mojo.Event.tap, this.titleTapHandler);

    if ((this.episodeObject.enclosure || this.episodeObject.downloaded) && !this.isVideo()) {
        Mojo.Event.stopListening(this.progress, Mojo.Event.propertyChange, this.progressChangedHandler);
        Mojo.Event.stopListening(this.progress, Mojo.Event.sliderDragStart, this.sliderDragStartHandler);
        Mojo.Event.stopListening(this.progress, Mojo.Event.sliderDragEnd, this.sliderDragEndHandler);
        Mojo.Event.stopListening(this.controller.sceneElement, Mojo.Event.keydown, this.keyDownEventHandler);
        Mojo.Event.stopListening(this.controller.stageController.document, Mojo.Event.stageDeactivate, this.onBlurHandler);

        if (Prefs.dashboardControls && this.playing) {
            // pop up dashboard
        }

        if (this.mediaEvents) {
            this.mediaEvents.cancel();
            this.mediaEvents = undefined;
        }
    }
    DrPodder.CurrentShareURL = null;
};

EpisodeDetailsAssistant.prototype.cleanup = function() {

    Mojo.Log.error("*** Event notice: doing cleanup");

    this.sleepTimerStop(); 
    this.setTimer(false);
    if (this.episodeObject.enclosure) {
        if (!this.isVideo()) {
            if (!this.finished) {
                var beforeSave = function() {};
                var functionWhenFinished = function() {};

                if (!this.poppingScene) {
                    Mojo.Log.warn("Closing app, we need to bookmark though!");
                    beforeSave = Util.dashboard.bind(this, DrPodder.DashboardStageName, $L({value: "Saving Bookmark", key: "savingBookmark"}),
                                                     $L({value: "Dashboard should close automatically", key: "savingBookmarkDescription"}), true);
                    functionWhenFinished = Util.closeDashboard.bind(this, DrPodder.DashboardStageName);
                }
                this.bookmark(beforeSave, functionWhenFinished);

                // remove this when we want to have continual playback
                if (this.audioObject) {
                    this.audioObject.pause();
                    this.audioObject.src = undefined;
                    this.audioObject.load();
                }
            }

            if (!this.playingNextEpisode) {
                this.player.hideDashboard();
            }

            this.audioObject.removeEventListener(Media.Event.ERROR, this.handleErrorHandler);

            this.audioObject.removeEventListener(Media.Event.PAUSE, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.PLAY, this.handleAudioEventsHandler);

            this.audioObject.removeEventListener(Media.Event.ENDED, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.ABORT, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.CANPLAY, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.CANPLAYTHROUGH, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.CANSHOWFIRSTFRAME, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.DURATIONCHANGE, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.EMPTIED, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.LOAD, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.LOADEDFIRSTFRAME, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.LOADEDMETADATA, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.LOADSTART, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.SEEKED, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.SEEKING, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.STALLED, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.WAITING, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.X_PALM_DISCONNECT, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.X_PALM_RENDER_MODE, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.X_PALM_SUCCESS, this.handleAudioEventsHandler);
            this.audioObject.removeEventListener(Media.Event.X_PALM_WATCHDOG, this.handleAudioEventsHandler);
        }
    }
};

EpisodeDetailsAssistant.prototype.bookmark = function(beforeSave, functionWhenFinished) {
    if (!this.isVideo()) {
        var cur = this.audioObject.currentTime;
        Mojo.Log.info("bookmarking %d", cur);
        if (cur !== undefined && cur !== null && cur > 15) {
            this.episodeObject.length = this.audioObject.duration;
            if (beforeSave) {beforeSave();}
            this.episodeObject.bookmark(cur, functionWhenFinished);
        }
    }
};

EpisodeDetailsAssistant.prototype.backToList = function() {
    var feed = this.episodeObject.feedObject;

    this.finished = true;

    this.episodeObject.setListened();
    this.episodeObject.clearBookmark();

    if (feed.autoDelete && this.episodeObject.downloaded) {
        this.episodeObject.deleteFile();
    }

    if (!this.playlist || this.playlist.length === 0) {
        this.controller.stageController.popScene(true);
    } else {
        this.playingNextEpisode = true;
        var episode = this.playlist.shift();
        this.controller.stageController.swapScene({name: "episodeDetails", transition: Mojo.Transition.none}, episode, {autoPlay: true, resume: true, playlist: this.playlist});
    }
};

EpisodeDetailsAssistant.prototype.setTimer = function(bool) {
    if (this.updateTimer) {
        this.controller.window.clearInterval(this.updateTimer);
        this.updateTimer = null;
    }
    //Mojo.Log.info("setTimer: set it=%s, isForeground=%s", bool, this.isForeground);
    if (bool && this.isForeground) {
        this.updateTimer = this.controller.window.setInterval(this.updateProgress.bind(this), 500);
    }
};

EpisodeDetailsAssistant.prototype.readyToPlay = function() {
    if (this.audioObject && this.audioObject.pause) {this.audioObject.pause();}

    if (this.episodeObject.file) {
        Mojo.Log.info("Setting [%s] file src to:[%s]", this.episodeObject.type, this.episodeObject.file);
        this.setStatus();
        this.audioObject.src = this.episodeObject.file;
        this.progressModel.progressStart = 0;
        this.progressModel.progressEnd = 1;
        this.controller.modelChanged(this.progressModel);
    } else {
        var url = this.episodeObject.getEnclosure();
        Mojo.Log.info("Setting [%s] stream src to:[%s]", this.episodeObject.type, url);
        this.setStatus($L("Connecting"));
        this.audioObject.src = url;
        this.progressModel.progressStart = 0;
        this.progressModel.progressEnd = 0;
        this.controller.modelChanged(this.progressModel);
    }

    this.audioObject.load();
    this.audioObject.autoplay = this.autoPlay;
    this.setTimer(true);
};

EpisodeDetailsAssistant.prototype.handleError = function(event) {
    // much of this shameless copied from http://ampache-mobile.googlecode.com/svn/trunk/src/javascript/AudioPlayer.js
    try {
        //Utilities.dump(event.currentTarget);
        var error = event.currentTarget.error;
        Mojo.Log.error("Error playing audio! code=%s; %s", error.code, event.currentTarget.currentSrc);
        var message = $L({value: "There was a problem playing the file.", key: "errorPlaying"});
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                message += "<br>" + $L({value: "The audio stream was aborted by webOS.  Most often this happens when you do not have a fast enough connection to support an audio stream.", key: "errorAborted"});
                break;
            case error.MEDIA_ERR_NETWORK:
                message += "<br>" + $L({value: "A network error has occurred.  The network cannot support an audio stream at this time.", key: "errorNetwork"});
                break;
            case error.MEDIA_ERR_DECODE:
                message += "<br>" + $L({value: "An error has occurred while attempting to play the episode.  The episode is either corrupt or an unsupported format (ex: m4p, ogg, flac).", key: "errorDecode"});
                break;
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                message += "<br>" + $L({value: "This episode is not suitable for streaming.", key: "errorNotSupported"});
                break;
        }
        Util.showError($L("Error"), message + " " +  event.currentTarget.currentSrc);

        /*
        // getErrorCode doesn't seem to be available
        if (!event.currentTarget.getErrorCode) {
            Mojo.Log.error("Error Code: unavailable since event.currentTarget.getErrorCode is null");
        }
        var errorCode = event.currentTarget.getErrorCode();
        Mojo.Log.error("errorCode=%d", errorCode);
        var errorCodeString = "Unknown: (0x" + errorCode.toString(16).toUpperCase() + ")";

        switch (Number(errorCode)) {
            case 1:
                errorCodeString = "DecodeErrorFileNotFound(1)";
                break;
            case 2:
                errorCodeString = "DecodeErrorBadParam(2)";
                break;
            case 3:
                errorCodeString = "DecodeErrorPipeline(3)";
                break;
            case 4:
                errorCodeString = "DecodeErrorUnsupported(4)";
                break;
            case 5:
                errorCodeString = "DecodeErrorNoMemory(5)";
                break;
            case 6:
                errorCodeString = "NetworkErrorHttp(6)";
                break;
            case 7:
                errorCodeString = "NetworkErrorRtsp(7)";
                break;
            case 8:
                errorCodeString = "NetworkErrorMobi(8)";
                break;
            case 9:
                errorCodeString = "NetworkErrorOther(9)";
                break;
            case 12:
                errorCodeString = "NetworkErrorPowerDown(12)";
                break;
        }

        Mojo.Log.error("Error Code: %s", errorCodeString);
        */
    } catch (f) {
        Mojo.Log.error("Exception episodedetail %s", f);
    }

    this.bookmark();
    this.enablePlay(true);
    this.setStatus();
    this.resume = true;
    this.setTimer(false);
    //this.readyToPlay();
};

EpisodeDetailsAssistant.prototype.mediaKeyPressHandler = function(event) {
    Mojo.Log.info("received mediaKeyPress: %s %j", event.key, event);
    if (event.state === 'down') {
        switch (event.key) {
            case "togglePausePlay":
            case "headset_button":
                if (this.audioObject.paused) {
                    this.play();
                } else {
                    this.pause();
                }
                break;
            case "stop":
            case "pause":
                this.pause();
                break;
            case "play":
                this.play();
                break;
            case "next":
                this.doSkip(20);
                break;
            case "prev":
                this.doSkip(-20);
                break;
            default:
                Mojo.Log.warn("Ignoring mediaKeyPress: ", event.key);
                break;
        }
    }
};

EpisodeDetailsAssistant.prototype.keyDownHandler = function(event) {
    var key = event.originalEvent.keyCode;
    switch (key) {
        case Mojo.Char.spaceBar:
            //play/pause
            if (this.audioObject.paused) {
                this.play();
            } else {
                this.pause();
            }
            break;
//      case 77: // Mojo.Char.M: 
//          this.audioObject.playbackRate = 2;
//          break;
        case Mojo.Char.period: // ff1
            this.doSkip(20);
            //this.audioObject.playbackRate = 1.5;
            break;
        case Mojo.Char.zero: // fr1
            //this.audioObject.playbackRate = .75;
            //this.audioObject.defaultPlaybackRate = .75;
            this.doSkip(-20);
            break;
        case Mojo.Char.sym: // ff2
            this.doSkip(60);
            //this.audioObject.playbackRate = 2;
            break;
        case Mojo.Char.shift: // fr2
            this.doSkip(-60);
            //this.audioObject.playbackRate = .5;
            break;
        default:
            Mojo.Log.warn("Ignoring keyCode: %s --- %j", key, event);
            break;
    }
};

EpisodeDetailsAssistant.prototype.setStatus = function(message, maxDisplay) {
    this.statusMessage = message;
    this.statusIter = 2;
    this.statusDiv.update(message);
    if (message) {
        this.statusDiv.show();
        if (!this.statusTimerID && this.controller) {
            this.statusTimerID = this.controller.window.setInterval(this.statusTimer.bind(this), 400);
        }
    } else {
        this.statusDiv.hide();
        if (this.statusTimerID && this.controller) {
            this.controller.window.clearInterval(this.statusTimerID);
            this.statusTimerID = null;
        }
    }

    this.sleepTimerStart(); 
};

EpisodeDetailsAssistant.prototype.sleepTimerStart = function(seconds) {
    if( seconds ) {
       Util.sleepRest = seconds;
    }
    if( !Util.sleepTimer && Util.sleepRest ) {
       Util.sleepTimer = this.controller.window.setInterval(this.sleepTimerHandler.bind(this), 1000);
       this.controller.get("sleepTimer").show();
       this.adjustHeader();
    }
    if( !Util.sleepTimer ) {
       if( this.controller !== undefined ) {
          this.controller.get("sleepTimer").hide();
          this.adjustHeader();
       }
    }
}

EpisodeDetailsAssistant.prototype.sleepTimerStop = function() {
    if( Util.sleepTimer ) {
       this.controller.window.clearInterval(Util.sleepTimer);
       Util.sleepTimer = null;
    }
    this.controller.get("sleepTimer").hide();
}

EpisodeDetailsAssistant.prototype.sleepTimerHandler = function() {
    if( Util.sleepRest > 0 ) {
        if (this.audioObject && !this.audioObject.paused) {
           Util.sleepRest--;
        }
        this.controller.update(this.controller.get("sleepTimer"), "Sleep Timer: " + ddMMSSString(Util.sleepRest) + " ");
    } else {
        this.sleepTimerStop();
        this.pause();
        //Util.banner("Sleep timer expired, pausing replay");
        Util.showError("Replay paused, because the Sleep Timer has expired");
    }
}

EpisodeDetailsAssistant.prototype.statusTimer = function() {
    var dots = "";
    if (Math.abs(this.statusIter-2) === 1) {
        dots = " . ";
    } else if (Math.abs(this.statusIter-2) === 2) {
        dots = " . . ";
    }
    this.statusIter = (this.statusIter+1)%4;
    this.statusDiv.update(dots + this.statusMessage + dots);
};

EpisodeDetailsAssistant.prototype.handleAudioEvents = function(event) {
    Mojo.Log.info("eda-AudioEvent: %s --- %d ", event.type, this.audioObject.currentTime);
    // During the loading process of an audio/video, the following events occur, in this order:
    // loadstart
    // durationchange
    // loadedmetadata
    // loadeddata
    // progress
    // canplay
    // canplaythrough
    // (http://www.w3schools.com/tags/av_event_canplaythrough.asp)

    switch (event.type) {
        case "load":
            this.setStatus();
            this.updateProgress();
            break;
        case "durationchange":
            // The durationchange event occurs when the duration data of the specified audio/video is changed.
            // When an audio/video is loaded, the duration will change from "NaN" to the actual duration of the audio/video.
            if (this.resume) {
                Mojo.Log.info("resuming playback at %d", this.episodeObject.position);
                try {
                    this.setStatus($L("Seeking"));
                    this.audioObject.currentTime = this.episodeObject.position + 0.001;
                    this.resume = false;
                } catch (e) {
                    Mojo.Log.error("Error resuming: setting currentTime: '%s', will retry... ", e.message);
                }
                this.updateProgress();
            }
            break;
        case "canplay":
            if (!this.resume && this.audioObject.autoplay) {
                this.setStatus($L("Buffering"));
            }
            break;
        case "canplaythrough":
            this.updateProgress();
            this.setStatus();
            this.cmdMenuModel.items[1].items[this.playPausePos].disabled = false;
            this.refreshMenu();
            break;
        case "seeked":
            if (this.audioObject.paused && !this.episodeObject.downloaded) {
                this.setStatus($L("Buffering"));
            }
            this.cmdMenuModel.items[1].items[this.playPausePos].disabled = false;
            this.refreshMenu();
            break;
        case "waiting":
            this.setStatus($L("Buffering"));
            break;
        case "play":
            this.setStatus();
            this.playGUI();
            break;
        case "pause":
            this.updateProgress();
            this.bookmark();
            this.pauseGUI();
            break;
        case "ended":
            this.backToList();
            break;
    }
};

EpisodeDetailsAssistant.prototype.handleCommand = function(event) {
    if (event.type == Mojo.Event.command) {
        switch(event.command) {
            case "download-cmd":
                //this.cmdMenuModel.items[1].items[this.playPausePos] = {};
                this.refreshMenu();
                this.download();
                break;
            case "play-cmd":
                this.play();
                break;
            case "pause-cmd":
                this.pause();
                break;
            case "delete-cmd":
                this.enablePlay();
                this.deleteFile();
                break;
            case "skipForward-cmd":
                this.doSkip(20);
                break;
            case "skipBack-cmd":
                this.doSkip(-20);
                break;
            case "skipForward2-cmd":
                this.doSkip(60);
                break;
            case "skipBack2-cmd":
                this.doSkip(-60);
                break;
            case "report-cmd":
                event.assistant = this;
                event.data = "Episode Information: <br/>" +
                    "Title: " + this.episodeObject.title + "<br/>" +
                    "Enclosure: " + this.episodeObject.enclosure + "<br/>" +
                    "Type: " + this.episodeObject.type + "<br/>" +
                    "File: " + this.episodeObject.file + "<br/><br/>" +
                    "Feed Information:<br/>" +
                    "URL: " + this.episodeObject.feedObject.url + "<br/>";
                break;
            case "share-cmd":
                var args = {episodeURL: this.episodeObject.enclosure,
                            episodeTitle: this.episodeObject.title,
                            podcastURL: this.episodeObject.feedObject.url,
                            podcastTitle: this.episodeObject.feedObject.title};
                var subject = $L({value: "Check out this podcast I found with drPodder!", key: "shareEpisodeSubject"});
                var message = $L({value: "Hi,<br/><br/>I thought you'd like to check out this nice podcast I'm enjoying in " +
                                 "<a href=\"http://www.webosarchive.com/drpodder\">drPodder Redux</a> " +
                                 "on my webOS device.<br/><br/>To download the episode, just use this link: " +
                                 "<a href=\"#{episodeURL}\">#{episodeTitle}</a><br/><br/>" +
                                 "To subscribe to this podcast yourself, copy the following link and " +
                                 "paste it into your favorite Podcatcher!<br/><br/>" +
                                 "Podcast Title: <a href=\"#{podcastURL}\">#{podcastTitle}</a><br/>" +
                                 "Podcast URL:<br/>#{podcastURL}<br/><br/>", key: "shareEpisodeBody"}).interpolate(args);
                AppAssistant.applicationManagerService.email(subject, message);
                break;
            case "copyEpisode-cmd":
                this.controller.stageController.setClipboard(this.episodeObject.enclosure);
                Util.banner($L({value:"Episode URL copied", key:"episodeURLCopied"}));
                break;
            case "copyFeed-cmd":
                this.controller.stageController.setClipboard(DrPodder.CurrentShareURL);
                Util.banner($L({value:"Feed URL copied", key:"feedURLCopied"}));
                break;
            case "playExternal-cmd":
                this.playExternal();
                break;

            case "sleeptimer-off-cmd":  this.sleepTimerStop(); break;
            case "sleeptimer-30-cmd":   this.sleepTimerStart(30); break;
            case "sleeptimer-300-cmd":  this.sleepTimerStart(300); break;
            case "sleeptimer-600-cmd":  this.sleepTimerStart(600); break;
            case "sleeptimer-1200-cmd": this.sleepTimerStart(1200); break;
            case "sleeptimer-1800-cmd": this.sleepTimerStart(1800); break;
            case "sleeptimer-2700-cmd": this.sleepTimerStart(2700); break;
            case "sleeptimer-3600-cmd": this.sleepTimerStart(3600); break;
        
        case 'cmd-backButton':
            Mojo.Log.error("** Event Notice: Back button was pressed");
            this.backTap();
            break;
        }
    } else if (event.type === Mojo.Event.back) {
        Mojo.Log.error("** Event Notice: Mojo Back event was fired");
        event.stop();
        event.stopPropagation();
        this.backTap();
    }

};

EpisodeDetailsAssistant.prototype.playGUI = function() {
    this.autoPlay = true;
    this.enablePause(true);
    this.setTimer(true);
};

EpisodeDetailsAssistant.prototype.pauseGUI = function() {
    this.autoPlay = false;
    this.setTimer(false);
    this.enablePlay();
};

EpisodeDetailsAssistant.prototype.doSkip = function(secs) {
    this.wasPlaying = !this.audioObject.paused;
    this.audioObject.currentTime += secs;
    if (this.wasPlaying) {this.audioObject.play();}
    this.updateProgress();
    this.controller.modelChanged(this.progressModel);
    this.bookmark();
};

EpisodeDetailsAssistant.prototype.sliderDragStart = function() {
    this.wasPlaying = !this.audioObject.paused;
    if (this.wasPlaying) {
        this.audioObject.pause();
    }
};

EpisodeDetailsAssistant.prototype.progressChange = function(event) {
    // need this line
    //this.audioObject.currentTime = event.value * this.audioObject.duration;
    this.updateProgress(null, event.value * this.audioObject.duration);
    this.controller.modelChanged(this.progressModel);
};

EpisodeDetailsAssistant.prototype.sliderDragEnd = function(event) {
    this.audioObject.currentTime = this.progressModel.value * this.audioObject.duration;
    this.setStatus($L("Seeking"));
    this.bookmark();
    if (this.wasPlaying) {
        this.audioObject.play();
    }
};

EpisodeDetailsAssistant.prototype.updateProgressLabels = function(currentTime) {
    this.updateProgressLabelsValues(Util.formatTime(currentTime||this.audioObject.currentTime),
                                    Util.formatTime(this.audioObject.duration-(currentTime||this.audioObject.currentTime)));
};

EpisodeDetailsAssistant.prototype.updateProgressLabelsValues = function(playbackProgress, playbackRemaining) {
    if( this.controller !== undefined ) {
       this.controller.get("playback-progress").update(playbackProgress);
       this.controller.get("playback-remaining").update(playbackRemaining);
    }
};

EpisodeDetailsAssistant.prototype.updateProgress = function(event, currentTime) {
    if (!this.isVideo()) {
        if (isNaN(this.audioObject.currentTime) ||
            !isFinite(this.audioObject.duration) || isNaN(this.audioObject.duration) || this.audioObject.duration === 0) {
            this.updateProgressLabelsValues("--:--", "--:--");
            //this.updateProgressLabelsValues("00:00", "00:00");
        } else {
            this.updateProgressLabels(currentTime);
            if (!currentTime) {
                this.progressModel.value = this.audioObject.currentTime/this.audioObject.duration;
            }
            if (!this.episodeObject.downloaded) {
                var buffered = this.audioObject.buffered;
                if (buffered !== undefined && buffered !== null) {
                    // webOS 1.4 broke this
                    //this.progressModel.progressStart = buffered.start(0)/this.audioObject.duration;
                    //Mojo.Log.info("buffered.start(0)=%d", buffered.start(0));
                    this.progressModel.progressStart = this.audioObject.currentTime/this.audioObject.duration;
                    this.progressModel.progressEnd = buffered.end(0)/this.audioObject.duration;
                }
            }
            this.controller.modelChanged(this.progressModel);
        }
    }
};

EpisodeDetailsAssistant.prototype.download = function() {
    this.stop();
};

EpisodeDetailsAssistant.prototype.deleteFile = function() {
    this.stop();
};

EpisodeDetailsAssistant.prototype.pause = function() {
    try {
        this.disablePause();
        this.audioObject.pause();
        //this.controller.window.setTimeout(this.enablePlayPause.bind(this), 10000);
    } catch (e) {
        Mojo.Log.error("Error in pause: %j", e);
    }
};

EpisodeDetailsAssistant.prototype.play = function() {
    try {
        if (this.isVideo()) {
            if (this.isForeground) {
                this.launchVideo(this.episodeObject.file || this.episodeObject.getEnclosure());
                this.controller.window.setTimeout(this.enablePlay.bind(this), 10000);
            }
        } else {
            if (this.audioObject.paused) {
                this.disablePlay();
            } 
            
            this.audioObject.play();
            //this.controller.window.setTimeout(this.enablePlayPause.bind(this), 10000);

        }
    } catch (e) {
        Mojo.Log.error("Error in play: %j", e);
    }
};

EpisodeDetailsAssistant.prototype.stop = function() {
    this.audioObject.pause();
    this.audioObject.src = null;
};

EpisodeDetailsAssistant.prototype.isVideo = function() {
    if (this.episodeObject.type !== undefined && this.episodeObject.type !== null &&
        this.episodeObject.type.indexOf("video") === 0) {
        return true;
    } else {
        return false;
    }
};

EpisodeDetailsAssistant.prototype.launchVideo = function(uri) {
   /* Drpodder way: 
    * var args = {
    *     appId: "com.palm.app.videoplayer",
    *     name: "nowplaying"
    * };
    *
    * var params = {
    *     target: uri,
    *     title: this.episodeObject.title,
    *     thumbUrl: this.episodeObject.feedObject.albumArt
    * };
    *
    * this.controller.stageController.pushScene(args, params);
    * 
    */
    
    /* podFrenzy way, 
     * works on TP acording to: http://forum.nexave.de/p444009-app-guttenpodder-noch-ein-drpodder-klon-fuers-podcasthoeren/.html#post444009 
     */
    this.controller.serviceRequest("palm://com.palm.applicationManager", {
                    method: "launch",
                    parameters: {
                        id: "com.palm.app.videoplayer",
                        params: {
                            target: uri,
                            title: this.episodeObject.title,
                            thumbUrl: this.episodeObject.feedObject.albumArt
                        }
                    }
                });
                   

    /*
     * var params = {
     *     target: uri,
     *     title: this.episodeObject.title,
     *     initialPos: 0,
     *     videoID: undefined,
     *     thumbUrl: this.episodeObject.feedObject.albumArt,
     *     isNewCard: true,
     *     captured: this.launchParams.captured,
     *     item: {
     *         videoDuration: this.launchParams.videoDuration
     *     }
     * }
     *
     * AppAssistant.VideoLibrary.Push(this.controller.stageController, AppAssistant.VideoLibrary.Nowplaying, params);
     */
 };

EpisodeDetailsAssistant.prototype.playExternal = function() {
    this.controller.serviceRequest("palm://com.palm.applicationManager", {
        method: "open",
        parameters: {
            target: this.episodeObject.file || this.episodeObject.getEnclosure()
        }
    });
};

EpisodeDetailsAssistant.prototype.titleTap = function() {
    if (this.progressInfoHidden) {
        this.header.addClassName("multi-line");
        this.progressInfo.show();
        this.updateProgress();
        this.progressInfoHidden = false;
        this.adjustHeader();
    } else {
        this.header.removeClassName("multi-line");
        this.progressInfo.hide();
        this.progressInfoHidden = true;
        this.adjustHeader();
    }
};

EpisodeDetailsAssistant.prototype.enablePlay = function(needRefresh) {
    this.setPlayPause(true, true, needRefresh);
};

EpisodeDetailsAssistant.prototype.disablePlay = function(needRefresh) {
    this.setPlayPause(true, false, needRefresh);
};

EpisodeDetailsAssistant.prototype.enablePause = function(needRefresh) {
    this.setPlayPause(false, true, needRefresh);
};

EpisodeDetailsAssistant.prototype.disablePause = function(needRefresh) {
    this.setPlayPause(false, false, needRefresh);
};

EpisodeDetailsAssistant.prototype.setPlayPause = function(isPlay, isEnabled, needRefresh) {
    
    var item;
    if (isPlay) {item = this.menuCommandItems.play;}
    else        {item = this.menuCommandItems.pause;}

    var c = this.cmdMenuModel.items[1].items[this.playPausePos];
    if (c !== item) {
        this.cmdMenuModel.items[1].items[this.playPausePos] = c = item;
        needRefresh = true;
    }

    if (c.disabled === undefined || c.disabled === isEnabled) {
        c.disabled = !isEnabled;
        needRefresh = true;
    }

    if (needRefresh) {
        this.refreshMenu();
    }
};

EpisodeDetailsAssistant.prototype.refreshMenu = function() {
    if (this.controller) {
        this.controller.modelChanged(this.cmdMenuModel);
    }
};

EpisodeDetailsAssistant.prototype.onBlur = function() {
    Mojo.Log.error("** Event notice: doing blur");
    this.bookmark();
    this.isForeground = false;
    Mojo.Log.info("onblur: isForeground = %s", this.isForeground);
    this.setTimer(false);
    if (!this.isVideo()) {
        this.player.showDashboard(this.controller.stageController);
    }

    //this.audioObject.removeEventListener(Media.Event.TIMEUPDATE, this.updateProgressHandler);
};

EpisodeDetailsAssistant.prototype.considerForNotification = function(params) {
    if (params) {
        switch (params.type) {
            case "onFocus":
                this.isForeground = true;
                Mojo.Log.info("onFocus: isForeground = %s", this.isForeground);
                this.updateProgress();
                if (!this.isVideo()) {
                    this.player.hideDashboard();
                }
                if (this.audioObject && this.audioObject.paused !== true) {
                    this.setTimer(true);
                }
                // timeupdate STILL doesn't work 100%
                // get your fraking act together, PALM!!!
                // this.audioObject.addEventListener(Media.Event.TIMEUPDATE, this.updateProgressHandler);

                break;
            case "shutupJSLint":
                break;
        }
    }
};
