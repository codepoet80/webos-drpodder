function wosaPodcastDirectorySearch() {
	
}
var directoryURLBase = "http://podcasts.webosarchive.org/";
wosaPodcastDirectorySearch.prototype.url = directoryURLBase + "search.php?q={keyword}&max=50";
wosaPodcastDirectorySearch.prototype.detailUrl = directoryURLBase + "getdetailby.php?url={keyword}";

wosaPodcastDirectorySearch.prototype.getProviderLabel = function () {
	return this.providerLabel;
}

wosaPodcastDirectorySearch.prototype.search = function(keyword, callback) {
	Mojo.Log.info("wosaPodcastDirectorySearch.search(%s)", keyword);
	url = this.url.replace("{keyword}", keyword);
	Mojo.Log.info("url: %s", url);

	var request = new Ajax.Request(url, {
		method : "get",
		evalJSON : "false",
		evalJS : "false",
		onFailure : function(transport) {
			Mojo.Log.info("Error contacting search service: " + transport.status);
            Mojo.Controller.getAppController().showBanner({ messageText: ("Error contacting search service: " + transport.status) }, "", "");
		},
		onSuccess : this.searchResults.bind(this, callback)
	});
};

wosaPodcastDirectorySearch.prototype.searchResults = function(callback, transport) {
	var results = [];
	if (!transport || transport.status === 0 || transport.status < 200 || transport.status > 299) {
		Mojo.Log.error("Error contacting search service: %d", transport.status);
        Mojo.Controller.getAppController().showBanner({ messageText: ("Error contacting search service: " + transport.status) }, "", "");
		return;
	}

	var responseObj = JSON.parse(transport.responseText);
	if (responseObj.status == "error") {
		Mojo.Log.error("Error message from server while searching for Podcasts: " + responseObj.msg);
        Mojo.Controller.getAppController().showBanner({ messageText: ("Error message from server while searching for Podcasts: " + responseObj.msg) }, "", "");
	} else {
		if (responseObj.feeds && responseObj.feeds.length > 0) {

			for (var i = 0; i < responseObj.feeds.length; i++) {
				var title = responseObj.feeds[i].title;
				var url = responseObj.feeds[i].url;
				if (title !== undefined && url !== undefined) {
					results.push(responseObj.feeds[i]);
				} else {
					Mojo.Log.warn("skipping: (%s)-[%s]", title, url);
				}
			}
		} else {
			Mojo.Log.error("Search results were empty. Either there was no matching result, or there were server or connectivity problems.");
			Mojo.Controller.getAppController().showBanner({ messageText: ("The server did not report any matches for the search.") }, "", "");
		}
	}
	Mojo.Log.info("Finished processing search results for wOSA Podcast Directory with " + results.length + " results");

	callback(results);
};

wosaPodcastDirectorySearch.prototype.getDetail = function(keyword, callback) {
	Mojo.Log.info("wosaPodcastDirectorySearch.getDetail(%s)", keyword);
	url = this.detailUrl.replace("{keyword}", keyword);
	Mojo.Log.info("url: %s", url);

	var request = new Ajax.Request(url, {
		method : "get",
		evalJSON : "false",
		evalJS : "false",
		onFailure : function(transport) {
			Mojo.Log.error("Error contacting search service: " + transport.status);
            Mojo.Controller.getAppController().showBanner({ messageText: ("Error contacting search service: " + transport.status) }, "", "");
		},
		onSuccess : this.getDetailResults.bind(this, callback)
	});
};

wosaPodcastDirectorySearch.prototype.getDetailResults = function(callback, transport) {
	var results = null;
	if (!transport || transport.status === 0 || transport.status < 200 || transport.status > 299) {
		Mojo.Log.error("Error contacting search service: %d", transport.status);
        Mojo.Controller.getAppController().showBanner({ messageText: ("Error contacting search service: " + transport.status) }, "", "");
		return;
	}
	var responseObj = JSON.parse(transport.responseText);
	if (responseObj.status == "error") {
		Mojo.Log.error("Error message from server while searching for Podcast: " + responseObj.msg);
        Mojo.Controller.getAppController().showBanner({ messageText: ("Error message from server while searching for Podcast: " + responseObj.msg) }, "", "");
	} else {
		if (responseObj.feed) {
            results = responseObj.feed;
		} else {
			Mojo.Log.error("Detail search results were empty. Either there was no matching result, or there were server or connectivity problems.");
			Util.showError("No results", "The server did not report any matches for the detail search.");
		}
	}
	Mojo.Log.info("Finished processing detail search results for wOSA Podcast Directory with " + results + " result");

	callback(results);
};