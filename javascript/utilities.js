
var Util;

function Utilities(){
}

Utilities.dump = function(obj){
// Utilities.dump()
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            Mojo.Log.info("obj." + key + "=" + obj[key]);
        }
    }
};

Utilities.prototype.showError = function(title, message){
    var stageController = Mojo.Controller.getAppController().getActiveStageController();
    
    if (stageController) {
        var currentScene = stageController.activeScene();
        if( !currentScene ) {
Mojo.Log.error("showerroroerror: %s %s", title, message );
           
        } else {
           currentScene.showAlertDialog({
               onChoose: function(value){
               },
               title: title,
               allowHTMLMessage: true,
               message: message,
               choices: [{
                   label: $L('OK'),
                   value: 'ok',
                   type: 'color'
               }]
           });
        }
    }
};


// Utilities.prototype.storageFreeSpace = function(ctrl) {
//   try {
//       this.deviceinfo=Mojo.Environment.DeviceInfo;
//       Mojo.Log.info("Maximum  %j", this.deviceinfo);
//       Mojo.Log.info("stor "+this.deviceinfo.storageFreeSpace);
//          
//       new Mojo.Service.Request('palm://com.palm.preferences/systemProperties/getAllSysProperties', {
//         onSuccess: function (response) { Mojo.Log.info("1free ok  %j",response); },
//         onFailure: function (response) { Mojo.Log.info("1free fail  %j",response); }
//       });
// 
//       new Mojo.Service.Request('palm://com.palm.preferences/systemProperties', {
//        method: "Get",
//         parameters: {
//                "key": "com.palm.properties.storageFreeSpace"
//         },
//         onSuccess: function (response) { Mojo.Log.info("free ok  %j",response); },
//         onFailure: function (response) { Mojo.Log.info("free fail  %j",response); }
//       });
//    } catch(e) {
//       Mojo.Log.info("Error is this"+e);
//    }
// }


Utilities.prototype.localize = function(assistant, element, value, key) {
    if (key) {
        value = $L({value: value, key: key});
    } else {
        value = $L(value);
    }
    //Mojo.Log.info("localizing: %s:%s", element, value);
    el = assistant.controller.get(element);
    if (el) {el.update(value);}
    else {Mojo.Log.error("Attempted to localize %s, but element wasn't found", element);}
};

Utilities.prototype.xpath = function(path, node, getData, numeric) {
    var type = XPathResult.FIRST_UNORDERED_NODE_TYPE;
    var result = node.evaluate(path, node, null, type, null);
    var resultNode = (result !== undefined)?result.singleNodeValue:result;
    if (!getData) {
       return resultNode;
    } else if (numeric) {
       return (resultNode !== undefined)?resultNode.data:0;
    } else {
       return (resultNode !== undefined)?resultNode.data:"";
    }
};

Utilities.prototype.dumpXml = function(n) {
    var c = n.childNodes;
    Mojo.Log.info("node: <%s>,name=%s, %d children", n.nodeName, n.nodeValue, c.length);
    for (var i=0; i<c.length; i++) {
        var child=c[i];
        Util.dumpXml(child);
    }
    Mojo.Log.info("node: <%s> done", n.nodeName);
};

Utilities.prototype.xmlTagValue = function(node, element, def) {
    var arr = node.getElementsByTagName(element);
    var val = def;
    if (arr && arr.length > 0 && arr[0].firstChild) { val = arr[0].firstChild.nodeValue; }
    return val;
};

Utilities.prototype.xmlTagAttributeValue = function(node, element, attr, def) {
    var arr = node.getElementsByTagName(element);
    var val = def;
    if (arr && arr.length > 0) {
        // we found the element
        node = arr[0];
        val = this.xmlGetAttributeValue(node, attr);
    }
    return val;
};

Utilities.prototype.xmlGetAttributeValue = function(node, attr) {
    var val;
    if (node.attributes !== null) {
        // just stepping through the attributes till we find the one asked for
        for (var i=0; i<node.attributes.length; i++) {
            var attrNode = node.attributes[i];
            if (attrNode.nodeName.toLowerCase() == attr.toLowerCase()) {
                val = attrNode.nodeValue;
                break;
            }
        }
    }
    return val;
};


Utilities.prototype.escapeSpecial = function(file) {
    //Mojo.Log.info("filelength pre  %d - %s", file.length, file);

    file = file.toString().replace(/\//g,'_').replace(/\\/g,'_').replace(/\:/g,'_').
                            replace(/\*/g,'_').replace(/\?/g,'_').replace(/\"/g,'_').
                            replace(/</g, '_').replace(/\>/g, '_').replace(/\|/g, '_').
                            replace(/'/g,'_').replace(/\#/g, '_').replace(/\n/g, '_').
                            replace(/\t/g,'_').replace(/\!/g, '_').replace(/\./g, '_').
                            replace(/ /g,'_')
                            ;
    // don't allow filenames longer than 200 chars
    if (file.length > 200) {
        file = file.slice(200);
    }

    // if file ends in a space character, get rid of it, that's bad
    file = file.replace(/\s*$/,"");

    //Mojo.Log.info("filelength post %d - %s", file.length, file);

    if (file.length === 0) {
        file = "Unknown";
    }

    return file;
};

Utilities.prototype.banner = function(message) {
    var appController = Mojo.Controller.appController;
    var cardVisible = appController.getStageProxy(DrPodder.MainStageName) &&
                      appController.getStageProxy(DrPodder.MainStageName).isActiveAndHasScenes();
    if (Prefs.enableNotifications || cardVisible) {
        var bannerParams = {
            //icon: "miniicon.png",
            messageText: message
        };
        appController.showBanner(bannerParams, {});
    }
};

Utilities.prototype.dashboard = function(stageName, title, message, clearMessages) {
    var appController = Mojo.Controller.appController;
    var cardVisible = appController.getStageProxy(DrPodder.MainStageName) &&
                      appController.getStageProxy(DrPodder.MainStageName).isActiveAndHasScenes();
    if (!cardVisible && Prefs.enableNotifications) {
        var cont = appController.getStageProxy(stageName);
        if (!cont) {
            var pushDashboard = function(stageController) {
                stageController.pushScene("dashboard", title, message);
            };
            appController.createStageWithCallback(
                {name: stageName,lightweight: true},
                pushDashboard, "dashboard");
        } else {
            cont.delegateToSceneAssistant("sendMessage", title, message, clearMessages);
        }
    }
};

Utilities.prototype.removeMessage = function(stageName, title, message) {
    var appController = Mojo.Controller.appController;
    var cont = appController.getStageProxy(stageName);
    if (cont) {
        cont.delegateToSceneAssistant("removeMessage", title, message);
    }
};

Utilities.prototype.closeDashboard = function(stageName) {
    var appController = Mojo.Controller.appController;
    var cont = appController.getStageProxy(stageName);
    if (cont) {cont.window.close();}
};

Utilities.prototype.isDockmode = function() {
    new Mojo.Service.Request('palm://com.palm.display/', {
        method: 'status',
        parameters: {
             "subscribe": false
         },
         onSuccess : function (e){ Mojo.Log.error("Status success, results="+JSON.stringify(e)); },
         onFailure : function (e){ Mojo.Log.Errpr("Status failure, results="+JSON.stringify(e)); }
    });
    return false; // xx.
}

Utilities.prototype.formatTime = function(secs) {
    if (secs < 0) {
        return "00:00";
    }
    var mins = Math.floor(secs / 60);
    secs = Math.floor(secs % 60);
    if (mins<10) {mins = "0"+mins;}
    if (secs<10) {secs = "0"+secs;}
    return mins+":"+secs;
};

function ddMMSSString(value) { 
    min = Math.floor( (Math.abs(value) / 60 ));
    sec = Math.floor (Math.abs(value) - (60* min));
    return  as2LZString(min) + ":" 
          + as2LZString(sec)  
    ;
}

function as2LZString(dec) {
    if( dec < 10 ) return "0" + dec;
    return dec;
}



Util = new Utilities();
