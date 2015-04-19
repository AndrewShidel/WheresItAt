var express = require('express'),
    app = express(),
    request = require('request'),
    fs = require('fs');

var nearMeUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?";
var API_KEY = "AIzaSyBK-8tOua3E4fI1X0LqA8q2Mwx1Y4LBIxQ";
var CUSTOM_SEARCH_ID = "012801506953464048125:8iqs0fxtimg";

var memStore = JSON.parse(fs.readFileSync("memStore.json"));

//var searchCountRE = new RegExp("About\\s.*?\\sresults");
var searchCountRE = new RegExp(">([0-9]|,){1,14}\\sresults");

app.listen(3000);
console.log('Listening on port 3000');

app.use(express.static(__dirname + '/public'));

app.get('/search/', function(req, res) {
  console.log("Got search: " +req.query.position + " " + req.query.radius + " " + req.query.term);
  nearMe(req.query.position, req.query.radius, req.query.term, function(data) {
    console.log("done");
    res.send(data);
  })
});

app.get('/vote/', function(req, res) {
  vote(req.query.name, req.query.term, req.query.direction==="up"?1:-1);
  res.send("OK");
});

function nearMe(position, radius, term, callback) {
  var url = nearMeUrl + "key=" + API_KEY;
  url += "&location=" + position;
  url += "&radius=" + radius;
  url += "&types=store";
  //url += "&rankby=distance";

  console.log(url);
  request(url, function(error, response, body) {
    console.log("Recieved near me " + response.statusCode);

    if (!error && response.statusCode == 200) {
      var res = JSON.parse(body);
      var results = res["results"];
      var numFinished = 0;
      var cutOffPoint = 50000;
      var respData = [];
      console.log("Results length: " + results.length);
      for (var i in results) {
        console.log(i);
        console.log("Looking for: " + results[i]["name"]);
        
        getRelation(results[i]["name"], term, i, results.length, function(score, index) {
          if (score < cutOffPoint) {
            respData.push({
              "name": results[index]["name"],
              "score": score,
              "icon": results[index]["icon"],
              //"openNow": results[index]["opening_hours"]["open_now"],
              "vicinity": results[index]["vicinity"],
              "categories": results[index]["types"]
            });
          }
          numFinished++;
          if (numFinished >= results.length) {
            callback(respData);
          }
        })
      }
    }
  });
}

function getRelation(buisnessName, term, index, total, callback) {
  var ratio = getItemRatio(buisnessName, term);
  if (ratio !== undefined) {
    ratio += buildTermRatio(buisnessName, term);
    callback(ratio, index);
    return;
  }

  console.log("Get Relation: " + buisnessName);
  getNumResults("\"" + buisnessName + "\"", function(buisnessRes) {
    getNumResults("\"" + term + "\" \"" + buisnessName + "\"", function(termRes) {
      if (buisnessRes < 200) {
        buisnessRes = 10000000; //Basically ignore if < 200
      }
      addItem(buisnessName, term, buisnessRes, termRes);
      var ratio = buisnessRes / termRes + buildTermRatio(buisnessName, term);
      console.log(buisnessName + ": " + buisnessRes + "/" + termRes + "+terms = " + ratio);
      callback(ratio, index);
    })
  });
}

function getNumResults(term, callback) {
  //var url = "http://www.google.com/search?q=" + term;
  var url = "http://www.bing.com/search?q=" + term;
  var options = {
    url: url,
    headers: {
      'User-Agent': 'Mozilla'
    }
  };
  request(options, function (error, response, body) {
    var fs = require("fs");
    //fs.writeFileSync(term+".html", body);
    var matches = body.match("No results found for ");
    if (matches !== null) {
      callback(1);
      return;
    }

    matches = body.match(searchCountRE);
    if (matches !== null) {
      var match = matches[0];
      //callback(parseInt(match.match(".*?\\s")[0].replace(/,/g, "")));
      console.log("match: " + match);
      callback(parseInt(match.split(" ")[0].substr(1).replace(/,/g, "")));
    } else {
      callback(1);
    }
  });
}

function vote(buisnessName, term, delta) {
  buisnessName = buisnessName.toLowerCase();
  term = term.toLowerCase();
  memStore[buisnessName][term]["ratings"] += delta;

  var terms = term.split(" ");
  for (var i in terms) {
    if (memStore[buisnessName][terms[i]]==undefined) {
      memStore[buisnessName][terms[i]] = {"ratings":0};
    }
    memStore[buisnessName][terms[i]]["ratings"] += delta;
  }

  persist();
}

function getItemRatio(buisnessName, term) {
  buisnessName = buisnessName.toLowerCase();
  term = term.toLowerCase();
  if (memStore[buisnessName] === undefined || memStore[buisnessName][term] === undefined) {
    return undefined;
  }
  return memStore[buisnessName][term]["results"] / memStore[buisnessName]["results"] - memStore[buisnessName][term]["ratings"];
}

function getItemRatings(buisnessName, term) {
  buisnessName = buisnessName.toLowerCase();
  term = term.toLowerCase();
  if (memStore[buisnessName] === undefined || memStore[buisnessName][term] === undefined) {
    return 0;
  }
  return memStore[buisnessName][term]["ratings"];
}

function buildTermRatio(buisnessName, term) {
  term = term.toLowerCase();
  var sum = 0;
  var i;
  var terms = term.split(" ");
  for (i=0; i<terms.length; i++) {
    sum -= getItemRatings(buisnessName, terms[i])
  }
  return sum/i;
}


function addItem(buisnessName, term, buisnessScore, termScore) {
  buisnessName = buisnessName.toLowerCase();
  term = term.toLowerCase();
  
  if (memStore[buisnessName] === undefined) {
    memStore[buisnessName] = {};
  }
  memStore[buisnessName]["results"] = buisnessScore;
  if (memStore[buisnessName][term] === undefined) {
    memStore[buisnessName][term] = {}
  }
  memStore[buisnessName][term]["results"] = termScore;
  memStore[buisnessName][term]["ratings"] = 0;
  persist();
}

function persist() {
  fs.writeFile("memStore.json", JSON.stringify(memStore));
}


