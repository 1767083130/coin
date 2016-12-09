'use strict'

const typeUtil = require('./utils/typeUtil');
const co = require('co');

function eventManager(eventName) {
    this.eventName = eventName;
    this.registered = {}
}

/*
* Unregister a listenner.
* Note that if obj is a function. the unregistration will be applied to the dummy obj {}.
*
* @param {String} eventName  - the event name
* @param {Object or Func} obj - object that will listen on this event
* @param {Func} func         - function of the listenners that will be executed
*/
eventManager.prototype.unregister = function (obj, func) {
    if (obj instanceof Function) {
        func = obj
        obj = {}
    }
    for (var reg in this.registered[this.eventName]) {
        if (this.registered[this.eventName][reg] &&
            this.registered[this.eventName][reg].obj === obj && (!func || this.registered[this.eventName][reg].func === func)) {
            this.registered[this.eventName].splice(reg, 1)
            return
        }
    }
}

/*
* Register a new listenner.
* Note that if obj is a function, the function registration will be associated with the dummy object {}
*
* @param {String} eventName  - the event name
* @param {Object or Func} obj - object that will listen on this event
* @param {Func} func         - function of the listenners that will be executed
*/
eventManager.prototype.register = function (obj, func) {
    if (!this.registered[this.eventName]) {
        this.registered[this.eventName] = []
    }
    if (obj instanceof Function) {
        func = obj
        obj = {}
    }
    this.registered[this.eventName].push({
        obj: obj,
        func: func
    })
}

/*
* trigger event.
* Every listenner have their associated function executed
*
* @param {String} eventName  - the event name
* @param {Array}j - argument that will be passed to the exectued function.
*/
eventManager.prototype.trigger = function (args) {
    for (var listener in this.registered[this.eventName]) {
        co(function* (){
            var l = this.registered[this.eventName][listener];
            if(!typeUtil.isArray(args)){
                args = [args]; 
            }

            let res = l.func.apply(l.obj, args);
            if(Object.prototype.toString.call(l.func.apply(l.obj, args)) == '[object Generator]'){
                yield* res;
            }
        }.bind(this)).catch(function(err){
            console.log(err);
            throw err;
        })        
    }
}

module.exports = eventManager