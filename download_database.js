import fs from 'fs'

var public_access_token = "LS0iFJNU2dHBEdxTrT3bOJZhujTOVPvo"

var dataArray = [];

var publicRepository = await getDeckCards_byName(public_access_token,"staging",true);
dataArray = publicRepository.cards;

/// Split the arrayData into seperate arrays helpful for our situation. Namely Razors and links.
var data_razors = [];
var data_links = [];
var data_correlations = [];

for(var i = 0; i < dataArray.length; i++) {
    var data_razor = dataArray[i].razor;
    var data_razorID = dataArray[i].razorID;
    var data_linkToID = dataArray[i].linkToID;
    var data_weightedRazorID = dataArray[i].weightedRazorID;
    var data_linkWeight = dataArray[i].linkWeight;
    var data_groupID = dataArray[i].groupID;
    var data_embedding = JSON.parse(dataArray[i].embedding);

    if(data_linkWeight == null) {
        data_linkWeight = 100;
    }

    if(data_weightedRazorID != null) {
        data_correlations.push({
            "uuid1":data_razorID,
            "uuid2":data_linkToID,
            "uuid_weightedRazor":data_weightedRazorID,
            "linkWeight": data_linkWeight
        })
    }
    else if(data_linkToID != null) {
        data_links.push({
            "uuid1":data_razorID,
            "uuid2":data_linkToID,
            "linkWeight": data_linkWeight
        })
    }

    data_razors.push({
        "razor":data_razor,
        "razorID":data_razorID,
        "groupID":data_groupID,
        "embedding":data_embedding
    })
}

//Remove duplicate array values
data_razors = removeDuplicates(data_razors,["razorID"]);
data_links = removeDuplicates(data_links,["uuid1","uuid2"]);
data_correlations = removeDuplicates(data_correlations,["uuid1","uuid2","uuid_weightedRazor","linkWeight"]);
var nodes = []
var links = []
nodes = data_razors.map(razor => ({
    id:razor.razorID,
    name:razor.razor
}))
// nodes.push({
//     id:"index",
//     name:"EDRX"
// })

var ids = nodes.map(node => node.id)
var linkages = []
var originConnections = []
data_links.forEach(link => {
    linkages.push({
        source:link.uuid1,
        target:link.uuid2
    })
    // if(!originConnections.map(con => con.target).includes(link.uuid2)) {
    //     originConnections.push({
    //         source:"index",
    //         target:link.uuid2
    //     })
    // }
})
var weightedConnections = []
var correlations = []
data_correlations.forEach(link => {
    correlations.push({
        source:link.uuid1,
        target:link.uuid2,
    })
    weightedConnections.push({
        source:link.uuid_weightedRazor,
        target:link.uuid1,
    })
})
links = linkages.concat(correlations).concat(weightedConnections).concat(originConnections)
links = links.filter(link => ids.includes(link.source) && ids.includes(link.target))

var result = {
    nodes:nodes,
    links:links
}

fs.writeFile('./app/database.json',JSON.stringify(result),'utf-8',() => {})

// Directus
async function getDeckCards_byName(key, deck, global = false) {
    var decks = await getDecks(key,[deck], global);

    var promises = [];
    for(var d = 0; d < decks.length; d++) {
        var deck = decks[d];
        promises.push(getDeckCards(key, deck));
    }

    var cards = [];
    var relationals = [];
    await Promise.all(promises).then((values) => {
        for(var i = 0; i < values.length; i++) {
            cards = cards.concat(values[i].cards);
            relationals = relationals.concat(values[i].relationals);
        }
    })

    return {
        cards:cards,
        relationals:relationals
    }
}

async function getDeckCards(key, deck) {
    // Get relationals to deck..
    var relationals_to_deck = await directusRequest({
        key:public_access_token,
        method:"get",
        path:"items/decks_002_cards_002",
        data:{
            decks_002_id:{
                _eq:deck.id
            }
        }
    })
    relationals_to_deck = relationals_to_deck.data.data;

    // Get card ids from the relationals...
    var cards_ids = relationals_to_deck.map(relat => relat.cards_002_id);

    // Seperate card ids into chunks...
    var cards_ids_batches = [];
    const chunkSize = 100;
    for (let i = 0; i < cards_ids.length; i += chunkSize) {
        const chunk = cards_ids.slice(i, i + chunkSize);
        cards_ids_batches.push(chunk);
    }

    // Iterate through the chunks and make api requests...
    var getRelationalPromises = [];
    var getCardPromises = [];
    for(var i = 0; i < cards_ids_batches.length; i++) {
        //Get Relations...
        var relational_request = directusRequest({
            key:key,
            method:"get",
            path:"items/decks_002_cards_002",
            data:{
                cards_002_id:{
                    _in: cards_ids_batches[i]
                }
            }
        })
        getRelationalPromises.push(relational_request);

        // Get Cards...
        var card_request = directusRequest({
            key:key,
            method:"get",
            path:"items/cards_002",
            data:{
                id: {
                    _in: cards_ids_batches[i]
                }
            }
        })
        getCardPromises.push(card_request);
    }

    // Accumulate relationals for each card...
    var relationals = [];
    await Promise.all(getRelationalPromises).then((values) => {
        for(var i = 0; i < values.length; i++) {
            relationals = relationals.concat(values[i].data.data);
        }
    })

    // Get unique deck ids from the collected cards...
    var unique_deck_ids = [];
    for(var i = 0; i < relationals.length; i++) {
        if(!unique_deck_ids.includes(relationals[i].decks_002_id)) {
            unique_deck_ids.push(relationals[i].decks_002_id);
        }
    }

    // Get decks...
    var decks = await directusRequest({
        key:public_access_token,
        method:"get",
        path:"items/decks_002",
        data:{
            id: {
                _in: unique_deck_ids
            }
        }
    })
    decks = decks.data.data;

    // Take that info and document what the deployment method was accordingly...
    var cards = [];
    await Promise.all(getCardPromises).then((values) => {
        for(var i = 0; i < values.length; i++) {
            var cards_retrieved = values[i].data.data;

            for(var j = 0; j < cards_retrieved.length; j++) {
                var card = JSON.parse(JSON.stringify(cards_retrieved[j]));
                var relatsForThisCard = relationals.filter(relat => relat.cards_002_id == card.id)
                var decksForThisCard = filterJSONObjectsByMatchingKey(decks,"id",relatsForThisCard,"decks_002_id");

                var decksForThisCard_names = decksForThisCard.map(obj => obj["name"]);

                var deck_for_this_card = "development";
                if(decksForThisCard_names.includes("production")) {
                    deck_for_this_card = "production";
                }
                else if(decksForThisCard_names.includes("staging")) {
                    deck_for_this_card = "staging";
                }
                card.deploy = deck_for_this_card;

                cards.push(card);
            }
        }
    })

    return {
        cards:cards,
        relationals:relationals
    };
}

async function getDecks(key,deckNames = ["production"],global=false) {
    var query = null;
    if(global == true) {
        query = {
            "name": {
                _in:deckNames
            }
        }
    } else {
        query = {
            "name": {
                _in:deckNames
            },
            "user_created":{
                _eq:tags.authorInfo.id
            }
        }
    }

    var decks = await directusRequest({
        key:key,
        method:"get",
        path:"items/decks_002",
        data:query
    })

    decks = decks.data.data;

    return decks;
}

function filterJSONObjectsByMatchingKey(list1, key1, list2, key2) {
    const matchedObjects = [];

    // Create a Set of unique values from list2
    const uniqueValues = new Set(list2.map(obj => obj[key2]));

    // Iterate over each object in list1
    for(const obj of list1) {
        // Check if the key value of obj1 exists in uniqueValues
        if(uniqueValues.has(obj[key1])) {
            matchedObjects.push(obj);
        }
    }

    return matchedObjects;
}

function filterJSONObjectsByKey(list = [], key = "", value = "") {
    var filteredList = [];

    for(var i = 0; i < list.length; i++) {
        if(list[i][key] == value) {
            filteredList.push(list[i]);
        }
    }

    return filteredList
}

function filterJSONObjectsByKeys(list = [], key = "", values = []) {
    var filteredList = [];

    for(var i = 0; i < list.length; i++) {
        if(values.includes(list[i][key])) {
            filteredList.push(list[i]);
        }
    }

    return filteredList
}

function removeDuplicates(arr, keys) {
  var result = arr.filter((thing, index, self) =>
    index ===
    self.findIndex((t) =>
      keys.every((key) => t[key] === thing[key])
    )
  );

  return result;
}

function convertQueryToFilterStr(parameters) {
    var keys = Object.keys(parameters);

    var filterArr = [];
    for(var i = 0; i < keys.length; i++) {
        var field = keys[i];
        var operator = Object.keys(parameters[field])[0];
        var value = parameters[field][operator];

        if(operator == "_eq") {
            filterArr.push("filter[" + field + "][" + operator + "]=" + value);
        }
        else if(operator == "_in") {
            filterArr.push("filter[" + field + "][" + operator + "]=" + value.toString());
        }
    }

    var filterStr = "?" + filterArr.join("&");

    return filterStr;
}

async function directusRequest(that) {
    var directusLink = 'edrx.directus.app';
    var key = that.key;
    var method = that.method;
    var path = that.path;
    var directusData = that.data;
    var retryCount = 3;
    
    let response = null;
    
    try {
        if(method == "get") {
            var query = "";
            if(directusData != null && directusData != "") {
                query = convertQueryToFilterStr(directusData);
            }
    
            var url = 'https://' + directusLink + '/' + path + query + "&limit=-1";
            //console.log(url);

            const request_response = await fetch(url, {
                method:"GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization":"Bearer " + key
                }
            })

            response = {
                data:await request_response.json()
            }
        }
        // else if(method == "post") {
        //     var url = 'https://' + directusLink + '/' + path;
        //     console.log(url);

        //     // response = await web.post(url,
        //     // directusData,
        //     // {
        //     //     headers: {
        //     //         "Authorization": "Bearer " + key
        //     //     },
        //     //     retryCount:retryCount
        //     // });
        // }
        // else if(method == "put") {
        //     // Returns error as of now... might be doing something wrong?
        //     var url = 'https://' + directusLink + '/' + path;
        //     console.log(url);
    
        //     // response = await web.hook({
        //     //     url:url,
        //     //     method:"PUT",
        //     //     headers: {
        //     //         "Authorization": "Bearer " + key
        //     //     },
        //     //     retryCount: retryCount,
        //     //     data: directusData
        //     // })
        // }
        // else if(method == "delete") {
        //     var url = 'https://' + directusLink + '/' + path;
        //     console.log(url);

        //     // response = await web.hook({
        //     //     url:url,
        //     //     method:"DELETE",
        //     //     headers: {
        //     //         "Authorization": "Bearer " + key
        //     //     },
        //     //     retryCount:retryCount,
        //     //     data: directusData
        //     // });
        // }
        // else if(method == "get_query") {
        //     // This was testing for using the data parameter to get information... Unfortunately only the url seems to work.
        //     var url = 'https://' + directusLink + '/' + path;
        //     console.log(url);

        //     // response = await web.hook({
        //     //     url:url,
        //     //     method:"GET",
        //     //     headers: {
        //     //         "Authorization": "Bearer " + key
        //     //     },
        //     //     retryCount:retryCount,
        //     //     data: directusData
        //     // });
        // }
        // else if(method == "authenticate") {
        //     var url = 'https://' + directusLink + '/' + path;
        //     console.log(url);

        //     // response = await web.get(url, {
        //     //     headers: {
        //     //         "Authorization": "Bearer " + key
        //     //     },
        //     //     retryCount:retryCount
        //     // });
        // }
    } catch(e) {
        console.log("ERROR WITH DIRECTUS REQUEST!", e)
    }
    
    return response
}

function getRequest(method, url, bearer_token) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.setRequestHeader("Authorization", "Bearer " + bearer_token)
        xhr.open(method, url);
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}