//
// trello_app.js
// Created by Zach Fox on 2019-03-25
// Copyright High Fidelity 2019
//
// Licensed under the Apache 2.0 License
// See accompanying license file or http://apache.org/
//

(function() {
    
    // Returns the position in front of the given "position" argument, where the forward vector is based off
    // the "orientation" argument and the amount in front is based off the "distance" argument.
    function inFrontOf(distance, position, orientation) {
        return Vec3.sum(position || MyAvatar.position,
            Vec3.multiply(distance, Quat.getForward(orientation || MyAvatar.orientation)));
    }


    function toRightOf(distance, position, orientation) {
        return Vec3.sum(position || MyAvatar.position,
            Vec3.multiply(distance,
                Quat.getForward(
                    Quat.multiply((orientation || MyAvatar.orientation), {"w": 0.7071, "x": 0, "y": -0.7071, "z": 0}))));
    }


    var request = Script.require("request").request;
    var CONFIG = Script.require(Script.resolvePath("config/config.json"));
    function onEventBridgeReady() {
        if (!(CONFIG.trelloAPIKey && CONFIG.trelloServerToken)) {
            return;
        }

        var requestURL = "https://api.trello.com/1/members/me/boards?key=" +
            CONFIG.trelloAPIKey + "&token=" + CONFIG.trelloServerToken;
        request({
            "uri": requestURL
        }, function(error, response) {
            if (error) {
                return;
            }

            var boardDataForUI = [];
            var currentBoardDataForUI = {};
            var currentResponseObject = {};
            for (var i = 0; i < response.length; i++) {
                currentBoardDataForUI = {};
                currentResponseObject = response[i];
                currentBoardDataForUI["name"] = currentResponseObject["name"];
                currentBoardDataForUI["id"] = currentResponseObject["id"];
                boardDataForUI.push(currentBoardDataForUI);
            }
            
            ui.sendMessage({
                app: APP_NAME,
                method: "initializeUI",
                data: boardDataForUI
            });
        });
    }


    var currentListData = [];
    var currentCardData = [];
    var rezzedCards = [];
    var CARD_ENTITY_PROPERTIES = {
        "type": "Text",
        "dimensions": {
            "x": 1.1,
            "y": 0.6,
            "z": 0.01
        },
        "rotation": {
            "x": 0,
            "y": 0,
            "z": 0,
            "w": 1
        },
        "grab": {
            "equippableLeftRotation": {
                "x": 0,
                "y": 0,
                "z": 0,
                "w": 1
            },
            "equippableRightRotation": {
                "x": 0,
                "y": 0,
                "z": 0,
                "w": 1
            }
        },
        "damping": 0,
        "angularDamping": 0,
        "collisionless": true,
        "ignoreForCollisions": true,
        "lineHeight": 0.06,
        "clientOnly": false,
        "avatarEntity": false,
        "localEntity": false,
        "faceCamera": false,
        "isFacingAvatar": false
    };
    var CARD_FRONT_OFFSET_INITIAL_M = 1.0;
    var CARD_FRONT_OFFSET_M = 0.1;
    var CARD_RIGHT_OFFSET_M = 0.5;
    function rezAllCards() {
        derezAllCards();

        var currentCardLocation = inFrontOf(CARD_FRONT_OFFSET_INITIAL_M, MyAvatar.position, MyAvatar.orientation);
        var firstCardInListLocation;
        CARD_ENTITY_PROPERTIES.rotation = MyAvatar.orientation;

        for (var i = 0; i < currentListData.length; i++) {
            firstCardInListLocation = currentCardLocation;

            for (var j = 0; j < currentListData[i].cards.length; j++) {
                var currentCard = currentListData[i].cards[j];
                var currentCardEntityProps = CARD_ENTITY_PROPERTIES;

                currentCardEntityProps.text = currentCard.name;
                currentCardEntityProps.position = currentCardLocation;

                rezzedCards.push(Entities.addEntity(currentCardEntityProps));

                currentCardLocation = inFrontOf(
                    CARD_ENTITY_PROPERTIES.dimensions.z + CARD_FRONT_OFFSET_M, currentCardLocation, currentCardLocation.orientation);
            }

            currentCardLocation = toRightOf(
                CARD_ENTITY_PROPERTIES.dimensions.x + CARD_RIGHT_OFFSET_M,
                firstCardInListLocation, currentCardLocation.orientation);
        }        

        ui.sendMessage({
            app: APP_NAME,
            method: "gotCardData"
        });
    }


    function derezAllCards() {
        for (var i = 0; i < rezzedCards.length; i++) {
            Entities.deleteEntity(rezzedCards[i]);
        }
    }


    function fillListsWithCards() {
        for (var i = 0; i < currentCardData.length; i++) {
            var currentCard = currentCardData[i];
            var currentCardListID = currentCard.listID;

            for (var j = 0; j < currentListData.length; j++) {
                if (currentListData[j].id === currentCardListID) {
                    currentListData[j].cards.push(currentCard);
                    break;
                }
            }
        }

        rezAllCards();
    }


    function getCards(boardID) {
        var requestURL = "https://api.trello.com/1/boards/" +
            boardID + "/cards?key=" + CONFIG.trelloAPIKey + "&token=" + CONFIG.trelloServerToken;
        request({
            "uri": requestURL
        }, function(error, response) {
            if (error) {
                return;
            }
            
            currentCardData = [];
            for (var i = 0; i < response.length; i++) {
                currentCardData.push({
                    "id": response[i]["id"],
                    "listID": response[i]["idList"],
                    "name": response[i]["name"],
                    "pos": response[i]["pos"],
                    "labels": response[i]["labels"]
                });
            }

            fillListsWithCards();
        });
    }


    function getLists(boardID) {
        var requestURL = "https://api.trello.com/1/boards/" +
            boardID + "/lists?key=" + CONFIG.trelloAPIKey + "&token=" + CONFIG.trelloServerToken;
        request({
            "uri": requestURL
        }, function(error, response) {
            if (error) {
                return;
            }

            currentListData = [];
            for (var i = 0; i < response.length; i++) {
                currentListData.push({
                    "id": response[i]["id"],
                    "name": response[i]["name"],
                    "cards": []
                });
            }

            getCards(boardID);
        });
    }


    // Handle EventBridge messages from UI JavaScript.
    function onWebEventReceived(event) {
        if (event.app !== APP_NAME) {
            return;
        }
        
        switch (event.method) {
            case "eventBridgeReady":
                onEventBridgeReady();
                break;


            case "getLists":
                getLists(event.data["boardID"]);
                break;


            default:
                console.log("Unrecognized event method supplied to App JS: " + event.method);
                break;
        }
    }


    function onScriptEnding() {
        derezAllCards();
    }


    var ui;
    var AppUi = Script.require('appUi');
    var appPage = Script.resolvePath('ui/trello_ui.html?0');
    var APP_NAME = "TRELLO";
    function startup() {
        ui = new AppUi({
            buttonName: APP_NAME,
            home: appPage,
            graphicsDirectory: Script.resolvePath("assets/icons/"),
            onMessage: onWebEventReceived
        });
    }
    Script.scriptEnding.connect(onScriptEnding);
    startup();
})();
