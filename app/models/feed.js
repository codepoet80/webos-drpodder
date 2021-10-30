        
var UPDATECHECK_INVALID = -1;
var UPDATECHECK_NOUPDATES = 0;
var UPDATECHECK_UPDATES = 1; // maybe number of updates would be better?

function FeedModel(init) {
}

var feedModel = new FeedModel();
//var pickuplist = new Feed();

function Feed(init) {
    if (init) {
        this.id = init.id;
        this.displayOrder = init.displayOrder;
        this.url = init.url;
        this.title = init.title;
        this.albumArt = init.albumArt;
        if (this.albumArt && this.albumArt.substring(0, 15) === "/media/internal") {
            this.albumArt = this.albumArt.substring(15);
        }
        this.maxDisplay = init.maxDisplay;
        this.autoDownload = init.autoDownload;
        this.autoDelete = init.autoDelete;
        this.maxDownloads = init.maxDownloads;
        this.episodes = init.episodes;
        this.guid = init.guid;
        this.interval = init.interval;
        this.lastModified = init.lastModified;
        this.details = init.details;
        this.replacements = init.replacements;
        this.downloading = init.downloading;
        this.downloadCount = init.downloadCount;
        this.viewFilter = init.viewFilter;
        this.username = init.username;
        this.password = init.password;
        this.hideFromOS = init.hideFromOS;
        this.maxEpisodes = init.maxEpisodes;

        this.numNew = init.numNew;
        this.numDownloaded = init.numDownloaded;
        this.numStarted = init.numStarted;
        this.isLocalMedia = this.url && (this.url.indexOf("media://") === 0);
        this.playlist     = this.url && (this.url.indexOf("drPodder://") === 0);
                
        if (this.playlist) {
            var feedIds = this.url.substring(11);
            if (feedIds.length === 0) {
                this.feedIds = [];
            } else {
                this.feedIds = feedIds.split(",");
            }
            feedModel.items.forEach(function (f) {
                if (this.feedIds.length === 0 ||
                    this.feedIds.some(function(id) {return f.id == id;}.bind(this))) {
                    f.playlists.push(this);
                    f.episodes.forEach(function(e) {
                        this.insertEpisodeTop(e);
                    }.bind(this));
                }
            }.bind(this));
        }

    } else {
        this.url = null;
        this.title = null;
        this.albumArt = null;
        this.maxDisplay = 20;
        this.autoDownload = false;
        this.autoDelete = true;
        this.maxDownloads = 1;
        this.episodes = [];
        this.guid = [];
        this.interval = 60000;
        this.lastModified = null;
        this.details = null;
        this.replacements = "";
        this.downloading = false;
        this.downloadCount = 0;
        this.viewFilter = "New";
        this.username = null;
        this.password = null;
        this.hideFromOS = 1;
        this.maxEpisodes = 0;

        this.numNew = 0;
        this.numDownloaded = 0;
        this.numStarted = 0;
        this.feedIds = [];
    }

    this.playlists = [];

    if (!this.playlist) {
        feedModel.items.forEach(function (f) {
            if (f.playlist && (f.feedIds.length === 0 || f.feedIds.some(function(id) {return this.id == id;}.bind(this)))) {
                this.playlists.push(f);
            }
        }.bind(this));
    }

    this.pathFilterExp ="";
    this.titleFilterExp ="";
    this.filterMode = "and";
    if (this.isLocalMedia) {
        Mojo.Log.info("make feed from url %s", this.url);
    
        var sTmp = this.url.substr(8);
        if( sTmp.indexOf("&&") >=0 ) {
            this.filterMode = "and" ;
            sTmp = sTmp.split("&&");  // media://titleexpression&&filenamexpression
            this.titleFilterExp  = sTmp[0];
            this.pathFilterExp = sTmp[1];
        } else { 
            this.filterMode = "or";
            if( sTmp.indexOf("||") >=0 ) {
                sTmp = sTmp.split("||");  // media://titleexpression||filenamexpression
                this.titleFilterExp = sTmp[0];
                this.pathFilterExp  = sTmp[1];
            } else { 
                this.filterMode = "title";
                this.titleFilterExp = sTmp;
                this.pathFilterExp  = "";
            }
            if ( this.titleFilterExp.length === 0 ) { this.filterMode = 'path'; }
            if ( this.pathFilterExp.length === 0 ) { this.filterMode = 'title'; }
        }
        if ( this.titleFilterExp.length === 0 &&  this.pathFilterExp.length === 0 ) { this.filterMode = 'none'; }
        Mojo.Log.info(" ... - '%s' %s '%s'", this.titleFilterExp, this.filterMode, this.pathFilterExp);
    }
}


Feed.prototype.updateAndDownload = function() {
    this.update(
       this.download.bind(this) // if autodownload is enabled for this
    );
}

Feed.prototype.update = function(callback, url, reveal) {
    this.updating = true;
    this.updated(reveal);
    if (!callback) {callback = function() {};}
    if (this.playlist) {
        Mojo.Log.info("updating playlist %s", this.url);
        this.updateFeedIds(0, function() {
            this.updating = false;
            this.updated();
            callback();
        }.bind(this));
    } else if (this.isLocalMedia) {
        Mojo.Log.info("updating local media %s", this.url);
        this.updateMedia(function() {
            this.updating = false;
            this.updated();
            callback();
        }.bind(this));    
    } else {
        Mojo.Log.info("updating rss feed %s", this.url);
        if (!url) {
            var feedTitle = (this.title)?this.title:"Unknown feed title";
            Util.dashboard(DrPodder.DashboardStageName, $L({value: "Updating Feed", key: "updatingFeed"}), feedTitle, true);
            Mojo.Log.info("Update: ", feedTitle, "(", this.url, ")");
            url = this.url;
        }

        if (this.username) {
            url = url.replace(/http(s?):\/\//, "http$1://" +
                            encodeURIComponent(this.username) + ":" +
                            encodeURIComponent(this.password) + "@");
        }

        Mojo.Log.info("making ajax request [%s]", url);
        var req = new Ajax.Request(url, {
            method: "get",
            evalJSON : "false",
            evalJS : "false",
            requestHeaders : {
                "X-Requested-With": undefined
            },
            onFailure: this.checkFailure.bind(this, callback),
            onSuccess: this.checkSuccess.bind(this, callback)
            
           // onCreate:   function(){ Mojo.Log.info("*** onCreate ajax request")},
           // onLoading:  function(){ Mojo.Log.info("*** onLoading ajax request")},
           // onLoaded:   function(){ Mojo.Log.info("*** onLoaded ajax request")},
           // on404:      function(){ Mojo.Log.info("*** on404")},
           // onComplete: function(){ Mojo.Log.info("*** onComplete") }
        });
        // Mojo.Log.info("finished making ajax request");
    }
};

Feed.prototype.updateFeedIds = function(feedIndex, callback) {
    if (!feedIndex) { feedIndex = 0; }
    var feedIds = this.feedIds;
    if (feedIds.length === 0) {
        feedModel.items.forEach(function(f) {
            if (!f.playlist) {
                feedIds.push(f.id);
            }
        });
    }

    /* if somehow, a playlist can point to other playlists... we should update them
    while (feedIndex < this.feedIds.length &&
           feedModel.getFeedById(this.feedIds[feedIndex]).playlist) {
        ++feedIndex;
    }
    */
    if (feedIndex < this.feedIds.length) {
        var feed = feedModel.getFeedById(this.feedIds[feedIndex]);

        feed.update(function() {
            feed.updated();
            feed.updatedEpisodes();
            this.updateFeedIds(feedIndex+1, callback);
        }.bind(this));
    } else {
        this.updating = false;
        callback();
    }
};

Feed.prototype.updateMedia = function(callback) {
     var self = this;  
     Mojo.Log.info('calling media indexer ...');  
     var stageController = Mojo.Controller.getAppController().getActiveStageController();
     var currentScene = stageController.activeScene();

     currentScene.serviceRequest('palm://com.palm.db', {  
         method: 'find',  
         parameters: {  
             query: {  
                 from: "com.palm.media.audio.file:1" ,  
                 // from: [ "com.palm.media.audio.file:1", "com.palm.media.video.file:1" ],  
                 limit: 500
             }  
         },  
         onSuccess: function(e) {  
              Mojo.Log.info('We have media permission.');  
              var results = e.results;
              self.media2episode(results, callback);  
         },  
         onFailure: function(e) {  
             Mojo.Log.info("find failure! Err = %j ", e);
             Mojo.Log.info('We do not have permission.');  
             self.requestPermission( function() {
                   self.updateMedia(callback);  
                }.bind(self),
                function() {      //failfunction
                   callback();
                }.bind(self)
             );
         }  
     });  
};

Feed.prototype.requestPermission = function (cbPermission, cbFail) { 
// delete Permission: luna-send -n 1 -a com.palm.filenotifyd.js palm://com.palm.db/del '{"query":{"from":"com.palm.media.permissions:1"}}'
// query permissions: luna-send -n 1 -f -a com.palm.filenotifyd.js palm://com.palm.db/find '{"query":{"from":"com.palm.media.permissions:1"}}'
     Mojo.Log.info('requesting media permission...');  
     var stageController = Mojo.Controller.getAppController().getActiveStageController();
     var currentScene = stageController.activeScene(); 
     var didRequest = true; 
     var self=this;
     var ret = currentScene.serviceRequest('palm://com.palm.mediapermissions', {  
        method: 'request',  
        parameters: {  
            rights: {  
                    read: [
                        "com.palm.media.audio.file:1",
                       // "com.palm.media.video.file:1"  
                    ]  
            }  
        },  
        onFailure: function(response) {
           Mojo.Log.info("on fail=%j", response);
           self.mediaPermissionError(response);
        },
        onComplete: function(response) {  
            Mojo.Log.info('completed requestPermission; %j',response);  
            // this function is sometimes called more than once ... 
            if( didRequest ) {  // or   if( response.returnValue ) ... 
                didRequest = false;
                if (response.returnValue && response.isAllowed) {  
                   Mojo.Log.info('Got media permissions');
                   cbPermission();
                } else {          
                   Mojo.Log.error('Failed to get permissions');  
                   self.mediaPermissionError(response);
                   cbFail();
                }  
            }
        }  
    });
}

Feed.prototype.mediaPermissionError = function(response) {
    Util.showError('No media permission', 
                   'drPodder can not access local files.'
                 + ' Hint: local file access does not work with webOS 1.x.x. '
                   + response.errorText 
                  );
}

Feed.prototype.hasMatch = function(title, path) {
    // Mojo.Log.info ( "---- Match? ------- " + this.filterMode +"----" + title.toLowerCase() + "----" + path );
    if (!this.hideFromOS && ((path.length>0) && (path.toLowerCase().startsWith('/media/internal/drpodder/')))) {
        // Mojo.Log.error ( " - nope ---- " );
        return false; // we do not want our own files here
    }
    if( path === undefined ) { path = ""; }

    // Mojo.Log.error ( " -  title index   " + title.toLowerCase().indexOf(this.titleFilterExp.toLowerCase()) + " - " + title.toLowerCase());
    // Mojo.Log.error ( " -  path index    " + path.toLowerCase().indexOf(this.pathFilterExp.toLowerCase() )  + " - " + path.toLowerCase() );
    // Mojo.Log.error ( " -- titletest     " + ((this.titleFilterExp.length !== 0) && (title.toLowerCase().indexOf(this.titleFilterExp.toLowerCase()) >= 0)));
    // Mojo.Log.error ( " -- pathtest      " + ((this.pathFilterExp.length  !== 0) && (path.toLowerCase().indexOf(this.pathFilterExp.toLowerCase()  ) >= 0)));

    if (this.filterMode == "and") {
       return (   ((this.titleFilterExp.length !== 0) && (title.toLowerCase().indexOf(this.titleFilterExp.toLowerCase()) >= 0))
               && ((this.pathFilterExp.length  !== 0) && (path.toLowerCase().indexOf(this.pathFilterExp.toLowerCase()  ) >= 0))
              );
    }
    if (this.filterMode == "or") {
       return (  ((this.titleFilterExp.length !== 0) && (title.toLowerCase().indexOf(this.titleFilterExp.toLowerCase()) >= 0))
               || ((this.pathFilterExp.length !== 0) && (path.toLowerCase().indexOf(this.pathFilterExp.toLowerCase()  ) >= 0))
              );
    }
    if (this.filterMode == "path") {
       return (  ((this.pathFilterExp.length !== 0) && (path.toLowerCase().indexOf(this.pathFilterExp.toLowerCase()  ) >= 0))
              );
    }
    if (this.filterMode == "title") {
       return (  ((this.titleFilterExp.length !== 0) && (title.toLowerCase().indexOf(this.titleFilterExp.toLowerCase()) >= 0))
              );
    }
    // none
    return true;
}


Feed.prototype.media2episode = function(arrAudioFile,callback) {
    var updateCheckStatus = UPDATECHECK_NOUPDATES;
    var self = this;

    Mojo.Log.info("%d files found; media filter '%s' %s '%s'  ....   %s",
                  arrAudioFile.length, 
                  this.titleFilterExp, this.filterMode, this.pathFilterExp,
                  this.hideFromOS 
    );

    // check weather existing Episodes still match
    this.episodes.forEach(function(e) {
        if (!self.hasMatch(e.title, e.enclosure)) {
           Mojo.Log.warn("removing episode not matching anymore: '%s' - '%s'", e.title, e.enclosure);
           self.guid[e.guid] = undefined;
           e.remove(false);
        } else {
           // mark: do the episode still exist on device?
           e.tmpRemoveMark = true;
        }
    });

    // filtering episodes 
    for (i=0; arrAudioFile[i] != null; i++) {
       if( arrAudioFile[i].isRingtone ) {
          Mojo.Log.info("ignoring ringtone #"+i+"  path ="+ arrAudioFile[i].path);
       } else {
          var retBool = this.hasMatch(arrAudioFile[i].title, arrAudioFile[i].path);
          if (!retBool) {
             Mojo.Log.info(" filter ignored: "+ arrAudioFile[i].title);
          } else {
             Mojo.Log.info(" filter success: "+ arrAudioFile[i].title);
             //  Utilities.dump(arrAudioFile[i]);

             Feed.newDate = new Date();
             // construct a new Episode based on the existing audiofile
             var episode = new Episode();
             episode.makeFromAudioFile(arrAudioFile[i]);

             var e = this.guid[episode.guid];

             Mojo.Log.info("looking for GUID: %s, found %s", episode.guid, e);
             if (e === undefined) {
                 Mojo.Log.info("new episode");
                 episode.newlyAddedEpisode = true;
                 episode.feedId = this.id;
                 episode.feedObject = this;
                 episode.albumArt = this.albumArt;
                 if (!episode.enclosure) {episode.listened = true; }
                 this.insertEpisodeTop(episode);
                 episode.updateUIElements(true);
                 updateCheckStatus = UPDATECHECK_UPDATES;
                 this.addToPlaylistsTop(episode);
             } else {
                 Mojo.Log.info("exisiting episode");
                 // it already exists, check that the enclosure url is up to date
                 e.title = episode.title;
                 e.pubDate = episode.pubDate;
                 e.description = episode.description;
                 e.link = episode.link;
                 if (episode.enclosure && e.enclosure !== episode.enclosure) {
                     var hadEnclosure = e.enclosure;
                     e.enclosure = episode.enclosure;
                     if (!hadEnclosure) { e.listened = false; this.numNew++; e.updateUIElements(true); }
                 }
                 e.type = episode.type;
                 e.tmpRemoveMark = undefined;
             }
          }
      }
   }
   
   this.episodes.forEach(function(e) {
        if( e.tmpRemoveMark == true ) {
           // remove no longer existing episode
           e.tmpRemoveMark = undefined;
           Mojo.Log.warn("removing episode not longer exists as file: '%s' - '%s'", e.title, e.enclosure);
           self.guid[e.guid] = undefined;
           e.remove(false);
        }
   });

   // count 'em
   this.numNew = this.numDownloaded = this.numStarted = 0;
   this.episodes.forEach(function(e) {
       if (!e.listened)  {++self.numNew;}
       if (e.downloaded) {++self.numDownloaded;}
       if (e.position)   {++self.numStarted;}
   }.bind(this));

   if( updateCheckStatus == UPDATECHECK_UPDATES ) {  // feed has changed       
      Mojo.Log.info("update check success media - new updates" );
      this.sortEpisodesAndPlaylists();
      this.updating = false;
      this.updated();
      this.updatedEpisodes();
      DB.saveFeed(this, undefined, callback);
   } else {
      Mojo.Log.info("update check success media - no new updates" );
      if( callback ) {
         callback();
      }
   }
 
   return updateCheckStatus;
};


Feed.prototype.download = function(callback, url) {
    this.getEpisodesToDownload().forEach(function (e) {
        e.download();
    });
};

Feed.prototype.getEpisodesToDownload = function() {
    var eps = [];
    if (this.playlist) {
        this.feedIds.forEach(function (fid) {
            eps = eps.concat(feedModel.getFeedById(fid).getEpisodesToDownload());
        });
    } else if (this.autoDownload) {
        var downloaded = 0;
        this.episodes.forEach(function (e) {
            if (e.downloaded) {
                if (this.maxDownloads > 0 && downloaded >= this.maxDownloads &&
                    !e.position) {
                    e.deleteFile();
                } else {
                    ++downloaded;
                }
            } else if (e.downloading) {
                ++downloaded;
            } else if ((this.maxDownloads == "0" || downloaded < this.maxDownloads) &&
                       !e.listened && !e.downloadTicket && e.enclosure) {
                eps.push(e);
                ++downloaded;
            }
        }.bind(this));
    }
    return eps;
};

Feed.prototype.checkFailure = function(callback, transport) {
    //Utilities.dump(transport);
    Mojo.Log.error("Failed to request feed:", this.title, "(", this.url, ")");
    this.updating = false;
    this.updated();
    this.updatedEpisodes();
    callback();
};

Feed.prototype.checkSuccess = function(callback, transport) {
    //Mojo.Log.info("check success %d %s", (new Date()).getTime()-this.ajaxStartDate, transport);
    //Mojo.Log.info("check success 1 %s", JSON.stringify(transport) );
    var location = transport.getHeader("Location");
    if (location) {  //Redirection 
        Mojo.Log.info("check success redirection to %s", location );
        Utilities.dump(location);
        this.update(callback, location);
    } else {
        Mojo.Log.info("check success without redirection" );
        this.updateCheck(transport);
        this.updating = false;
        this.updated();
        this.updatedEpisodes();
        DB.saveFeed(this, undefined, callback);
    }
};

Feed.prototype.updateCheck = function(transport) {
    var lastModified = transport.getHeader("Last-Modified");
    var updateCheckStatus = UPDATECHECK_NOUPDATES;

    /* if (lastModified !== null && this.lastModified === lastModified) {
     *   return updateCheckStatus;
     * } 
     */

    this.lastModified = lastModified;

    if (this.isRssFeed(transport)) {
        updateCheckStatus = this.parseRssFeed(transport);
    } else if (this.isJSONFeed(transport)) {
        updateCheckStatus = this.parseJSONFeed(transport);
    } else {
        if (this.gui) {
            Util.showError($L({value: "Error determining feed type", key: "feedTypeError"}), 
            $L({value: "Could not determine feed type for: ", key: "feedTypeErrorDetail"}) + this.url);
        }
        Mojo.Log.error("Error determing feed type for %s", this.url);
        updateCheckStatus = UPDATECHECK_INVALID;
    }

    this.sortEpisodesAndPlaylists();
    //Mojo.Log.error("documentProcessing: %d", (new Date()).getTime() - start);
    //this.episodes.splice(this.maxDisplay);

    return updateCheckStatus;
};

Feed.prototype.validateXML = function(transport){
    // Convert the string to an XML object
    if (!transport.responseXML) {
        Mojo.Log.warn("responseXML was empty, populating");
        //var start = (new Date()).getTime();
        transport.responseXML = (new DOMParser()).parseFromString(transport.responseText, "text/xml");
        //Mojo.Log.error("document parse: %d", (new Date()).getTime() - start);
    }
};

Feed.prototype.isRssFeed = function(transport) {
    this.validateXML(transport);
    var rssPath = "/rss";
    var isRss = false;

    try {
        var nodes = document.evaluate(rssPath, transport.responseXML, null, XPathResult.ANY_TYPE, null);
        var node = nodes.iterateNext();
        if (node) {
            isRss = true;
        }
    } catch (e) {
        isRss = false;
    }
    Mojo.Log.info("isRssFeed = %s", isRss);
    return isRss;

};

Feed.prototype.isJSONFeed = function(transport) {
    var isJSON = false;
    Mojo.Log.warn("isJSON = %s", isJSON);
    return isJSON;
};


Feed.prototype.parseRssFeed = function(transport) {
    var updateCheckStatus = UPDATECHECK_NOUPDATES;
    var itemPath = "/rss/channel/item";

    Mojo.Log.info("parseRssFeed");

    if (this.title === undefined || this.title === null) {
        this.title = this.getTitle(transport);
        if (this.title === undefined || this.title === null) {
            return UPDATECHECK_INVALID;
        }
    }

    if (this.albumArt === undefined || this.albumArt === null || this.albumArt === "") {
        this.albumArt = this.getAlbumArt(transport);
    }

    if (this.albumArt !== undefined && this.albumArt !== null &&
        this.albumArt.indexOf("http://") === 0) {
        // if we currently point to a picture on the net, download it so we can resize on display
        var ext = ".JPG";
        if (this.albumArt.toLowerCase().indexOf(".jpg") > 0) {ext=".JPG";}
        if (this.albumArt.toLowerCase().indexOf(".bmp") > 0) {ext=".BMP";}
        if (this.albumArt.toLowerCase().indexOf(".png") > 0) {ext=".PNG";}
        if (this.albumArt.toLowerCase().indexOf(".gif") > 0) {ext=".GIF";}
        var newAlbumArt = Util.escapeSpecial(this.title) + ext;
        this.downloadRequest = AppAssistant.downloadService.download(
            null, this.albumArt, ".albumArt", newAlbumArt,
            function(event) {
                if (event.completed) {
                    this.albumArt = "/drPodder/.albumArt/" + newAlbumArt;
                    this.save();
                    Mojo.Controller.getAppController().sendToNotificationChain({
                        type: "feedUpdated", feed: this});
                }
            }.bind(this));
    }


    //need to evaluate difference between iterator processing and xpath processing
    // although, the real slowdown seems to be in getting the xml from the server (probably the parsing of the xml)
    //var numItems = Util.xpath("/rss/channel/item[last()]/@index", transport.responseXML).value;
    // how would I get the number of item entries?

    //var start = (new Date()).getTime();
    nodes = document.evaluate(itemPath, transport.responseXML, null, XPathResult.ANY_TYPE, null);
    //Mojo.Log.error("document evaluate: %d", (new Date()).getTime() - start);

    if (!nodes) {
        //Util.showError("Error parsing feed", "No items found in feed");
        return UPDATECHECK_INVALID;
    }

    var result = nodes.iterateNext();
    //while (result && this.episodes.length < this.maxDisplay) {

    Feed.newDate = new Date();
    while (result) {
        // construct a new Episode based on the current item from XML
        var episode = new Episode();
        //var start2 = (new Date()).getTime();
        episode.loadFromXML(result);
        //Mojo.Log.error("loadFromXML: %d", (new Date()).getTime() - start2);

        var e = this.guid[episode.guid];
        //Mojo.Log.info("looking for GUID: %s, found %s", episode.guid, e);
        if (e === undefined) {
            episode.newlyAddedEpisode = true;
            episode.feedId = this.id;
            episode.feedObject = this;
            episode.albumArt = this.albumArt;
            if (!episode.enclosure) {episode.listened = true; }
            this.insertEpisodeTop(episode);
            episode.updateUIElements(true);
            updateCheckStatus = UPDATECHECK_UPDATES;
            this.addToPlaylistsTop(episode);
        } else {
            // it already exists, check that the enclosure url is up to date
            e.title = episode.title;
            e.pubDate = episode.pubDate;
            e.description = episode.description;
            e.link = episode.link;
            if (episode.enclosure && e.enclosure !== episode.enclosure) {
                var hadEnclosure = e.enclosure;
                e.enclosure = episode.enclosure;
                if (!hadEnclosure) { e.listened = false; this.numNew++; e.updateUIElements(true); }
            }
            e.type = episode.type;
        }
        result = nodes.iterateNext();
    }

    return updateCheckStatus;
};


Feed.prototype.parseJSONFeed = function(transport) {
    var updateCheckStatus = UPDATECHECK_NOUPDATES;
    var htmlPath = "/html/@xmlns";

    Mojo.Log.info("parseJSONFeed");

    if (this.title === undefined || this.title === null || this.title === "") {
        this.title = this.getJSONTitle(transport);
        if (!this.title) {
            return UPDATECHECK_INVALID;
        }
    }

    if (this.albumArt === undefined || this.albumArt === null || this.albumArt === "") {
        this.albumArt = this.getJSONAlbumArt(transport);
    }

    if (this.albumArt !== undefined && this.albumArt !== null &&
        this.albumArt.indexOf("http://") === 0) {
        // if we currently point to a picture on the net, download it so we can resize on display
        var ext = ".JPG";
        if (this.albumArt.toLowerCase().indexOf(".jpg") > 0) {ext=".JPG";}
        if (this.albumArt.toLowerCase().indexOf(".bmp") > 0) {ext=".BMP";}
        if (this.albumArt.toLowerCase().indexOf(".png") > 0) {ext=".PNG";}
        if (this.albumArt.toLowerCase().indexOf(".gif") > 0) {ext=".GIF";}
        var newAlbumArt = Util.escapeSpecial(this.title) + ext;
        this.downloadRequest = AppAssistant.downloadService.download(
            null, this.albumArt, ".albumArt", newAlbumArt,
            function(event) {
                if (event.completed) {
                    this.albumArt = "/drPodder/.albumArt/" + newAlbumArt;
                    this.save();
                    Mojo.Controller.getAppController().sendToNotificationChain({
                        type: "feedUpdated", feed: this});
                }
            }.bind(this));
    }


    //var start = (new Date()).getTime();
    nodes = document.evaluate(itemPath, transport.responseXML, null, XPathResult.ANY_TYPE, null);
    //Mojo.Log.error("document evaluate: %d", (new Date()).getTime() - start);

    if (!nodes) {
        //Util.showError("Error parsing feed", "No items found in feed");
        return UPDATECHECK_INVALID;
    }

    var result = nodes.iterateNext();
    //while (result && this.episodes.length < this.maxDisplay) {

    Feed.newDate = new Date();
    while (result) {
        // construct a new Episode based on the current item from XML
        var episode = new Episode();
        //var start2 = (new Date()).getTime();
        episode.loadFromXML(result);
        //Mojo.Log.error("loadFromXML: %d", (new Date()).getTime() - start2);

        var e = this.guid[episode.guid];
        if (e === undefined) {
            episode.newlyAddedEpisode = true;
            episode.feedId = this.id;
            episode.feedObject = this;
            episode.albumArt = this.albumArt;
            if (!episode.enclosure) {episode.listened = true;}
            this.insertEpisodeTop(episode);
            episode.updateUIElements(true);
            updateCheckStatus = UPDATECHECK_UPDATES;
            this.addToPlaylistsTop(episode);
        } else {
            // it already exists, check that the enclosure url is up to date
            e.title = episode.title;
            e.pubDate = episode.pubDate;
            e.description = episode.description;
            e.link = episode.link;
            if (episode.enclosure) { e.enclosure = episode.enclosure; }
            e.type = episode.type;
        }
        result = nodes.iterateNext();
    }

    return updateCheckStatus;
};


Feed.prototype.getTitle = function(transport) {
    var titlePath = "/rss/channel/title";
    this.validateXML(transport);

    var title;
    try {
        var nodes = document.evaluate(titlePath, transport.responseXML, null, XPathResult.ANY_TYPE, null);
        if (nodes) {
            var node = nodes.iterateNext();
            if (node) {
                title = "";
                var firstChild = node.firstChild;
                if (firstChild) {
                    title = firstChild.nodeValue;
                    title = title.replace(/\n/g, '').replace(/\t/g, '').replace(/^\s*/, '').replace(/\s*$/, '');
                    Mojo.Log.info("title: %s", title);
                }
            }
        }
    } catch (e) {
        // bring this back once feed add dialog is its own page
        if (this.gui) {
            Util.showError($L({value: "Error parsing feed", key: "parseFeedError"}), $L({value: "Could not find title in feed: ", key: "parseFeedErrorDetail"}) + this.url);
        }
        Mojo.Log.error("Error finding feed title: %j", e);
    }
    if (title === undefined || title === null) {
        if (this.gui) {
            Util.showError($L({value: "Error parsing feed", key: "parseFeedError"}), $L({value: "Could not find title in feed: ", key: "parseFeedErrorDetail"}) + this.url);
        }
        Mojo.Log.error("Error finding feed title for feed: %s", this.url);
    }
    return title;
};

Feed.prototype.getJSONTitle = function(transport) {
    //var titlePath = "/html/body/h1";
    //var titlePath = "/html/body/div/div/div/div/h1";
    var titlePath = "//h1";
    this.validateXML(transport);

    var title;
    try {
        Mojo.Log.info("finding title");
        Util.dumpXml(transport.responseXML);

    } catch (e) {
        // bring this back once feed add dialog is its own page
        if (this.gui) {
            Util.showError($L({value: "Error parsing JSON feed", key: "parseJSONError"}), $L({value: "Could not find title in JSON feed: ", key: "parseJSONErrorDetail"}) + this.url);
        }
        Mojo.Log.error("Error finding JSON feed title: %j", e);
    }
    /*
    try {
        Mojo.Log.info("finding title");
        var nodes = document.evaluate(titlePath, transport.responseXML, null, XPathResult.ANY_TYPE, null);
        Mojo.Log.info("nodes: %s", nodes);
        Mojo.Log.info("nodes.resultType: %s", nodes.resultType);
        if (nodes) {
            var node = nodes.iterateNext();
            Mojo.Log.info("node: %s", node);
            if (node) {
                var firstChild = node.firstChild;
                Mojo.Log.info("firstChild: %s", firstChild);
                if (firstChild) {
                    title = firstChild.nodeValue;
                    Mojo.Log.info("itunes title: %s", title);
                }
            }
        }
    } catch (e) {
        // bring this back once feed add dialog is its own page
        if (this.gui) {
            Util.showError("Error parsing JSON feed", "Could not find title in JSON feed: " + this.url);
        }
        Mojo.Log.error("Error finding JSON feed title: %j", e);
    }
    */
    if (!title) {
        if (this.gui) {
            Util.showError($L({value: "Error parsing JSON feed", key: "parseJSONError"}), $L({value: "Could not find title in JSON feed: ", key: "parseJSONErrorDetail"}) + this.url);
        }
        Mojo.Log.error("Error finding JSON feed title for feed: %s", this.url);
    }
    return title;
};

Feed.prototype.getAlbumArt = function(transport) {
    var imagePath = "/rss/channel/image/url";
    this.validateXML(transport);

    try {
        var nodes = document.evaluate(imagePath, transport.responseXML, null, XPathResult.ANY_TYPE, null);
        var imageUrl = "";
        var node = nodes.iterateNext();
        if (node === undefined || node === null) {
            // ugh, nonstandard rss, try to find the itunes image
            var xpe = transport.responseXML.ownerDocument || transport.responseXML;
            var nsResolver = xpe.createNSResolver(xpe.documentElement);
            //var nsResolver = document.createNSResolver( transport.responseXML.ownerDocument === null ? transport.responseXML.documentElement : transport.responseXML.ownerDocument.documentElement );
            imagePath = "/rss/channel/itunes:image/@href";
            nodes = document.evaluate(imagePath, transport.responseXML, nsResolver, XPathResult.ANY_TYPE, null);
            node = nodes.iterateNext();
        }
        if (node) {
            var firstChild = node.firstChild;
            if (firstChild) {
                imageUrl = firstChild.nodeValue;
            }
        }
    } catch (e) {
        Mojo.Log.error("Error finding feed image: %j", e);
    }

    return imageUrl;
};


Feed.prototype.sortEpisodesAndPlaylists = function() {
      this.sortEpisodes();
      this.playlists.forEach(function(f) {
           f.sortEpisodes();
      });
}

Feed.prototype.sortEpisodes = function() {
    //Mojo.Log.info("Sorting mode %i / %i feed:  %s", this.maxEpisodesOriginal, this.maxEpisodes, this.title);

    // maxEpisodes is an alias for 'sortMode'; yeah, bad design.
    var self = this;
    if ((this.maxEpisodes == 2) | (this.maxEpisodes == 3) | (this.maxEpisodes == 5) ) {
        // apply manual substitution           
        this.episodes.forEach(function(e) {
            if (e.title) {
               e.titleFormatted = self.replace(e.title);  
            } else {
               e.titleFormatted = "";
            }
            // if (e.title != e.titleFormatted ) {
            //     Mojo.Log.info("replaced: %s -> %s", e.title, e.titleFormatted);
            // }
        });
    }

    if (this.maxEpisodes == 5) { 
        // apply numeric guess
        var aRegexp =  /\d+[.]*\d*/;
        try {
           this.episodes.forEach(function(e) {
              if( !e.titleNumber ) {
                 e.titleNumber = 9999999;
                 if (e.titleFormatted) {
                    e.titleNumber = parseFloat(e.titleFormatted.match(aRegexp));
                    // Mojo.Log.info("numGuess: '%s' --> %s", e.titleFormatted, e.titleNumber);
                 }
              }
           })

        } catch(ex) {
           Mojo.Log.error( "exeception numguess  " + ex);
        }
    }

    if (this.maxEpisodes == -1) { this.episodes.sort(this.sortEpisodesManualOrder); } 
    if (this.maxEpisodes == 0) { this.episodes.sort(this.sortEpisodesFunc0); } // pubdate, desc
    if (this.maxEpisodes == 1) { this.episodes.sort(this.sortEpisodesFunc1); } // pubdate, asc
    if (this.maxEpisodes == 2) { this.episodes.sort(this.sortEpisodesFunc2); } // title  
    if (this.maxEpisodes == 3) { this.episodes.sort(this.sortEpisodesFunc3); } // title
    if (this.maxEpisodes == 4) { this.episodes.sort(this.sortEpisodesFunc4); }
    if (this.maxEpisodes == 5) { this.episodes.sort(this.sortEpisodesFuncTextNumericAsc); }
    if (this.maxEpisodes == 6) { this.episodes.sort(this.sortEpisodesFunc6); }

    if (this.episodes.length > 0) { this.details = this.episodes[0].title; }
    this.updated();
    this.updatedEpisodes();
};


Feed.prototype.sortEpisodesManualOrder = function(a,b) {
    return a.displayOrder - b.displayOrder;
}

Feed.prototype.sortEpisodesFunc0 = function(a,b) {
    ///         {label: "publication date, newest first", value: 0},
    if ((b.pubDate - a.pubDate) === 0) {
       return a.displayOrder - b.displayOrder;
    }
    return (b.pubDate - a.pubDate);
}

Feed.prototype.sortEpisodesFunc1 = function(a,b) {
    ///         {label: "publication date, oldest first", value: 1},
    if ((b.pubDate - a.pubDate) === 0) {
       return b.displayOrder - a.displayOrder;
    }
    return (a.pubDate - b.pubDate);
}

Feed.prototype.sortEpisodesFunc2 = function(a,b) {
    ///         {label: "title ", value: 2}
    if (a.titleFormatted == b.titleFormatted) return a.displayOrder - b.displayOrder;
    if (a.titleFormatted < b.titleFormatted) return -1;
    if (a.titleFormatted > b.titleFormatted) return 1;
}

Feed.prototype.sortEpisodesFunc3 = function(a,b) {
    ///         {label: "title descending", value: 3}
    if (a.titleFormatted == b.titleFormatted) return b.displayOrder - a.displayOrder;
    if (a.titleFormatted > b.titleFormatted) return -1;
    if (a.titleFormatted < b.titleFormatted) return 1;
}

Feed.prototype.sortEpisodesFunc4 = function(a,b) {
    ///         {label: "path descending", value: 4}
    if (a.link == b.link) return b.displayOrder - a.displayOrder;
    if (a.link > b.link) return -1;
    if (a.link < b.link) return 1;
    return a.displayOrder - b.displayOrder;
};                                                       

Feed.prototype.sortEpisodesFunc6 = function(a,b) {
    ///         {label: "path ", value: 6}
    if (a.link == b.link) return a.displayOrder - b.displayOrder;
    if (a.link < b.link) return -1;
    if (a.link > b.link) return 1;
    return a.displayOrder - b.displayOrder;
};                                                       

              
Feed.prototype.sortEpisodesFuncTextNumericAsc = function(a,b) {
    if (a.titleNumber == b.titleNumber) {
        if (a.link == b.link) return b.displayOrder - a.displayOrder;
        if (a.link < b.link) return -1;
        if (a.link > b.link) return 1;
        return a.displayOrder - b.displayOrder;
    }
    if (a.titleNumber < b.titleNumber) return -1;
    if (a.titleNumber > b.titleNumber) return 1;
    return 1;
};                                                       

//------------


Feed.prototype.addToPlaylists = function(episode) {
    this.playlists.forEach(function(pf) {
        pf.insertEpisodeSorted(episode);
    });
};

Feed.prototype.addToPlaylistsTop = function(episode) {
    this.playlists.forEach(function(pf) {
        pf.insertEpisodeTop(episode);
    });
};

Feed.prototype.insertEpisodeTop = function(episode) {
    try {
        this.episodes.unshift(episode);
        this.guid[episode.guid] = episode;
    } catch (e) {
        Mojo.Log.error("Feed[%s]:Error adding episode: %j", this.title, e);
    }
    if (!episode.listened) { ++this.numNew; }
    if (episode.downloaded) {++this.numDownloaded;}
    if (episode.position !== 0) {
        ++this.numStarted;
    }
    if (episode.downloadTicket && !episode.downloaded) {
        this.downloading = true;
        ++this.downloadCount;
    }
};

Feed.prototype.insertEpisodeBottom = function(episode) {
    try {
        this.episodes.push(episode);
        this.guid[episode.guid] = episode;
    } catch (e) {
        Mojo.Log.error("Feed[%s]:Error adding episode: %j", this.title, e);
    }
    if (!episode.listened) { ++this.numNew; }
    if (episode.downloaded) {++this.numDownloaded;}
    if (episode.position !== 0) {
        ++this.numStarted;
    }
    if (episode.downloadTicket && !episode.downloaded) {
        this.downloading = true;
        ++this.downloadCount;
    }
};

Feed.prototype.insertEpisodeSorted = function(episode) {
    var added = false;
    for (var i=0, len=this.episodes.length; i<len; ++i) {
        if (episode.pubDate > this.episodes[i].pubDate) {
            if (i===0) {
                this.details = episode.title;
            }
            this.episodes.splice(i, 0, episode);
            added = true;
            break;
        }
    }
    if (!added) {
        if (this.episodes.length === 0) {
            this.details = episode.title;
        }
        this.episodes.push(episode);
    }
    this.guid[episode.guid] = episode;
    if (!episode.listened) { ++this.numNew; }
    this.updated();
    this.updatedEpisodes();
};

Feed.prototype.removePlaylist = function(f) {
    this.playlists = this.playlists.filter(function(pf) {return pf !== f;});
};

Feed.prototype.removeFeedFromPlaylist = function(f) {
    var playlistCount = this.feedIds.length;
    this.feedIds = this.feedIds.filter(function(fid) {return f.id != fid;});
    this.episodes = this.episodes.filter(function(e) {return e.feedObject.id != f.id;});
    this.details = null;
    if (this.episodes.length > 0) { this.details = this.episodes[0].title; }
    this.numNew = 0;
    this.numDownloaded = 0;
    this.numStarted = 0;
    this.downloadCount = 0;
    this.downloading = false;
    this.episodes.forEach(function(e) {
        if (!e.listened) {++this.numNew;}
        if (e.downloaded) {++this.numDownloaded;}
        if (e.position) {++this.numStarted;}
        if (e.downloading) {++this.downloadCount; this.downloading = true;}
    }.bind(this));
    this.updated();
    this.updatedEpisodes();
};

Feed.prototype.downloadCallback = function(episode, event) {
    if (event.returnValue) {
        episode.downloadTicket = event.ticket;
    }
};

Feed.prototype.replace = function(title) {
    var arr = this.getReplacementsArray();
    var sErr = null;
    arr.forEach(function(a) {
        try {
           if (!a.fromRegexp) {
               a.fromRegexp = new RegExp(a.from, "g");
           }
           title = title.replace(a.fromRegexp, a.to);
        } catch(ex) {
           sErr = "error in feed replacement expression. " + ex + " - " + a.from + " ('" + title + "')";
           Mojo.Log.error(sErr);
        }
    });
    if( sErr ) {
        Util.showError(sErr);
    }
    return title;
};

Feed.prototype.getReplacementsArray = function() {
    var arr = [];
    if (this.replacements) {
        var spl = this.replacements.split(",");
        if (spl.length % 2 === 1) {
            Mojo.Log.error("error parsing replacements string: %s", this.replacements);
        } else {
            for (var i=0; i<spl.length; i+=2) {
                arr.push({from: spl[i].replace(/#COMMA#/g, ","), to: spl[i+1].replace(/#COMMA#/g, ",")});
            }
        }
    }
    return arr;
};


Feed.prototype.setReplacements = function(arr) {
    var replacements;
    this.replacements = "";
    arr.forEach(function(a) {
        if (a.from.length > 0) {
            if (this.replacements.length > 0) { this.replacements += ",";}
            this.replacements += a.from.replace(/,/g,"#COMMA#") + "," +
                                 a.to.replace(/,/g,"#COMMA#");
        }
    }.bind(this));
};


Feed.prototype.doThatUpdate = function() {
    this.updated();
    this.updatedEpisodes();
    this.playlists.forEach(function(f) {
        f.updated();
        f.updatedEpisodes();
    });
    this.save();
};


Feed.prototype.listened = function(ignore) {
    this.episodes.forEach(function(e) {
        e.setListened(true);
        e.deleteFile(true);
    });
    if (!ignore) {
        this.updated();
        this.updatedEpisodes();
        this.playlists.forEach(function(f) {
            f.updated();
            f.updatedEpisodes();
        });
    }
    this.save();
};

Feed.prototype.unlistened = function(ignore) {
    this.episodes.forEach(function(e) {
        e.setUnlistened(true);
    });
    if (!ignore) {
        this.updated();
        this.updatedEpisodes();
        this.playlists.forEach(function(f) {
            f.updated();
            f.updatedEpisodes();
        });
    }
    this.save();
};

Feed.prototype.downloadingEpisode = function(ignore) {
    this.downloadCount++;
    this.downloading = true;
    this.playlists.forEach(function(f) {
        f.downloadingEpisode(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.downloadFinished = function(ignore) {
    this.downloadCount--;
    this.downloading = (this.downloadCount > 0);
    this.playlists.forEach(function(f) {
        f.downloadFinished(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.episodeListened = function(ignore) {
    this.numNew--;
    this.playlists.forEach(function(f) {
        f.episodeListened(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.episodeUnlistened = function(ignore) {
    this.numNew++;
    this.playlists.forEach(function(f) {
        f.episodeUnlistened(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.episodeDownloaded = function(ignore) {
    this.numDownloaded++;
    this.playlists.forEach(function(f) {
        f.episodeDownloaded(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.episodeDeleted = function(ignore) {
    this.numDownloaded--;
    this.playlists.forEach(function(f) {
        f.episodeDeleted(ignore);
    });
    if (!ignore) {this.updated();}
};


Feed.prototype.episodeBookmarked = function(ignore) {
    this.numStarted++;
    this.playlists.forEach(function(f) {
        f.episodeBookmarked(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.episodeBookmarkCleared = function(ignore) {
    this.numStarted--;
    this.playlists.forEach(function(f) {
        f.episodeBookmarkCleared(ignore);
    });
    if (!ignore) {this.updated();}
};

Feed.prototype.save = function() {
    if (this.playlist) {
        if (this.feedIds.length > 0) {
            DB.saveFeed(this);
            this.feedIds.forEach(function(p) {
                feedModel.getFeedById(p).save();
            });
        } else {
            DB.saveFeeds();
        }
    } else {
        DB.saveFeed(this);
    }
};

Feed.prototype.updated = function(reveal) {
    Mojo.Controller.getAppController().sendToNotificationChain({
        type: "feedUpdated", feed: this, "reveal": reveal});
};

Feed.prototype.updatedEpisodes = function() {
    Mojo.Controller.getAppController().sendToNotificationChain({
        type: "feedEpisodesUpdated", feed: this});
};

Feed.prototype.getDownloadPath = function() {
    var path=Util.escapeSpecial(this.title);
    if (this.hideFromOS) {
        path = '.' + path;
    }
    return path;
};


//------------------------------------------------------

FeedModel.prototype.items = [];
FeedModel.prototype.ids = [];

FeedModel.prototype.add = function(feed) {
    this.items.push(feed);
    this.ids[feed.id] = feed;
    // fire the NEWFEED event
};

FeedModel.prototype.getFeedById = function(id) {
    return this.ids[id];
};

FeedModel.prototype._enableWifiIfDisabled = function(status) {
    if (status.returnValue && status.status === "serviceDisabled") {
        this.enabledWifi = true;
        AppAssistant.wifiService.setState(null, "enabled");
    }
};

FeedModel.prototype.updateFeeds = function(feedIndex) {
    if (!feedIndex) {
        this.enabledWifi = false;
        if (false && Prefs.enableWifi) { //?
            AppAssistant.wifiService.getStatus(null, this._enableWifiIfDisabled.bind(this));
        }

        // first time through
        Util.banner($L({value: "Updating Feeds", key: "updatingFeeds"}));
        AppAssistant.powerService.activityStart(null, "FeedsUpdating");
        this.updatingFeeds = true;
        Mojo.Controller.getAppController().sendToNotificationChain({
            type: "feedsUpdating", value: true});
        feedIndex = 0;
    }

    while (feedIndex < this.items.length &&
           this.items[feedIndex].playlist) {
        ++feedIndex;
    }

    if (feedIndex < this.items.length) {
        var feed = this.items[feedIndex];

        feed.update(function() {
            this.updateFeeds(feedIndex+1);
        }.bind(this));
    } else {
        this.updatingFeeds = false;
        this.download();
        Mojo.Controller.getAppController().sendToNotificationChain({
            type: "feedsUpdating", value: false});
        AppAssistant.powerService.activityEnd(null, "FeedsUpdating");
    }
};

FeedModel.prototype.getEpisodesToDownload = function() {
    var eps = [];
    this.items.forEach(function (f) {
        if (!f.playlist) {
            eps = eps.concat(f.getEpisodesToDownload());
        }
    });
    return eps;
};

FeedModel.prototype.download = function() {
    var eps = this.getEpisodesToDownload();

    if (eps.length) {
        if (Prefs.limitToWifi) {
            Mojo.Log.warn("check for wifi");
            AppAssistant.wifiService.isWifiConnected(null, this._wifiCheck.bind(this, eps));
        } else {
            Mojo.Log.warn("no check for wifi, just download");
            this._doDownload(eps);
        }
    } else {
        Util.closeDashboard(DrPodder.DashboardStageName);
        if (this.enabledWifi) {
            AppAssistant.wifiService.setState(null, "disabled");
        }
    }

};

FeedModel.prototype._wifiCheck = function(eps, wifiConnected) {
    if (wifiConnected) {
        Mojo.Log.warn("wifiCheck is connected!");
        this._doDownload(eps);
    } else {
        Mojo.Log.warn("wifiCheck no wifi!");
        // popup banner saying that we couldn't download episodes
        // because wifi wasn't enabled, maybe even do a "click to retry"
        var newEps = eps.filter(function(e){return e.newlyAddedEpisode;});
        Mojo.Log.warn("wifiCheck newEps: %d!", newEps.length);
        if (newEps.length) {
            Mojo.Log.warn("Skipping %d episode download because wifi isn't connected", newEps.length);
            Util.banner($L({value: "Downloads pending WiFi", key: "downloadsPendingWifi"}) + ": " + newEps.length);
            Util.dashboard(DrPodder.DashboardStageName, $L({value: "Downloads pending WiFi", key: "downloadsPendingWifi"}),
                            newEps.map(function(e){return e.title;}), true);
        } else {
            Util.closeDashboard(DrPodder.DashboardStageName);
            if (this.enabledWifi) {
                AppAssistant.wifiService.setState(null, "disabled");
            }
        }
    }
};

FeedModel.prototype._doDownload = function(eps) {
    eps.forEach(function (e) {
        e.download();
    });
    Util.closeDashboard.defer(DrPodder.DashboardStageName);
};
