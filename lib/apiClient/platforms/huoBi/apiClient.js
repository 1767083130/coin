'use strict';

const request = require('request');
const util = require('../clientUtil');
const configUtil = require('../../../configUtil');
                         
/**
 * TOP API Client.
 *
 * @param {Object} options, must set `appKey` and `appSecret`.
 * @constructor
 */

function HuoBiClient(options) {
    if (!(this instanceof HuoBiClient)) {
        return new HuoBiClient(options);
    }
    options = options || {};
    if (!options.appKey || !options.appSecret) {
        throw new Error('appKey or appSecret need!');
    }
    
    this.REST_URL = options.restUrl || configUtil.getRestUrl('huobi');
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
HuoBiClient.prototype.invoke = function (method, params, reponseNames, defaultResponse, type, callback) {
    params = params || [];
    params.method = method;
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

HuoBiClient.prototype._wrapJSON = function (s) {
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
HuoBiClient.prototype.request = function (params, type,apiName, callback) {
    if (typeof type === 'function') {
        callback = type;
        type = null;
    }
    var err = util.checkRequired(params, 'method');
    if (err) {
        return callback(err);
    }
    var args = {
        method: apiName,
        access_key: this.appKey,
        created: this.timestamp() //10位时间戳
    };
    for (var k in params) {
        if(typeof params[k] == "object"){
            args[k] = JSON.stringify(params[k]);
        } else {
            args[k] = params[k];
        }
    }
    args.sign = this.sign(args);
    args.market = "cny"; //选填。此项不参与sign签名过程，交易市场(cny:人民币交易市场，usd:美元交易市场，默认是cny)

    type = type || 'POST';
    //var options = {method: type, data: args, agent: this.agent,timeout:100000 };
    var that = this;
    var serverUrl = that.buildMethodUrl(that.REST_URL,apiName);

    request({
        url: serverUrl,
        method: type,
        timeout:60000,
        form: args
        // headers: { "Content-type": "application/x-www-form-urlencoded"},
        // body: basestring
    }, function (err, response, body) {
        let error;
        if(!err){
            var data = JSON.parse(body);
            if (data) {
                callback(null,data);
            }
            else{
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

HuoBiClient.prototype.buildMethodUrl = function(serverUrl,methodName){
    if (!methodName){
        return serverUrl;
    }

    var methodUrl = methodName.replace(".", "/").replace("\\", "/");
    if (serverUrl.indexOf("/",serverUrl.length -1) == -1){ //endsWith("/"
        serverUrl += "/";
    }

    return serverUrl + methodUrl;
};


 /**
 * 模仿PHP的time()函数
 * @return 返回当前时间戳
 */
HuoBiClient.prototype.timestamp = function () {
    //return util.YYYYMMDDHHmmss();
    return parseInt((new Date()).getTime() / 1000);
};

/**
 * Sign API request.
 * see http://open.taobao.com/doc/detail.htm?id=111#s6
 *
 * @param  {Object} params
 * @return {String} sign string
 */
HuoBiClient.prototype.sign = function (params) {
    params['secret_key'] = this.appSecret;

    var sorted = Object.keys(params).sort();
    var basestring = ''; //this.appSecret;
    for (var i = 0, l = sorted.length; i < l; i++) {
        var k = sorted[i];
        basestring += k + '=' + params[k];
        if(i != sorted.length - 1){
            basestring += '&';
        }
    }

    var token = util.md5(basestring).toLowerCase();
    delete params.secret_key;

    return token;
};

/**
 * execute top api
 */
HuoBiClient.prototype.execute = function (apiname,params, callback) {
    this.invoke(apiname, params, [apiname], null, 'POST', callback);
};

exports.HuoBiClient = HuoBiClient;
