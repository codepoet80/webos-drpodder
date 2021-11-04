
var LastSearchService = "wosaPodcastDirectorySearch";
var LastSearchKeyword = "";

function wosaPodcastDirectorySearch() {

}

wosaPodcastDirectorySearch.prototype.url = "http://podcasts.webosarchive.com/search.php?q={keyword}&max=50";
wosaPodcastDirectorySearch.providerLabel = "powered by <a href='http://www.webosarchive.com'>webOS Archive</a>";

wosaPodcastDirectorySearch.prototype.getProviderLabel = function () {
	return this.providerLabel;
}

wosaPodcastDirectorySearch.prototype.search = function(keyword, callback) {
	Mojo.Log.error("wosaPodcastDirectorySearch.search(%s)", keyword);
	url = this.url.replace("{keyword}", keyword);
	Mojo.Log.info("url: %s", url);

	var request = new Ajax.Request(url, {
		method : "get",
		evalJSON : "false",
		evalJS : "false",
		onFailure : function(transport) {
			Mojo.Log.error("Error contacting search service: %d", transport.status);
			Util.showError($L({value:"Error contacting search service", key:"errorContactingSearch"}), "HTTP Status:"+transport.status);
		},
		onSuccess : this.searchResults.bind(this, callback)
	});
};

wosaPodcastDirectorySearch.prototype.searchResults = function(callback, transport) {
	var results = [];
	if (!transport || transport.status === 0 || transport.status < 200 || transport.status > 299) {
		Mojo.Log.error("Error contacting search service: %d", transport.status);
		Util.showError($L({value:"Error contacting search service", key:"errorContactingSearch"}), "HTTP Status:"+transport.status);
		return;
	}

	var responseObj = JSON.parse(transport.responseText);
	if (responseObj.status == "error") {
		Mojo.Log.error("Error message from server while searching for Podcasts: " + responseObj.msg);
		Util.showError($L({value:"Error contacting search service", key:"errorContactingSearch"}), "The server responded to the search request with: " + responseObj.msg.replace("ERROR: ", ""));
	} else {
		if (responseObj.feeds && responseObj.feeds.length > 0) {

			for (var i = 0; i < responseObj.feeds.length; i++) {
				Mojo.Log.info("item: " + JSON.stringify(responseObj.feeds[i]));
				var title = responseObj.feeds[i].title;
				var url = responseObj.feeds[i].url;
				if (title !== undefined && url !== undefined) {
					results.push({title:title, url:url});
				} else {
					Mojo.Log.warn("skipping: (%s)-[%s]", title, url);
				}
			}
		} else {
			Mojo.Log.error("Search results were empty. Either there was no matching result, or there were server or connectivity problems.");
			Util.showError("No results", "The server did not report any matches for the search.");
		}
	}
	Mojo.Log.info("Finished processing search results for wOSA Podcast Directory with " + results.length + " results");

	callback(results);
};

function FeedSearchAssistant() {
	this.searchService = "wosaPodcastDirectorySearch";
	this.searchServices = {"wosaPodcastDirectorySearch": new wosaPodcastDirectorySearch()
	};
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

	//Feed Type Picker
	this.controller.setupWidget("listUseTiny",
		this.attributes = {
			label: $L("Feed Type"),
			choices: [
				{ label: "Tiny", value: "tiny" },
				{ label: "Full", value: "full" }
			]
		},
		this.model = {
			value: "tiny",
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
			value: 25,
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
		this.keywordModel = { value : LastSearchKeyword});

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
	
	this.backButton = {label:$L('Back'), command:'cmd-backButton'};
	if(!_device_.thisDevice.hasGesture){
		this.cmdMenuModel = {items:[]};
		this.cmdMenuModel.items.push(this.backButton);
		this.controller.setupWidget(Mojo.Menu.commandMenu, {}, this.cmdMenuModel);
	}

};

FeedSearchAssistant.prototype.localize = function() {
	Util.localize(this, "searchPodcastDirectory", "Search Podcast Directory", "searchPodcastDirectory");
	Util.localize(this, "keyword", "Keyword");
};

FeedSearchAssistant.prototype.activate = function() {
	Mojo.Event.listen(this.keywordField, Mojo.Event.propertyChange, this.keywordChangeHandler);
	Mojo.Event.listen(this.feedSearchList, Mojo.Event.listTap, this.selectionHandler);

	//TODO: list box changes
	this.focusChanges = Mojo.Event.listenForFocusChanges(this.keywordField, this.focusChangeHandler);
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

FeedSearchAssistant.prototype.keywordChange = function(event) {
	this.searchService = LastSearchService;
	LastSearchKeyword = event.value;

	if (event.originalEvent && event.originalEvent.keyCode === Mojo.Char.enter) {
		this.keywordField.mojo.blur();
		var ss = this.searchServices[this.searchService];

		this.listModel.items = [];
		this.controller.modelChanged(this.listModel);

		ss.search(event.value, function(results) {
			Mojo.Log.info("** search callback hit!");
			var numFeeds = results.length;
			this.listModel.items = results;

			if (numFeeds > 0) {
				this.controller.modelChanged(this.listModel);
				this.keywordField.mojo.blur();
			} else {
				Util.showError($L({value:"No Results Found", key:"noResults"}), $L({value:"Please try a different keyword, or ask the service provider to add your feed.", key:"tryDifferentKeyword"}));
			}
		}.bind(this));
	}
};

FeedSearchAssistant.prototype.selection = function(event) {
	//Mojo.Log.error("You clicked on: [%s], [%s]", event.item.title, event.item.url);
	//TODO: List box choices applied
	this.controller.stageController.popScene({feedToAdd: event.item});
};

FeedSearchAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command){
		this.cmd= event.command;
		switch(this.cmd){
			case 'cmd-backButton' :
				this.controller.stageController.popScene();
				break;
		}
	}
}
