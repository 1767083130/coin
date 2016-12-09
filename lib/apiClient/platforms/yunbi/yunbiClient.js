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

function YunbiClient(options) {
    if (!(this instanceof YunbiClient)) {
        return new YunbiClient(options);
    }
    options = options || {};
    if (!options.appKey || !options.appSecret) {
        throw new Error('appKey or appSecret need!');
    }
    
    this.REST_URL = options.restUrl || configUtil.getRestUrl('yunbi');
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
YunbiClient.prototype.invoke = function (method, params, reponseNames, defaultResponse, type, callback) {
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

YunbiClient.prototype._wrapJSON = function (s) {
    var matchs = s.match(/\"id\"\:\s?\d{16,}/g);
    if (matchs) {
        for (var i = 0; i < matchs.length; i++) {
            var m = matchs[i];
            s = s.replace(m, '"id":"' + m.split(':')[1].trim() + '"');
        }
    }
    return s;
};

/**
 * Request API.
 *
 * @param {Object} params
 * @param {String} [type='GET']
 * @param {Function(err, result)} callback
 * @public
 */
YunbiClient.prototype.request = function (params, type,apiName, callback) {
    if (typeof type === 'function') {
        callback = type;
        type = null;
    }
    var err = util.checkRequired(params, 'method');
    if (err) {
        return callback(err);
    }
    type = type || 'POST';

    let prefix = `${type}|${apiName}|`; // GET|/api/v2/markets|
    var args = {
        access_key: this.appKey,
        tonce: this.timestamp() //时间戳
    };
    for (var k in params) {
        if(typeof params[k] == "object"){
            args[k] = JSON.stringify(params[k]);
        } else {
            args[k] = params[k];
        }
    }
    args.signature = this.sign(args,prefix);

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

YunbiClient.prototype.buildMethodUrl = function(serverUrl,methodName){
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
YunbiClient.prototype.timestamp = function () {
    //return util.YYYYMMDDHHmmss();
    return (new Date()).getTime();
};

/**
 * Sign API request.
 * see http://open.taobao.com/doc/detail.htm?id=111#s6
 *
 * @param  {Object} params
 * @return {String} sign string
 */
YunbiClient.prototype.sign = function (params,prefix) {
    var sorted = Object.keys(params).sort();
    var basestring = ''; //this.appSecret;
    for (var i = 0, l = sorted.length; i < l; i++) {
        var k = sorted[i];
        basestring += k + '=' + params[k];
        if(i != sorted.length - 1){
            basestring += '&';
        }
    }

    var token = util.sha256(prefix + basestring,this.appSecret);
    return token;
};

/**
 * execute top api
 */
YunbiClient.prototype.execute = function (apiname,params, callback) {
    let method = params.method || 'POST';
    delete params.method;
    this.invoke(apiname, params, [apiname], null, method, callback);
};

exports.YunbiClient = YunbiClient;
