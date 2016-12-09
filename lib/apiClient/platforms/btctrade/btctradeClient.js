'use strict';

const request = require('request');
const util = require('../clientUtil');
const configUtil = require('../../configUtil');
const apiRunSettings = require('../../apiRunSettings');

const Site_Name = 'btctrade';
                         
/**
 * TOP API Client.
 *
 * @param {Object} options, must set `appKey` and `appSecret`.
 * @constructor
 */

function BtctradeClient(options) {
    if (!(this instanceof BtctradeClient)) {
        return new BtctradeClient(options);
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
BtctradeClient.prototype.invoke = function (method, params, reponseNames, defaultResponse, type, callback) {
    params = params || [];
    //params.method = method;
    var apiName = method;
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

BtctradeClient.prototype._wrapJSON = function (s) {
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
BtctradeClient.prototype.request = function (params, type,apiName, callback) {
    if (typeof type === 'function') {
        callback = type;
        type = null;
    }
    // var err = util.checkRequired(params, 'method');
    // if (err) {
    //     return callback(err);
    // }

    // 请求API的参数都要参与签名(signature除外)，例如，
    // 请求参数：{key: xxxxxx, coin: btc, amount=1.234, price: 543, version: 2}
    // 生成待签名字符串为：key=xxxxxx&coin=btc&amount=1.234&price=543&version=2
    // 注意：version参数必选，否则无法通过验证，传值固定为 2
    var args = {
        //method: apiName,
        key: this.appKey,
        nonce: this.timestamp(), //10位时间戳
        version: 2
    };
    for (var k in params) {
        if(typeof params[k] == "object"){
            args[k] = JSON.stringify(params[k]);
        } else {
            args[k] = params[k];
        }
    }
    
    //args.nonce = this.timestamp();
    args.signature = this.sign(args);
    //args.market = "cny"; //选填。此项不参与sign签名过程，交易市场(cny:人民币交易市场，usd:美元交易市场，默认是cny)

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
                // err.code = data.ErrCode;
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

BtctradeClient.prototype.buildMethodUrl = function(serverUrl,methodName){
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
BtctradeClient.prototype.timestamp = function () {
    let time = +new Date();
    let nonce = time; //(time / 1000) | 0;
    let waitMillions = 1000;
    let lastedTime = apiRunSettings.getLastedTime(Site_Name,this.appKey);

    if(lastedTime && time <= lastedTime + waitMillions){ //如果需要等待
        console.log("等待时间：" + (lastedTime + waitMillions - time + 1));
        util.wait(lastedTime + waitMillions - time + 1);
        this.timestamp();
    } else {
        //nonce = (new Date()).getTime().toString() + ((Math.random() * 100000 | 0)) + 0;
        apiRunSettings.setLastedTime(Site_Name,this.appKey,time);
        console.log(nonce);
        return nonce;
    }

    //return util.YYYYMMDDHHmmss();
    //return (new Date()).getTime().toString() + ((Math.random() * 100000 | 0) + lastNonceIndex) ;
};

/**
 * Sign API request.
 * see http://open.taobao.com/doc/detail.htm?id=111#s6
 *
 * @param  {Object} params
 * @return {String} sign string
 */
BtctradeClient.prototype.sign = function (params) {
    //params['secret_key'] = this.appSecret;

    //var sorted = Object.keys(params).sort();
    var sorted = Object.keys(params);
    var basestring = ''; //this.appSecret;
    for (var i = 0, l = sorted.length; i < l; i++) {
        var k = sorted[i];
        if(params[k] !== undefined){
            basestring += k + '=' + params[k];
            basestring += '&';
        }
    }

    if(basestring.charAt(basestring.length - 1) == '&'){
        basestring = basestring.substring(0,basestring.length - 1);
    }

    //var token = util.md5(basestring).toLowerCase();
    var token = util.sha256(basestring, util.md5(this.appSecret));
    delete params.secret_key;

    return token;
};

/**
 * execute top api
 */
BtctradeClient.prototype.execute = function (apiname,params, callback) {
    this.invoke(apiname, params, [apiname], null, 'POST', function(err,res){
        let callRes = this._getCallRes(res);
        if(err || !callRes.isSuccess){
            console.log(callRes.message);
            console.log('btctrade api call retry');
            this.invoke(apiname, params, [apiname], null, 'POST', function(err,res){
                callback(err,res);  
            }.bind(this));
        } else {
            callback(err,res);
        }
    }.bind(this));
    //this.invoke(apiname, params, [apiname], null, 'POST', callback);
};

BtctradeClient.prototype._getCallRes = function(data){
    if(data.hasOwnProperty('result')){
        return { isSuccess: data.result, message: data.message };
    } 

    return { isSuccess: true };
}

exports.BtctradeClient = BtctradeClient;
