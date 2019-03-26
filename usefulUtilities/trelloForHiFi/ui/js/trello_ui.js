//
//  trello_ui.js
//
//  Created by Zach Fox on 2019-03-25
//  Copyright 2019 High Fidelity, Inc.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

/* globals document setTimeout clearTimeout */

// Emit an event specific to the App JS over the EventBridge.
var APP_NAME = "TRELLO";
function emitAppSpecificEvent(method, data) {
    var event = {
        app: APP_NAME,
        method: method,
        data: data
    };
    EventBridge.emitWebEvent(JSON.stringify(event));
}


function clickedButton(boardID) {
    document.getElementById("loadingContainer").style.display = "block";

    emitAppSpecificEvent("getLists", {
        "boardID": boardID
    });
}


function initializeUI(boardData) {
    document.getElementById("loadingContainer").style.display = "none";

    var listButtonsContainer = document.getElementById("listButtonsContainer");
    for (var i = 0; i < boardData.length; i++) {
        var input = document.createElement("input");
        input.setAttribute("type", "button");
        input.setAttribute("data-id", boardData[i].id);
        input.value = boardData[i].name;
        input.addEventListener("click", function(e) {
            clickedButton(this.getAttribute("data-id"));
        });
        listButtonsContainer.appendChild(input);
    }
}


function gotCardData() {
    document.getElementById("loadingContainer").style.display = "none";
}


// Handle messages over the EventBridge from the App JS
function onScriptEventReceived(scriptEvent) {
    var event = scriptEvent;
    try {
        event = JSON.parse(event);
    } catch (error) {
        return;
    }
    
    if (event.app !== APP_NAME) {
        return;
    }
    
    switch (event.method) {
        case "initializeUI":
            initializeUI(event.data);
            break;


        case "gotCardData":
            gotCardData();
            break;

        default:
            console.log("Unrecognized event method supplied to App UI JS: " + event.method);
            break;
    }
}


// This delay is necessary to allow for the JS EventBridge to become active.
// The delay is still necessary for HTML apps in RC78+.
var EVENTBRIDGE_SETUP_DELAY = 500;
function onLoad() {
    setTimeout(function() {
        EventBridge.scriptEventReceived.connect(onScriptEventReceived);
        emitAppSpecificEvent("eventBridgeReady");
    }, EVENTBRIDGE_SETUP_DELAY);
}


// Call onLoad() once the DOM is ready
document.addEventListener("DOMContentLoaded", function(event) {
    onLoad();
});