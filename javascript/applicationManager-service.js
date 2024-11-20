
function ApplicationManagerService() {
}

ApplicationManagerService.prototype.URI = "palm://com.palm.applicationManager/";

ApplicationManagerService.prototype.open = function(sceneController, id, params) {
    return sceneController.serviceRequest(this.URI, {
        method: "open",
        onSuccess: function() {},
        onFailure: function() {},
        parameters: {id: id, params: params}
    });
};

ApplicationManagerService.prototype.email = function(summary, text, toSupport) {
    var recipients = [];
    if (toSupport) {
        recipients.push({type: 'email',
                         role: 1,
                         value: 'webosarchive@gmail.com',
                         contactDisplay: 'drPodder Support'});
    }
    var obj = new Mojo.Service.Request(this.URI, {
        method: "open",
        parameters: {
            id: "com.palm.app.email",
            params: {
                "summary": summary,
                "text": text,
                "recipients": recipients
            }
        }
    });
};
