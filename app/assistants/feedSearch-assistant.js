var LastSearchKeyword = "";
var UseTinyFeed = true;
var MaxEpisodes = 25;
var shareServiceModel = null;

function FeedSearchAssistant() {
	this.searchService = "wosaPodcastDirectorySearch";
	this.searchServices = {"wosaPodcastDirectorySearch": new wosaPodcastDirectorySearch()};
	shareServiceModel = new ShareServiceModel();
}

FeedSearchAssistant.prototype.setup = function() {
	this.menuAttr = {omitDefaultItems: true};

	this.menuModel = {
		visible: true,
		items: [
			Mojo.Menu.editItem,
			{label: $L("Help"), command: "help-cmd"}
		]
	};

	this.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);
	//Spinner
	this.controller.setupWidget("spinnerLoad",
		this.attributes = {
			spinnerSize: "small"
		},
		this.model = {
			spinning: false
		}
	); 
  
	var tinyFeedValue = "Full";
	if (UseTinyFeed)
		tinyFeedValue = "Tiny";
	//Feed Type Picker
	this.controller.setupWidget("listUseTiny",
		this.attributes = {
			label: $L("Feed Type"),
			choices: [
				{ label: "Tiny", value: "Tiny" },
				{ label: "Full", value: "Full" }
			]
		},
		this.model = {
			value: tinyFeedValue,
			disabled: false
		}
	);
	//Feed Length Picker
	this.controller.setupWidget("listMaxEpisodes",
		this.attributes = {
			label: $L("Max Episodes"),
			choices: [
				{ label: 10, value: "10" },
				{ label: 25, value: "25" },
				{ label: 50, value: "50" },
				{ label: 100, value: "100" },
				{ label: 150, value: "150" },
				{ label: 200, value: "200" },
			]
		},
		this.model = {
			value: MaxEpisodes,
			disabled: false
		}
	);

	this.controller.setupWidget("keywordField",
		{
			hintText : $L({value:"Search Keyword", key:"searchKeyword"}),
			autoFocus : true,
			limitResize : true,
			autoReplace : false,
			textCase : Mojo.Widget.steModeLowerCase,
			focusMode : Mojo.Widget.focusSelectMode,
			requiresEnterKey: true,
			enterSubmits : true,
			changeOnKeyPress : true
		},
		this.keywordModel = { value : LastSearchKeyword || DrPodder.PodcastSearchText });

	this.keywordField = this.controller.get("keywordField");
	this.keywordChangeHandler = this.keywordChange.bind(this);

	this.listAttr = {
		itemTemplate: "feedSearch/searchRowTemplate",
		listTemplate: "feedSearch/searchListTemplate",
		swipeToDelete: false,
		reorderable: false,
		renderLimit: 50
	};

	this.listModel = {items: []};

	this.searchBox = this.controller.get("searchBox");
	this.searchBoxTitle = this.controller.get("searchBoxTitle");

	this.controller.setupWidget("feedSearchList", this.listAttr, this.listModel);
	this.feedSearchList = this.controller.get("feedSearchList");
	this.selectionHandler = this.selection.bindAsEventListener(this);
	this.focusChangeHandler = this.focusChange.bindAsEventListener(this);

	this.localize.bind(this).defer();
	
	this.backElement = this.controller.get('icon');
    this.backTapHandler = this.backTap.bindAsEventListener(this);
    this.controller.listen(this.backElement, Mojo.Event.tap, this.backTapHandler);

};

FeedSearchAssistant.prototype.localize = function() {
	Util.localize(this, "searchPodcastDirectory", "Search Podcast Directory", "searchPodcastDirectory");
	Util.localize(this, "keyword", "Keyword");
};

FeedSearchAssistant.prototype.activate = function() {
	Mojo.Event.listen(this.keywordField, Mojo.Event.propertyChange, this.keywordChangeHandler);
	Mojo.Event.listen(this.feedSearchList, Mojo.Event.listTap, this.selectionHandler);
    Mojo.Event.listen(this.controller.get("listUseTiny"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));
    Mojo.Event.listen(this.controller.get("listMaxEpisodes"), Mojo.Event.propertyChange, this.handleValueChange.bind(this));

	//TODO: list box changes
	this.focusChanges = Mojo.Event.listenForFocusChanges(this.keywordField, this.focusChangeHandler);
	if (DrPodder.PodcastSearchText != null && DrPodder.PodcastSearchResults != null) {
		this.showPreviousSearchResults(DrPodder.PodcastSearchResults);
	} else {
		this.getUserRecommendations();
	}
};

FeedSearchAssistant.prototype.deactivate = function() {
	Mojo.Event.stopListening(this.keywordField, Mojo.Event.propertyChange, this.keywordChangeHandler);
	Mojo.Event.stopListening(this.feedSearchList, Mojo.Event.listTap, this.selectionHandler);
	this.focusChanges.stopListening();
};

FeedSearchAssistant.prototype.cleanup = function() {
};

FeedSearchAssistant.prototype.focusChange = function(event) {	
};

FeedSearchAssistant.prototype.handleValueChange = function(event) {

    Mojo.Log.info(event.srcElement.id + " value changed to " + event.value);
    switch (event.srcElement.id) {
        case "listUseTiny":
			if (event.value == "Full")
				UseTinyFeed = false;
			else
				UseTinyFeed = true;
			break;
        case "listMaxEpisodes":
            MaxEpisodes = event.value;
            break;
    }
    Mojo.Log.info(event.srcElement.title + " now: " + event.value);
};

FeedSearchAssistant.prototype.keywordChange = function(event) {
	LastSearchKeyword = event.value;

	if (event.originalEvent && event.originalEvent.keyCode === Mojo.Char.enter) {
		this.keywordField.mojo.blur();
		this.controller.get("divResultsList").style.display = "none";
		this.controller.get("spnResultsTitle").innerHTML = "Search Results";

		var ss = this.searchServices[this.searchService];
		this.controller.get('spinnerLoad').mojo.start();

		this.listModel.items = [];
		this.controller.modelChanged(this.listModel);

		if (event.value != "") {
			DrPodder.PodcastSearchText = event.value;
			ss.search(event.value, function(results) {
				this.controller.get('spinnerLoad').mojo.stop();

				var numFeeds = results.length;
				this.listModel.items = results;
				DrPodder.PodcastSearchResults = results;

				if (numFeeds > 0) {
					this.controller.get("divResultsList").style.display = "block";
					this.controller.modelChanged(this.listModel);
					this.keywordField.mojo.blur();
				} else {
					Util.showError($L({value:"No Results Found", key:"noResults"}), $L({value:"Please try a different keyword, or ask the service provider to add your feed.", key:"tryDifferentKeyword"}));
				}
			}.bind(this));
		} else {
			this.getUserRecommendations();
		}
	}
};

FeedSearchAssistant.prototype.selection = function(event) {
	Mojo.Log.info("You clicked on: [%s], [%s], [%s]", event.item.title, event.item.url, event.originalEvent.target.className);
	
	if (event.originalEvent.target.className.indexOf("info-icon") != -1) { //info
        //this.handlePopupChoose(event.item, "do-complete");
		DrPodder.PodcastDetails = event.item;
		this.controller.stageController.pushScene({ transition: Mojo.Transition.crossFade, name: "feedDetail" });
    } else {
		if (UseTinyFeed) {
			Mojo.Log.info("Building " + event.item.title + " Tiny Feed with a max of " + MaxEpisodes + " for URL " + event.item.url)
			event.item.url = this.buildURL("tiny") + "?url=" + this.base64UrlEncode(event.item.url) + "&max=" + MaxEpisodes;
		}
		Mojo.Log.info("Final Feed URL: " + event.item.url);
		DrPodder.PodcastSearchText = null;
		DrPodder.PodcastSearchResults = null;
		LastSearchKeyword = null;
		this.controller.stageController.popScene({feedToAdd: event.item});
	}
};

FeedSearchAssistant.prototype.backTap = function(event)
{
	this.controller.stageController.popScene();
	DrPodder.PodcastSearchText = null;
	DrPodder.PodcastSearchResults = null;
	LastSearchKeyword = null;
};

FeedSearchAssistant.prototype.getUserRecommendations = function() {
    Mojo.Log.info("Getting User Recommendations from Sharing Service...");
	this.controller.get('spinnerLoad').mojo.start();
	this.controller.get("divResultsList").style.display = "none";
    shareServiceModel.DoShareListRequest(function(response) {
        try {
            var responseObj = JSON.parse(response);
            if (responseObj.shares) {
                var sharedItems = [];
                for (var i = 0; i < responseObj.shares.length; i++) {
                    //Mojo.Log.info("shared item: " + JSON.stringify(responseObj.shares[i]));
                    if (responseObj.shares[i].content)
                        sharedItems.push(responseObj.shares[i].content)
                }
				if (sharedItems.length > 0) {
					this.controller.get('spinnerLoad').mojo.stop();
					this.controller.get("spnResultsTitle").innerHTML = "Recommended by webOS Users";
					this.controller.get("divResultsList").style.display = "block";

					this.listModel.items = sharedItems;
					this.controller.modelChanged(this.listModel);
				}
            } else {
                throw ("No items shared");
            }
        } catch (ex) {
            Mojo.Log.warn("Shared recommendation list was empty or could not be loaded: " + ex);
        }
    }.bind(this));
}

FeedSearchAssistant.prototype.showPreviousSearchResults = function(results) {
	this.listModel.items = results;
	this.controller.modelChanged(this.listModel);
}

FeedSearchAssistant.prototype.buildURL = function(actionType) {
    var urlBase = directoryURLBase;

    //Make sure we don't end up with double slashes in the built URL if there's a custom endpoint
    var urlTest = urlBase.split("://");
    if (urlTest[urlTest.length - 1].indexOf("/") != -1) {
        urlBase = urlBase.substring(0, urlBase.length - 1);
    }
    var path = urlBase + "/" + actionType + ".php";
    return path;
}

FeedSearchAssistant.prototype.base64UrlEncode = function(url) {
    // First of all you should encode to Base64 string
    url = btoa(url);
    // Convert Base64 to Base64URL by replacing “+” with “-” and “/” with “_”
    url = url.replace(/\+/g, '-');
    url = url.replace(/\//g, "_");
    return url;
}