
// Helpers 

// From http://stackoverflow.com/questions/3431512/javascript-equivalent-to-phps-urldecode
function urldecode (str) {
  return decodeURIComponent((str + '').replace(/\+/g, '%20'));
}

// From http://stackoverflow.com/questions/12168909/blob-from-dataurl
function dataURItoBlob(dataURI) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  var byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  var ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  var blob = new Blob([ab], {type: mimeString});
  return blob;
}


	//from http://snipplr.com/view/14074/
 
 String.prototype.between = function(prefix, suffix) {
  s = this;
  var i = s.indexOf(prefix);
  if (i >= 0) {
    s = s.substring(i + prefix.length);
  }
  else {
    return '';
  }
  if (suffix) {
    i = s.indexOf(suffix);
    if (i >= 0) {
      s = s.substring(0, i);
    }
    else {
      return '';
    }
  }
  return s;
}


// State Vars

var api_key;
chrome.storage.sync.get('apikey', function (result) { 
    api_key = result.apikey; 
});

// Actions

function send_form(url, formData, sendResponse)
{
    console.log("Uploading " + formData + " to JSIT...");
    
    var http = new XMLHttpRequest();    
    http.open("POST", url, true);

    http.onreadystatechange = function() {
        if(http.readyState == 4) 
        {
            resp = http.responseXML;
            s = resp.getElementsByTagName("status")[0].innerHTML;
            
            if ( s != "SUCCESS" )
            {
                m = urldecode(resp.getElementsByTagName("message")[0].innerHTML);
                alert("Torrent upload failed!\n"+ m);
                sendResponse("failure");
            }
            else
            {
                sendResponse("success");          
            }
        }
    };
  
    http.send(formData);
}

function upload_url(url, torrent, sendResponse)
{
    if (typeof api_key == 'undefined' || api_key == "") //if no key is defined
    {
		var xmlhttp = new XMLHttpRequest(); //We try to autodetect the API key
		xmlhttp.open("GET", "https://justseed.it/options/index.csp", false);
		xmlhttp.send();
		
		if(xmlhttp.responseText.between('name="api_key" value="','" />') && confirm("You didn't set your API key, but we detected you are logged in. Use "+xmlhttp.responseText.between('font-weight: bold;">\n \n ',"&nbsp;<span")+"'s API key ?")){ //if an api key is detected AND  the user wants to use it
			api_key = xmlhttp.responseText.between('name="api_key" value="','" />');
			chrome.storage.sync.set({"apikey" : api_key }); //we set the new API key
	   }
	   else {
					alert("Please set your api_key before trying to upload torrents!\n\nYou will be redirected to the option page.");
					chrome.tabs.create({ url: chrome.extension.getURL("options.html") });
					sendResponse("ignore");
					return;
	   }

    }
        
    var url_type = getURLType(url);

    if (url_type == "No")
    {
        alert(url + " is not a recognized torrent link!");
        sendResponse("ignore");
        return;
    }
    
    var apiurl = "https://api.justseed.it/torrent/add.csp";
    
    var formData = new FormData();
    formData.append("api_key", api_key );
    
    if (url_type == "magnet")
    {
        formData.append("url", url );
    }
    else if (url_type == "hash")
    {
        formData.append("info_hash", url );
    }
    else if (url_type == "torrent")
    {
        // Decode torrent file data
        tblob = dataURItoBlob(torrent);
        formData.append("torrent_file", tblob );
    }   
    
    send_form(apiurl, formData, sendResponse);
}

function dummy(arg)
{
}


function upload(info, tab)
{
    url = info.linkUrl;

    upload_url(url, dummy);
}

function readd(info, tab)
{
    chrome.tabs.sendMessage(tab.id, {type: "readdButtons"});
}


// Initialization

chrome.contextMenus.removeAll();
chrome.contextMenus.create({
        "id": "jsit",
        "title": "Upload to JSIT", 
        "contexts": ["link"],
        "onclick": upload
});
chrome.contextMenus.create({
        "id": "jsit_readd",
        "title": "Re-add buttons", 
        "contexts": ["page"],
        "onclick": readd
});

// Message listener

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    //console.log(sender.tab ?
    //            "from a content script:" + sender.tab.url :
    //            "from the extension");
    if (request.type == "getApiKey")
    {
        sendResponse({apikey: api_key});
    }
    else if (request.type == "setApiKey")
    {
        api_key = request.value;
        chrome.storage.sync.set({"apikey" : api_key });
    }
    else if (request.type == "uploadURL")
    {
        var url = request.value;
        var torrent = request.torrent;
        upload_url(url, torrent, sendResponse);
            
        return true;
    }
  });
