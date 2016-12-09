'use strict';
const HuoBiClient = require('./huoBiClient').HuoBiClient;
const ApiBase = require('../ApiBase');
const Decimal = require('decimal.js');
const customConfig = require('../../../../config/customConfig');
const request = require('request');

const Site_Name = "huobi";
const API_VERSION = "v1";

class HuoBiApi extends ApiBase {
    constructor(options){
        super(); 

        let app = customConfig.platforms.huobi;
        let defaultOptions = {
            restUrl: app.restUrl,
            appKey: app.appKey,
            appSecret: app.appSecret
        };

        let newOptions = Object.assign({},defaultOptions,options);
        this.client = new HuoBiClient(newOptions);
    }

    getRealPrice(symbol,callBack){
        let detail_url = '';
        if(symbol == 'btc'){
            detail_url = 'http://api.huobi.com/staticmarket/detail_btc_json.js';
        }
        else if(symbol == 'ltc'){
            detail_url = 'http://api.huobi.com/staticmarket/detail_ltc_json.js';
        }
    
        var requestPrices = function(cb){
            let time = new Date();
            request({
                url: detail_url,
                method: "GET"
            }, function (error, response, body) {
                if(error){
                    return cb(error);
                }

                var data = JSON.parse(body);
                var detail = {
                    time: time,
                    site: Site_Name,  
                    buys: data.buys, //买10 //{ amount: Number,level:Number,price:Number }
                    sells: data.sells, //卖10 //{ amount: Number,level:Number,price:Number }
                    symbol: data.symbol, //类型;
                    
                    /* 下面这些数据可有可无  */
                    totalNum: data.amount, //成交量
                    level: data.level, //涨幅
                    totalAmount: data.total,  //总量（人民币） 
                    priceHigh: data.p_high, //最高
                    priceLow: data.p_low, //最低
                    priceLast: data.p_last, //收盘价
                    priceNew: data.p_new, //最新
                    priceOpen: data.p_open //开盘
                };
                
                cb(error,detail);
            });
        };

        if(callBack && typeof callBack == 'function'){
            requestPrices(callBack);
        } else {
            var promise = new Promise(function(resolve, reject) {
                requestPrices(function(error,body){
                    if(error){
                        reject(error);
                    }else{
                        resolve(body);
                    }
                });
            });

            return promise;
        }
    }

    getDayPrices (date,symbol,callBack){
        let detail_url = '';
        if(symbol == 'btc'){
            detail_url = 'http://api.huobi.com/staticmarket/detail_btc_json.js';
        }
        else if(symbol == 'ltc'){
            detail_url = 'http://api.huobi.com/staticmarket/detail_ltc_json.js';
        }

        var requestPrices = function(cb){
            let time = new Date();
            request({
                url: detail_url,
                method: "GET"
            }, function (error, response, body) {
                if(error){
                    return cb(error);
                }

                var data = JSON.parse(body);
                var detail = {
                    time: time,
                    site: Site_Name,  

                    totalNum: data.amount, //成交量
                    level: data.level, //涨幅
                    highPrice: data.p_high, //最高
                    lowPrice: data.p_low, //最低
                    endPrice: data.p_last, //收盘价
                    newPrice: data.p_new, //最新
                    startPrice: data.p_open, //开盘
                    totalAmount: data.total,  //总量（人民币） 
                    symbol: data.symbol, //类型;
                    
                    /* 下面这些数据可有可无  */
                    buys: data.buys, //买10 //{ amount: Number,level:Number,price:Number }
                    sells: data.sells //卖10 //{ amount: Number,level:Number,price:Number }
                };
                
                cb(error,detail);
            });
        };

        if(callBack && typeof callBack == 'function'){
            requestPrices(callBack);
        }
        else{
            var promise = new Promise(function(resolve, reject) {
                requestPrices(function(error,body){
                    if(error){
                        reject(error);
                    }else{
                        resolve(body);
                    }
                });
            });

            return promise;
        }
    }

    buy(day,site,symbol,callBack){
        let apiname = 'get_account_info';

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,data);
            });
        }
        else{
            var promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,null, function(error,data){
                    if(error){
                        reject(error);
                    }
                    else{
                        resolve(data);
                    }
                });
            });

            return promise;
        }
    }

    sell(symbol,day,site,callBack){
        let apiname = 'get_account_info';

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,data);
            });
        }
        else{
            var promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,null, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(data);
                    }
                });
            });

            return promise;
        }
    }

    getAccountInfo(callBack){ //todo
        let apiname = 'get_account_info';

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,data);
            });
        }
        else{
            var promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,null, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(data);
                    }
                });
            });

            return promise;
        }
    }
}

module.exports = HuoBiApi;


