'use strict';

const request = require('request');
const util = require('../clientUtil');
const configUtil = require('../../../configUtil');
const apiRunSettings = require('../../apiRunSettings');
const Site_Name = 'chbtc';
                         
/**
 * TOP API Client.
 *
 * @param {Object} options, must set `appKey` and `appSecret`.
 * @constructor
 */

function ChbtcClient(options) {
    if (!(this instanceof ChbtcClient)) {
        return new ChbtcClient(options);
    }

    options = options || {};
    if (!options.appKey || !options.appSecret) {
        throw new Error('appKey or appSecret need!');
    }
    
    this.REST_URL = options.restUrl || configUtil.getRestUrl(Site_Name);
    this.appKey = options.appKey;
    this.appSecret = options.appSecret;
}

/**
 * Invoke an api by method name.
 *
 * @param {String} method, method name
 * @param {Object} params
 * @param {Array} reponseNames, e.g. ['tmall_selected_items_search_response', 'tem_list', 'selected_item']
 * @param {Object} defaultResponse
 * @param {String} type
 * @param {Function(err, response)} callback
 */
ChbtcClient.prototype.invoke = function (method, params, reponseNames, defaultResponse, type, callback) {
    params = params || [];
    //params.method = method;
    var apiName = reponseNames[0];
    this.request(params, type, apiName,function (err, result) {
        if (err) {
            return callback(err);
        }
        
        var response = result;
        if (response === undefined) {
            response = defaultResponse;
        }
        callback(null, response);
    });
};

ChbtcClient.prototype._wrapJSON = function (s) {
    var matchs = s.match(/\"id\"\:\s?\d{16,}/g);
    if (matchs) {
        for (var i = 0; i < matchs.length; i++) {
            var m = matchs[i];
            s = s.replace(m, '"id":"' + m.split(':')[1].trim() + '"');
        }
    }
    return s;
};

var IGNORE_ERROR_CODES = {
    'isv.user-not-exist:invalid-nick': 1
};

/**
 * Request API.
 *
 * @param {Object} params
 * @param {String} [type='GET']
 * @param {Function(err, result)} callback
 * @public
 */
ChbtcClient.prototype.request = function (params, type,apiName, callback) {
    if (typeof type === 'function') {
        callback = type;
        type = null;
    }
    // var err = util.checkRequired(params, 'method');
    // if (err) {
    //     return callback(err);
    // }
    var args = {
        method: apiName,
        accesskey: this.appKey
    };
    for (var k in params) {
        if(typeof params[k] == "object"){
            args[k] = JSON.stringify(params[k]);
        } else {
            args[k] = params[k];
        }
    }
    args.sign = this.sign(args);
    args.reqTime = this.timestamp(); //时间戳

    type = type || 'POST';
    //var options = {method: type, data: args, agent: this.agent,timeout:100000 };
    var that = this;
    var serverUrl = that.buildMethodUrl(that.REST_URL,apiName,args);

    request({
        url: serverUrl,
        method: type,
        timeout:60000
        //form: args
        // headers: { "Content-type": "application/x-www-form-urlencoded"},
        // body: basestring
    }, function (err, response, body) {
        let error;
        if(!err){
            var data = JSON.parse(body);
            if (data) {
                callback(null,data);
            }else{
                error = new Error();
                error.name = 'TkellClientError';
                // err.message = data.ErrMsg;
                // err.code = data.errorCode;
                // err.subCode = data.ErrSubCode;
                // //err.data = buffer.toString();
                // err.subMessage = data.ErrSubMsg;
            }
        }
        else{
            error = new Error();
            error.name = 'TkellClientError';
        }

        if(error){
            callback(error);
        }
    });
};

ChbtcClient.prototype.buildMethodUrl = function(serverUrl,methodName,params){
    if (!methodName){
        return serverUrl;
    }

    var methodUrl = methodName.replace(".", "/").replace("\\", "/");
    if (serverUrl.indexOf("/",serverUrl.length -1) == -1){ //endsWith("/"
        serverUrl += "/";
    }
    
    var basestring  = '';
    var keys = Object.keys(params);
    for (var i = 0, l = keys.length; i < l; i++) {
        var k = keys[i];
        basestring += k + '=' + params[k];
        if(i != keys.length - 1){
            basestring += '&';
        }
    }

    if(basestring){
        basestring = '?' + basestring;
    }

    return serverUrl + methodUrl + basestring;
};


 /**
 * 模仿PHP的time()函数
 * @return 返回当前时间戳
 */
ChbtcClient.prototype.timestamp = function () {
    //return util.YYYYMMDDHHmmss();

    let time = +new Date();
    let nonce = time;
    let lastedTime = apiRunSettings.getLastedTime(Site_Name,this.appKey);

    //交易网站单个用户限制每秒钟10次访问，一秒钟内10次以上的请求，将会视作无效。
    if(lastedTime && time <= lastedTime + 100){ //如果需要等待,这里简化处理，每0.1s只能访问一次
        util.wait(lastedTime + 100 - time + 1);
        this.timestamp();
    } else {
        apiRunSettings.setLastedTime(Site_Name,this.appKey,time)
        return nonce;
    }

    //return parseInt((new Date()).getTime());
};

/**
 * Sign API request.
 * see http://open.taobao.com/doc/detail.htm?id=111#s6
 *
 * @param  {Object} params
 * @return {String} sign string
 */
ChbtcClient.prototype.sign = function (params) {
    //var sorted = Object.keys(params).sort();
    var sorted = Object.keys(params);
    var basestring = ''; //this.appSecret;
    for (var i = 0, l = sorted.length; i < l; i++) {
        var k = sorted[i];
        basestring += k + '=' + params[k];
        if(i != sorted.length - 1){
            basestring += '&';
        }
    }

    var token = util.md5(basestring,util.sha1(this.appSecret));
    return token;
};

/**
 * execute top api
 */
ChbtcClient.prototype.execute = function (apiname,params, callback) {
    this.invoke(apiname, params, [apiname], null, 'POST', function(err,res){
        let callRes = this._getCallRes(res);
        if(err || !callRes.isSuccess){
            console.log('chbtc api call retry');
            this.invoke(apiname, params, [apiname], null, 'POST', function(err,res){
                callback(err,res);  
            }.bind(this));
        } else {
            callback(err,res);
        }
    }.bind(this));
};

ChbtcClient.prototype._getCallRes = function(data){
    if(data.hasOwnProperty('code') && data.code != 1000){
        return { isSuccess: false, message: data.message,code: data.code  };
    } 

    return { isSuccess: true, message: data.message,code: data.code  };
}

exports.ChbtcClient = ChbtcClient;
