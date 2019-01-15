//
// bingoWheel.js
// 
// Created by Rebecca Stankus on 10/16/2018
// Copyright High Fidelity 2018
//
// Licensed under the Apache 2.0 License
// See accompanying license file or http://apache.org/
//

/* global AccountServices, Audio, Entities, Math, MyAvatar, Script, String */

(function() {
    var ANGULAR_VELOCITY = {
        x: 0,
        y: 0,
        z: -10
    };
    var ANGULAR_VELOCITY_CHECK_MS = 100;
    var CHECKING_INTERVAL_DELAY_MS = 100;
    var USERS_ALLOWED_TO_SPIN_WHEEL = ['ryan','Becky'];
    var BLIP_SOUND = SoundCache.getSound(Script.resolvePath('sounds/blip.wav'));
    var SPIN_SOUND = SoundCache.getSound(Script.resolvePath('sounds/wheelSpin.mp3'));
    var WAIT_BETWEEN_SPINS_MS = 4000;
    var BINGO_WHEEL_NUMBER = "{3a78b930-eba5-4f52-b906-f4fd78ad1ca9}";

    var _this;
    var possibleBingoCalls = [];
    var listCounter = 0;
    var angularVelocityDecrement = 0.5;
    var position;
    var canSpin = true;
    var alreadyCalled = [];
    var interval;
    var minimumVelocityLimit = -10;
    

    // *************************************
    // START UTILITY FUNCTIONS
    // *************************************

    /* SHUFFLE AN ARRAY: Return randomized array */
    function shuffle(array) {
        var currentIndex = array.length, temporaryValue, randomIndex;
      
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }

    /* PLAY A SOUND: Plays the specified sound at the specified volume */
    var injector;
    function playSound(sound, volume) {
        if (sound.downloaded) {
            if (injector) {
                injector.stop();
            }
            // print("PLAYING SOUND AT ", JSON.stringify(position));
            injector = Audio.playSound(sound, {
                position: position,
                volume: volume
            });
        }
    }

    // *************************************
    // END UTILITY FUNCTIONS
    // *************************************

    var Wheel = function() {
        _this = this;
    };

    Wheel.prototype = {
        remotelyCallable: ['receiveNumbersFromWheel'],
        
        /* ON LOADING THE APP: Save a reference to this entity ID and its position */
        preload: function(entityID) {
            _this.entityID = entityID;
            position = Entities.getEntityProperties(_this.entityID, 'position').position;
        },

        /* RECEIVE NUMBERS CALLED DATA FROM SERVER: Take a list of called numbers and add the appropriate prefix letter 
        then compare each possible bingo call to that list. Save all calls that have not been called into a new list and 
        shuffle that list. */
        receiveNumbersFromWheel: function(id, numbers) {
            print("I HAZ DA NUMBERZ! ", numbers);
            alreadyCalled = JSON.parse(numbers[0]);
            var i = 1;
            var bingoCall;
            while (i < 16) {
                bingoCall = "B " + String(i);
                if (alreadyCalled.indexOf(bingoCall) === -1) {
                    possibleBingoCalls.push(bingoCall);
                }
                i++;
            }
            while (i < 31) {
                bingoCall = "I " + String(i);
                if (alreadyCalled.indexOf(bingoCall) === -1) {
                    possibleBingoCalls.push(bingoCall);
                }
                i++;
            }
            while (i < 46) {
                bingoCall = "N " + String(i);
                if (alreadyCalled.indexOf(bingoCall) === -1) {
                    possibleBingoCalls.push(bingoCall);
                }
                i++;
            }
            while (i < 61) {
                bingoCall = "G " + String(i);
                if (alreadyCalled.indexOf(bingoCall) === -1) {
                    possibleBingoCalls.push(bingoCall);
                }
                i++;
            }
            while (i < 76) {
                bingoCall = "O " + String(i);
                if (alreadyCalled.indexOf(bingoCall) === -1) {
                    possibleBingoCalls.push(bingoCall);
                }
                i++;
            }
            shuffle(possibleBingoCalls);
        },

        /* ON MOUSE CLICKING THE WHEEL (THIS WILL INCLUDE TRIGGERING ON WHEEL): If a right mouse click, ignore. Otherwise, 
        if at least 4 seconds have passed since the last spin, check the user's name aginst those allowed to spin the wheel. 
        If the user is allowed to spin, give the wheel an angular velocity of -10 in the z direction and play a ticking 
        sound, then set a timeout for 100MS to ensure we do not check velocity before the wheeel is spinning. Next, clear 
        any interval to be sure we do not have more than one interval running and set a new interval to check the velocity 
        of the wheel every 100MS. At this point, we have a shuffled list of possible bingo calls and the last number in 
        that list will be the final number that is chosen. To give the appearance of the wheel spinning through the list, 
        we update the text entity every interval, iterating over the list of possible calls. When the wheel has slowed to 
        a minimum velocity, we update the text entity with the final number. so, for every 100MS, we check the velocity. 
        If velocity is greater than the minimum, less than 0, and we are not on the final interval where the final number 
        will be shown, we edit the text with the next number in the list of possible numbers and increase the minimum 
        velocity to dynamically narrow the amount of time before the text entity will change again. If the angular velocity 
        is between 0 and -0.1 and we are not on the final text edit, the wheel will stop spinning soon so we pop the array 
        of possible calls and edit the text with the popped call. We send the called number to the server script and set 
        a flag that this is the final number. Now, the wheel text will not be edited during subsequent intervals and when 
        it slows to less than -0.05, we consider the spin finished and play the final beep sound, clear the interval, reset 
        the list of possible bingo calls, and set a timeout for 4seconds before the wheel can be spun again to allow time 
        for the server script to complete its tasks for this spin. */
        mousePressOnEntity: function(entityID, mouseEvent) {
            if (!mouseEvent.button === "Primary") {
                return;
            }
            if (canSpin){
                canSpin = false;
                Entities.callEntityServerMethod(_this.entityID, 'getCalledNumbers', [MyAvatar.sessionUUID]);
                if (USERS_ALLOWED_TO_SPIN_WHEEL.indexOf(AccountServices.username) >= 0) {
                    Entities.editEntity(_this.entityID, {
                        angularVelocity: ANGULAR_VELOCITY
                    });
                    playSound(SPIN_SOUND, 0.8);
                    Script.setTimeout(function() {
                        if (interval) {
                            Script.clearInterval(interval);
                        }
                        var finalNumber = false;
                        var bingoCall;
                        interval = Script.setInterval(function() {
                            var currentAngularVelocity = Entities.getEntityProperties(
                                _this.entityID, 'angularVelocity').angularVelocity;
                            if (currentAngularVelocity.z >= minimumVelocityLimit && currentAngularVelocity.z 
                                    < 0 && !finalNumber) {
                                Entities.editEntity(BINGO_WHEEL_NUMBER, {
                                    text: possibleBingoCalls[listCounter],
                                    lineHeight: 1.58
                                });
                                listCounter++;
                                listCounter = listCounter >= possibleBingoCalls.length ? 0 : listCounter;
                                angularVelocityDecrement *= 1.001;
                                minimumVelocityLimit += angularVelocityDecrement;
                            } else if (currentAngularVelocity.z >= -0.1 && !finalNumber) {
                                finalNumber = true;
                                bingoCall = possibleBingoCalls.pop();
                                if (!bingoCall) {
                                    return;
                                }
                                Entities.callEntityServerMethod(_this.entityID, 'addCalledNumber', [bingoCall]);
                                Entities.editEntity(BINGO_WHEEL_NUMBER, {
                                    text: bingoCall
                                });
                            } else if (currentAngularVelocity.z >= -0.05) {
                                if (interval) {
                                    playSound(BLIP_SOUND, 0.2);
                                    Script.clearInterval(interval);
                                    possibleBingoCalls = [];
                                    Script.setTimeout(function() {
                                        canSpin = true;
                                    }, WAIT_BETWEEN_SPINS_MS);
                                }
                            }
                        }, ANGULAR_VELOCITY_CHECK_MS);
                    }, CHECKING_INTERVAL_DELAY_MS);
                }
            }
        },

        /* ON UNLOADING THE APP: Clear any interval */
        unload: function(entityID) {
            if (interval) {
                Script.clearInterval(interval);
            }
        }
    };
    
    return new Wheel();
});