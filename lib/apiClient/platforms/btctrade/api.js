'use strict';
const BtctradeClient = require('./btctradeClient').BtctradeClient;
const ApiBase = require('../ApiBase');
const Decimal = require('decimal.js');

const request = require('request');
const configUtil = require('../../../configUtil');
const common = require('../../../common');

const Site_Name = 'btctrade';

/*
API详细文档请见 https://www.btctrade.com/api.help.html#full
*/

/**
 * btctrade交易网站接口实现
 */
class BtcTradeApi extends ApiBase {
    constructor(options){
        super(); 
        
        let app = configUtil.getDefaultIdentifier(Site_Name);
        let defaultOptions = {
            restUrl: configUtil.getRestUrl(Site_Name),
            appKey: app.appKey,
            appSecret: app.appSecret
        };
        let newOptions = Object.assign({},defaultOptions,options);
        this.client = new BtctradeClient(newOptions);
    }

    getSiteName(){
        return Site_Name;
    }

    /**
     * 获取即时价格
     * @Returns {Object}  e.g  { isSuccess: true,message: "",errorCode:
     *            result: { site:"houbi", prices: [5,4,3,2],symbol:"btc" } }
     */ 
    getRealPrice(symbol,callBack){
        if(symbol.indexOf('#')){
            symbol = symbol.split('#')[0];
        }

        var getRes = function(data) {
            var res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            res.realPrice = data;
            return res;
        }.bind(this);

        let detail_url = `http://api.btctrade.com/api/depth?coin=${symbol}`;
        var requestPrices = function(cb){
            request({
                url: detail_url,
                method: "GET"
            }, function (error, response, body) {
                if(error){
                    error.body = body;
                    return cb(error);
                }
                /*
                返回结果示例：
                {"result":true,"asks":[["2350","2.607"]],"bids":[["1850","1.031"]]}
                返回结果说明：
                asks: 卖方深度[价格, 委单量]，价格从高到低排序
                bids: 买方深度[价格, 委单量]，价格从高到低排序 */
                var getItem = function(item){
                    if(this.isNumeric(item[0]) && this.isNumeric(item[1])){
                        return [parseFloat(item[0]), parseFloat(item[1])];
                    }
                }.bind(this);

                try{
                    var data = JSON.parse(body);
                    if(!data.result){
                        return cb(new Error(`从${Site_Name}获取${symbol}价格信息失败`));
                    }

                    let res = getRes(data);
                    if(!res.isSuccess){
                        return cb(null,res);
                    }

                    var buys = [], 
                        sells = [];
                    for(let item of data.bids){
                        let newItem = getItem(item);
                        if(newItem){
                            buys.push(newItem);
                        }
                    }

                    for(let item of data.asks){
                        let newItem = getItem(item);
                        if(newItem){
                            sells.push(newItem);
                        }
                    }

                    var detail = {
                        time: new Date(),
                        site: Site_Name,  
                        buys: buys, //买10 //{ amount: Number,level:Number,price:Number }
                        sells: sells, //卖10 //{ amount: Number,level:Number,price:Number }
                        symbol: symbol //类型;
                    };

                    this.sortRealPrices(detail);
                    res.realPrice = detail;
                    cb(error,res);
                }catch(e){
                    cb(e);
                }
            }.bind(this));
        }.bind(this);

        if(callBack && typeof callBack == 'function'){
            requestPrices(callBack);
        } else {
            var promise = new Promise(function(resolve, reject) {
                requestPrices(function(error,body){
                    if(error){
                        reject(error);
                    } else {
                        resolve(body);
                    }
                });
            }.bind(this));

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
            }.bind(this));
        };

        if(callBack && typeof callBack == 'function'){
            requestPrices(callBack);
        }else{
            var promise = new Promise(function(resolve, reject) {
                requestPrices(function(error,body){
                    if(error){
                        reject(error);
                    }
                    else{
                        resolve(body);
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 挂买单
     * 
     * @param {Object} options  请求参数，如 {symbol: "btc#cny", amount: 0.1, price: 1}
     * @returns {"result":true,"id":123} id: 挂单ID; result: true(成功), false(失败)
     */
    buy(options,callBack){
        let apiname = '/api/buy/';
        
        // 参数说明
        // coin: 交易币种（btc,eth,ltc,doge,ybc）
        // amount: 购买数量
        // price: 购买价格

        // 返回结果示例：
        // {"result":true,"id":123}
        // 返回结果说明：
        // id: 挂单ID
        // result: true(成功), false(失败)

        var body = {
            coin: this._getCoin(options.symbol),
            amount: options.amount,
            price: options.price
        }

        var getRes = function(data) {
            var res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            res.outerId = data.id;
            return res;
        }.bind(this);

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,body, function(error,data){
                let res = getRes(data);
                return callBack(error,res);
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,body, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        let res = getRes(data);
                        resolve(res);
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 挂卖单
     * 
     * @param {Object} options  请求参数，如 {symbol: "btc#cny", amount: 0.1, price: 1}
     * @returns {"result":true,"id":123} id: 挂单ID; result: true(成功), false(失败)
     */
    sell(options,callBack){
        let apiname = '/api/sell/';

        // 参数说明
        // coin: 交易币种（btc,eth,ltc,doge,ybc）
        // amount: 购买数量
        // price: 购买价格

        // 返回结果示例：
        // {"result":true,"id":123}
        // 返回结果说明：
        // id: 挂单ID
        // result: true(成功), false(失败)

        var body = {
            coin: this._getCoin(options.symbol),
            amount: options.amount,
            price: options.price
        }

        var getRes = function(data) {
            var res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            res.outerId = data.id;
            return res;
        }.bind(this);

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,body, function(error,data){
                return callBack(error,getRes(data));
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,body, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 取消挂单
     * 
     * @param {Object} options 挂单ID {id: 3423423,symbol: "btc#cny"}
     * @returns {"isSuccess":true,"message":"eewew"} id: 挂单ID; result: true(成功), false(失败)
     */
    cancelOrder(options,callBack){
        let apiname = '/api/cancel_order/';

        // 返回结果示例：
        // {"result":true,"message":"success"}
        var getRes = function(data) {
            var res = this._getCallRes(data);
            res.body = data;
            return res;
        }.bind(this);
        
        var body = {
            id: options.id
        }

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,body, function(error,data){
                return callBack(error,getRes(data));
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,body, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 获取最近的订单
     * 
     * @param {Object} options 请求参数，如 {
     *     symbol: "btc#cny",  //交易币种（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
     *     since: +new Date() / 1000 | 0, //上次获取到的委托交易时间戳（秒级），lastTime，lastOrderId都必须填写
     *     lastOrderId: "1236549877", //最后一次同步时获取到的委托Id
     * }
     * 
     * @returns { isSuccess: true,message: "", orders: [
        outerId: "423425", //挂单ID
        consignDate: new Date(),  //挂单时间
        site: "huobi",
        tradeType: "buy",  //类型（buy, sell）
        price: 90,  //挂单价格(单位为元)
        consignAmount: 12, //挂单数量
        bargainAmount: 20, //成交数量
        status: 'canceled'  //open(开放), closed(全部成交), canceled(撤消)
       ]}
     */
    * fetchRecentOrders(options,stepCallBack){
        let fetchOptions = {
            symbol: options.symbol,  //交易币种（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
            type: 'all',  //  挂单类型[open:正在挂单, all:所有挂单],默认为all
            since: options.since //秒级时间戳, 查询某个时间戳之后的挂单
        }

        let res = yield this.fetchSinceOrders(fetchOptions);
        stepCallBack && stepCallBack(null,res)
        return res;
    }

    /**
     * 挂单查询
     * 
     * @param {Object} options  请求参数，如 {
     *    symbol: "btc#cny",  //交易币种（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
     *    type: 'all',  //  挂单类型[open:正在挂单, all:所有挂单],默认为all
     *    since: (+new Date() / 1000) | 0 //秒级时间戳, 查询某个时间戳之后的挂单
     * }
     * @returns [{ isSuccess: true,message:'', orders: [] }]
     */
    fetchSinceOrders(options,callBack){
        //api说明
        // 参数
        // coin: 交易币种（btc,eth,ltc,doge,ybc）
        // type: 挂单类型[open:正在挂单, all:所有挂单]
        // since: 时间戳, 查询某个时间戳之后的挂单

        //返回结果示例：
        // [{"id":"123","datetime":"2013-01-02 14:09:01","type":"buy","coin":"1","status":"cancelled","price":543,"amount_original":1.234,"amount_outstanding":1.234}]
        // 返回结果说明：
        // id: 挂单ID
        // datetime: 挂单时间
        // type: 类型（buy, sell）
        // price: 挂单价格
        // status: 状态：open(开放), closed(全部成交), cancelled(撤消)
        // amount_original: 挂单数量
        // amount_outstanding: 剩余数量
        let apiname = '/api/orders/';
        options.type = (options.type || 'all');

        var getRes = function(datas) {
            var res = this._getCallRes(datas);
            res.body = datas;
            if(!res.isSuccess) {
                return res;
            }

            var orders = [];
            for(let data of datas){
                var order = { 
                    outerId: data.id, //挂单ID
                    site: "btctrade",
                    symbol: common.getTradeRegularSymbol(data.coin),
                    consignDate: data.datetime,  //挂单时间
                    tradeType: data.type,  //类型（buy, sell）
                    price: data.price,  //挂单价格(单位为分)
                    consignAmount: data.amount_original, //挂单数量
                    bargainAmount: new Decimal(data.amount_original).minus(data.amount_outstanding).toNumber(), //成交数量
                    status: data.status == 'cancelled' ? 'canceled' : data.status //open(开放), closed(全部成交), canceled(撤消)
                };

                orders.push(order);
            }

            res.orders = orders;
            return res;
        }.bind(this);
        
        var body = {
            coin: this._getCoin(options.symbol),
            type: options.type,
            since: options.since,
            ob: "DESC" //ob: 排序, ASC,DESC
        }

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,body, function(error,data){
                return callBack(error,getRes(data));
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,body, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    getAccountInfo(callBack){
        let apiname = '/api/balance/';

        //{"uid":123,"nameauth":0,"moflag":"0","btc_balance":0,"btc_reserved":0,
        //"ltc_balance":0,"ltc_reserved":0, "doge_balance":0,"doge_reserved":0,"ybc_balance":0,
        //"ybc_reserved":0,"cny_balance":0,"cny_reserved":0}
        var getRes = function(data){
            var res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            //let balances = [], reserveds = [];
            let coinItems = [];
            for(var key in data){
                if(key.indexOf('_') == -1){
                    continue;
                }

                var items = key.split('_');
                var coin = items[0];
                let symbolItem = coinItems.find(function(value){
                    return value.coin == coin;
                });

                if(!symbolItem){
                    symbolItem = {
                        coin: coin,
                        total: 0,
                        frozen: 0,
                        apply: 0
                    };
                    coinItems.push(symbolItem);
                }

                if(items[1] == 'balance') {
                    symbolItem.balance = parseFloat(data[key]) || 0;
                } else if (items[1] == 'reserved'){
                    symbolItem.frozen = parseFloat(data[key]) || 0;
                }
            }

            for(let coinItem of coinItems){
                coinItem.total = new Decimal(coinItem.balance || 0).plus(coinItem.frozen).toNumber();
            }

            var account = { 
                site: Site_Name,
                coins: coinItems
            }
            res.account = account;

            return res;
        }.bind(this);

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,null, function(error,data){
                return callBack(error,getRes(data));
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,null, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 查询订单信息
     * 
     * @param {Object} options 挂单ID {id: 23423443,symbol: "btc#cny"}
     * @returns {Object} e.g. 
     * { id: 1,site: "btctrade",consignDate: '', type: 'buy',price: 12,consignAmount: 120,bargainAmount: 123,status: '状态：open(开放), closed(结束), cancelled(撤消)' }
     */
    fetchOrder(options,callBack){
        let apiname = '/api/fetch_order/';

        // 返回结果示例：
        // {"id":123,"datetime":"2013-01-02 14:09:01","type":"buy","price":543, "consignAmount":1.234,"bargainAmount":1.234,"status":"open"}
        // 返回结果说明：
        // id: 挂单ID
        // datetime: 挂单时间
        // type: 类型（buy, sell）
        // price: 挂单价格
        // amount_original: 挂单数量
        // amount_outstanding: 剩余数量
        // status: 状态：open(开放), closed(结束), cancelled(撤消)
        var getRes = function(data) {
            var res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            var order = { 
                outerId: data.id, //挂单ID
                site: "btctrade",
                consignDate: data.datetime,  //挂单时间
                type: data.type,  //类型（buy, sell）
                price: data.price,  //挂单价格(单位为分)
                consignAmount: data.amount_original, //挂单数量
                bargainAmount: new Decimal(data.amount_original).minus(data.amount_outstanding).toNumber(), //成交数量
                status: data.status == 'cancelled' ? 'canceled' : data.status //open(开放), closed(全部成交), canceled(撤消)
            };

            res.order = order;
            return res;
        }.bind(this);
        
        var body = {
            id: options.id
        }

        if(callBack && typeof callBack == 'function'){
            this.client.execute(apiname,body, function(error,data){
                return callBack(error,getRes(data));
            });
        }
        else{
            let promise = new Promise(function(resolve, reject) {
                this.client.execute(apiname,body, function(error,data){
                    if(error){
                        reject(error);
                    }else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 提币或提现
     * 
     * @param {Object} options  请求参数，如 { coin: "btc", amount: 12,fees： 0.01,safePassword:'1234po4', address: "a213we234234sdfsdwer324"}
     * @returns {isSuccess:true,outerId:123} outerId: 挂单ID; result: true(成功), false(失败)
     */
    withdraw(options,callBack){ 
        throw new Error("没有实现的方法");
    }

    /**
     * 取消提币或提现
     * 
     * @param {Object} options  请求参数，如 { coin: "btc", outerId: "3242334", safePassword:'1234po4'}
     * @returns {isSuccess:true } id: 挂单ID; result: true(成功), false(失败)
     */
    cancelWithdraw(options,callBack){
        throw new Error("没有实现的方法");
    }

    _getCallRes(data){
        if(data.hasOwnProperty('result')){
            return { isSuccess: data.result, message: data.message };
        } 

        return { isSuccess: true };
    }

    _getCoin(symbol){
        if(!symbol){
            return symbol;
        }

        let index = symbol.indexOf('#');
        return index == -1 ? symbol : symbol.substring(0,index);
    }
}

module.exports = BtcTradeApi;


