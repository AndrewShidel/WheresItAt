var latitude = 0;
var longitude = 0;
function success(position) {
    latitude  = position.coords.latitude;
    longitude = position.coords.longitude;
};
function error() {console.error("Error getting location.")};

navigator.geolocation.getCurrentPosition(success, error);

document.getElementById("submitButton").onclick = function() {
    var distMeters = unitConvert(parseInt(document.getElementById("distSelect").value), document.getElementById("unitSelect"));

    var url = "search/?";
    url += "position=" + latitude + "," + longitude;
    url += "&radius=" + distMeters;
    url += "&term=" + document.getElementById("searchBox").value
    httpGet(url, function(data) {
        buildView(data);
    });
}

function buildView(data) {
    data = JSON.parse(data);
    data.sort(function (a, b) {
        return a.score - b.score;
    });
    var disp = document.getElementById("disp");
    var dispStr = "";
    for (var i in data) {
        var name = data[i]["name"];
        dispStr += '<div class="card">';
        dispStr += '<img src="'+data[i]["icon"]+'" class="icon"/>';
        dispStr += '<span class="cardTitle">' + name + '</span>';
        dispStr += '<div class="upDown"><div onclick="upvote(\''+name+'\')" class="up" title="Has what I want"></div><div onclick="downvote(\''+name+'\')" class="down" title="Does not have what I want"></div></div>'
        dispStr += '<div class="categories">' + categoryFormat(data[i]["categories"]) + "</div>"
        dispStr += '</div></br>';
    }
    disp.innerHTML = dispStr;
}

function categoryFormat(data) {
    var html = "Categories:&nbsp";
    for (var i in data) {
        data[i] = toTitleCase(data[i].replace(/_/g, " "));
        html += data[i];
        if (i < data.length-1) {
            html += ",&nbsp"
        }
    }
    return html;
}
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function upvote(name) {
    var searchTerm = document.getElementById("searchBox").value;
    httpGet("/vote/?direction=up&name="+name+"&term="+searchTerm, null);
}
function downvote(name) {
    var searchTerm = document.getElementById("searchBox").value;
    httpGet("/vote/?direction=down&name="+name+"&term="+searchTerm, null);
}

function unitConvert(val, unit) {
    if (unit === "miles") {
        return Math.floor(val * 1609.34);
    } else {
        return val * 1000;
    }
}

function httpGet(url, callback) {
    url = encodeURI(url);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = function (e) {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
            if (callback !== null) {
                callback(xhr.responseText);
            }
        } else {
          console.error(xhr.statusText);
        }
      }
    };
    xhr.onerror = function (e) {
      console.error(xhr.statusText);
    };
    xhr.send(null);
}