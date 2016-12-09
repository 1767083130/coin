'use strict';
const OkCoinClient = require('./OkCoinClient').OkCoinClient;
const ApiBase = require('../ApiBase');
const customConfig = require('../../../../config/customConfig');
const request = require('request');

const Site_Name = 'okcoin';

class OkCoinApi extends ApiBase {
    constructor(options){
        super(); 

        let app = customConfig.platforms.okcoin;
        let defaultOptions = {
            restUrl: app.restUrl,
            appKey: app.appKey,
            appSecret: app.appSecret
        };
        let newOptions = Object.assign({},defaultOptions,options);
        this.client = new OkCoinClient(newOptions);
    }

    getRealPrice(symbol,callBack){
        //https://www.okcoin.cn/api/v1/depth.do?symbol=btc_cny&merge=1&size=10
        let detail_url = '';
        if(symbol == 'btc'){
            detail_url = 'https://www.okcoin.cn/api/v1/depth.do?symbol=btc_cny';
        }else if(symbol == 'ltc'){
            detail_url = 'https://www.okcoin.cn/api/v1/depth.do?symbol=ltc_cny';
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

                /*
                {	"asks": [ //asks :卖方深度
                        [792, 5],
                        [789.68, 0.018], ...
                    ],
                    "bids": [ //买方深度
                        [787.1, 0.35],
                        [787, 12.071], ...
                    ]
                }
                 */
                let data = JSON.parse(body);
                let sells = [],buys = [];
                let getItems = function(orgItems){
                    let items = [];
                    for(let i = 0; i < orgItems.length; i++){
                        let item = orgItems[i];
                        items.push({
                            amount: item[1],level:0,price:item[0]
                        });
                    }
                }

                sells = getItems(data.asks);
                buys = getItems(data.bids);

                let detail = {
                    time: time,
                    site: Site_Name,  

                    buys: buys, //买10 //{ amount: Number,level:Number,price:Number } //买方深度
                    sells: sells, //卖10 //{ amount: Number,level:Number,price:Number }  //asks :卖方深度
                    symbol: data.symbol //类型;
                    
                    /* 下面这些数据可有可无  */
                    /*
                    level: data.level, //涨幅
                    totalAmount: data.total,  //总量（人民币）
                    totalNum: data.amount, //成交量
                    priceHigh: data.p_high, //最高
                    priceLow: data.p_low, //最低
                    priceLast: data.p_last, //收盘价
                    priceNew: data.p_new, //最新
                    priceOpen: data.p_open //开盘
                    */
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

    getDayPrices (date,symbol,callBack){
        let detail_url = '';
        if(symbol == 'btc'){
            detail_url = 'https://www.okcoin.cn/api/v1/ticker.do?symbol=btc_cny';
        }
        else if(symbol == 'ltc'){
            detail_url = 'https://www.okcoin.cn/api/v1/ticker.do?symbol=ltc_cny';
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

                /*返回的数据格式
                  	"date":"1410431279", //返回数据时服务器时间
                    "ticker":{ 
                        "buy":"33.15", //买一价
                        "high":"34.15", //最高价
                        "last":"33.15", //最新成交价
                        "low":"32.05", //最低价
                        "sell":"33.16", // 卖一价
                        "vol":"10532696.39199642" //成交量(最近的24小时)
                    }
                */

                var data = JSON.parse(body);
                var detail = {
                    time: time,
                    site: Site_Name,  

                    totalNum: data.vol, //成交量
                    //level: data.level, //涨幅
                    highPrice: data.ticker.high, //最高
                    lowPrice: data.ticker.low, //最低
                    //endPrice: data.p_last, //收盘价
                    newPrice: data.ticker.last, //最新
                    //startPrice: data.p_open, //开盘
                    totalAmount: data.vol,  //总量（人民币） 
                    symbol: data.symbol //类型;
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

    buy(day,site,callBack){
        let apiname = 'get_account_info';

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,data);
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
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

    sell(day,site,callBack){
        let apiname = 'get_account_info';

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,data);
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
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

    getAccountInfo(callBack){
        let apiname = '/api/v1/userinfo';

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,data);
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
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

module.exports = OkCoinApi;


