'use strict';
const OkCoinClient = require('./chbtcClient').ChbtcClient;
const ApiBase = require('../ApiBase');
const request = require('request');
const configUtil = require('../../../configUtil');
const Decimal = require('decimal.js');

const Site_Name = 'chbtc';

class ChbtcApi extends ApiBase {
    constructor(options){
        super(); 
        
        let app = configUtil.getDefaultIdentifier(Site_Name);
        let defaultOptions = {
            restUrl: configUtil.getRestUrl(Site_Name),
            appKey: app.appKey,
            appSecret: app.appSecret
        };
        let newOptions = Object.assign({},defaultOptions,options);
        this.client = new OkCoinClient(newOptions);
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
            symbol = symbol.replace('#','_')
        } else {
            symbol = symbol + '_' + 'cny';
        }

        var getRes = function(data) {
            let res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            res.realPrice = data;
            return res;
        }.bind(this);
        
        let detail_url = `http://api.chbtc.com/data/v1/depth?currency=${symbol}`; //e.g. eth_btc
        var requestPrices = function(cb){
            request({
                url: detail_url,
                method: "GET"
            }, function (error, response, body) {
                if(error){
                    return cb(error);
                }
                /*
                返回结果示例：
                {"asks":[["2350","2.607"]],"bids":[["1850","1.031"]]}
                返回结果说明：
                asks: 卖方深度[价格, 委单量]，价格从高到低排序
                bids: 买方深度[价格, 委单量]，价格从高到低排序 */
                var getItem = function(item){
                    if(this.isNumeric(item[0]) && this.isNumeric(item[1])){
                        return [parseFloat(item[0]), parseFloat(item[1])];
                    }
                }.bind(this)

                try{
                    var data = JSON.parse(body);
                    // if(!data.result){
                    //     return cb(new Error(`从${Site_Name}获取${symbol}价格信息失败`));
                    // }
                    
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
                } catch(e){
                    cb(error);
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
                    }
                    else{
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
                    time: new Date(),
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
        options.tradeType = 'buy';
        return this.buyOrSell(options,callBack);
    }

    /**
     * 挂卖单
     * 
     * @param {Object} options  请求参数，如 {symbol: "btc#cny", amount: 0.1, price: 1}
     * @returns {"result":true,"id":123} id: 挂单ID; result: true(成功), false(失败)
     */
    sell(options,callBack){
        options.tradeType = 'sell';
        return this.buyOrSell(options,callBack);
    }

    /**
     * @param {Object} options  请求参数，如 {symbol: "btc#cny", amount: 0.1, price: 1}
     * @private
     */
    buyOrSell(options,callBack){
        // 请求参数
        // price 单价(cny保留小数后2位，btc保留小数后6位)
        // amount 交易数量(btc、ltc、eth、etc保留小数后3位)
        // tradeType 交易类型1/0[buy/sell]
        // currency btc_cny:比特币/人民币 ltc_cny :莱特币/人民币 eth_cny :以太币/人民币 eth_btc :以太币/比特币 etc_cny :ETC币/人民币
        
        //返回值
        //id : 委托挂单号 
        let apiname = 'order';
        
        var body = {
            price: options.price,
            amount: options.amount,
            tradeType: options.tradeType == 'buy' ? 1 : 0,
            currency: this._getCoin(options.symbol)
        };

        var getRes = function(data){
            let res = this._getCallRes(data);
            res.body = body;
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
        let apiname = 'cancelOrder';

        // 返回结果示例：
        // {"result":true,"message":"success"}
        var getRes = function(data) {
            var res = this._getCallRes(data);
            res.body = body;
            return res;
        }.bind(this);
        

        // id 委托的挂单号
        // currency 
        // btc_cny:比特币/人民币
        // ltc_cny :莱特币/人民币
        // eth_cny :以太币/人民币
        // eth_btc :以太币/比特币
        // etc_cny :ETC币/人民币
        var body = {
            id: options.id,
            currency: this._getCoin(options.symbol)
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
     * 挂单查询
     * 
     * @param {Object} options  请求参数，如 {
     *    symbol: "btc#cny",  //交易币种,可为空（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
     *    type: 'open',  //  挂单类型[open:正在挂单,可为空 all:所有挂单,默认为open]
     *    pageIndex: 0,  //页数。从0开始计数
     *    pageSize: 10   //每页大小。最大数为20
     * }
     * @returns [{ isSuccess: true,message:'', orders: [] }]
     */
    fetchOrders(options,callBack){
        let apiname,body;
        if(options.type == 'all'){
            apiname = 'getOrdersIgnoreTradeType';
            body = {
                //tradeType: tradeType,
                currency: this._getCoin(options.symbol),
                pageIndex: options.pageIndex + 1, //todo 待确认
                pageSize: options.pageSize
            };
        } else { //open
            apiname = 'getUnfinishedOrdersIgnoreTradeType';
            body = {
                //tradeType: tradeType,
                currency: this._getCoin(options.symbol),
                pageIndex: options.pageIndex + 1, //todo 待确认
                pageSize: options.pageSize
            };
        }

        var getRes = function(datas) {
            let res = this._getCallRes(datas);
            res.body = body;
            if(!res.isSuccess) {
                return res;
            }

            var orders = [];
            for(let data of datas){
                //status : 挂单状态（0、待成交 1、取消 2、交易完成 3、待成交未交易部份）
                let status = data.status == 1 ? "canceled" : 
                            ((data.status == 2) ? "closed" : "open");
                var order = { 
                    outerId: data.id, //挂单ID
                    site: "chbtc",
                    consignDate: data.trade_date,  //挂单时间
                    tradeType:  data.type == 1 ? 'buy' : 'sell',  //类型（buy, sell）
                    price: data.price,  //挂单价格(单位为元)
                    consignAmount: data.total_amount, //挂单数量
                    bargainAmount: data.trade_amount, //成交数量
                    status: status //open(开放), closed(全部成交), canceled(撤消)
                };

                orders.push(order);
            }

            res.orders = orders;
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

    getAccountInfo(callBack){
        let apiname = 'getAccountInfo';
        var getRes = function(data){
            let res = this._getCallRes(data);
            res.body = data;
            if(!res.isSuccess) {
                return res;
            }

            let coinItems = [];
            let addCoin = function(key,amount,type){
                let coin = key.toLowerCase();
                var symbolItem = coinItems.find(function(value){
                    return value.coin == coin;
                });

                if(!symbolItem){
                    symbolItem = {
                        coin: coin,
                        total: 0,
                        frozen: 0,
                        loan: 0
                    };
                    coinItems.push(symbolItem);
                }

                if(type == 'balance') {
                    symbolItem.balance = parseFloat(amount) || 0;
                } else if (type == 'frozen'){
                    symbolItem.frozen = parseFloat(amount) || 0;
                }
            }

            for(let key in data.result.balance){
                addCoin(key,data.result.balance[key].amount,'balance');
            }

            for(let key in data.result.frozen){
                addCoin(key,data.result.frozen[key].amount,'frozen');
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
     * @param {Object} options 挂单ID { id: 43234235,symbol:'btc#cny'}
     * @returns {Object} e.g. 
     * { id: 1,datetime: '', type: 'buy',price: 12,amountOriginal: 120,amountOutstanding: 123,status: '状态：open(开放), closed(结束), cancelled(撤消)' }
     */
    fetchOrder(options,callBack){
        let apiname = 'getOrder';

        // 返回结果示例：
        // {"id":123,"datetime":"2013-01-02 14:09:01","type":"buy","price":543, "amount_original":1.234,"amount_outstanding":1.234,"status":"open"}
        // 返回结果说明：
        // id: 挂单ID
        // datetime: 挂单时间
        // type: 类型（buy, sell）
        // price: 挂单价格
        // amount_original: 挂单数量
        // amount_outstanding: 剩余数量
        // status: 状态：open(开放), closed(结束), cancelled(撤消)

        //# Response
        // {
        //     "currency": "btc", 交易类型（目前仅支持btc_cny/ltc_cny/eth_cny/eth_btc/etc_cny）
        //     "fees": 0,
        //     "id": "20150928158614292",
        //     "price": 1560,
        //     "status": 3, （0、待成交 1、取消 2、交易完成 3、待成交未交易部份）
        //     "total_amount": 0.1,
        //     "trade_amount": 0,
        //     "trade_date": 1443410396717,
        //     "trade_money": 0,
        //     "type": 0,  挂单类型 1/0[buy/sell]
        //     "fees": 0
        // }
        var getRes = function(data) {
            let res = this._getCallRes(data);
            res.body = body;
            if(!res.isSuccess) {
                return res;
            }

            var status = 'open';
            if(data.status == 1){
                status = 'canceled';
            } else if(data.status == 2){
                status = 'closed';
            }
            //交易类型1/0[buy/sell]
            var order = { 
                outerId: data.id, //挂单ID
                consignDate: data.trade_date,  //挂单时间
                tradeType:  data.type == 1 ? 'buy' : 'sell',  //类型（buy, sell）
                site: "chbtc",
                price: data.price,  //挂单价格(单位为元)
                consignAmount: data.total_amount, //挂单数量
                bargainAmount: data.trade_amount, //成交数量
                status: status //open(开放), closed(全部成交), canceled(撤消)
            };

            res.order = order;
            return res;
        }.bind(this);
        
        var body = {
            id: options.id,
            currency: this._getCoin(options.symbol) //btc_cny:比特币/人民币
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
                    }
                    else{
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
     * @param {Object} options  请求参数，如 { symbol: "btc#cny", amount: 12,fees: 0.01,safePassword:'1234po4', address: "a213we234234sdfsdwer324"}
     * @returns {isSuccess:true,outerId:123} outerId: 挂单ID; result: true(成功), false(失败)
     */
    withdraw(options,callBack){ 
        if(!options.address){
            throw new Error("参数address不能为空");
        }

        let apiname = 'withdraw'; 

        // //# Request
        // GET https://trade.chbtc.com/api/withdraw?method=withdraw
        // 	&accesskey=your_access_key&amount=0.01&currency=btc_cny&fees=0.001
        // 	&receiveAddr=14fxEPirL9fyfw1i9EF439Pq6gQ5xijUmp&safePwd=资金安全密码
        // 	&sign=请求加密签名串&reqTime=当前时间毫秒数
        // //# Response
        // {
        //     "code": 1000,
        //     "message": "success",
        //     "id": "提现记录的id"
        // }

        var getRes = function(data) {
            let res = this._getCallRes(data);
            res.body = body;
            if(!res.isSuccess) {
                return res;
            }

            res.outerId = data.id;
            return res;
        }.bind(this);
        
        var body = {
            amount: options.amount, //提现金额
            currency: options.symbol, //btc:比特币 ltc :莱特币 eth :以太币 etc :ETC币 
            fees: options.fees, //提现矿工费
            receiveAddr: options.address, //接收地址（必须是认证了的地址）
            safePwd: options.safePwd //资金密码
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
                    }
                    else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }

    /**
     * 取消提币或提现
     * 
     * @param {Object} options  请求参数，如 { symbol: "btc#cny", outerId: "3242334", safePassword:'1234po4'}
     * @returns {"result":true,"id":123} id: 挂单ID; result: true(成功), false(失败)
     */
    cancelWithdraw(options,callBack){

        let apiname = 'cancelWithdraw'; 

        // //# Request
        // GET https://trade.chbtc.com/api/cancelWithdraw?method=cancelWithdraw
        // 	&accesskey=your_access_key&currency=btc&downloadId=提现记录的id&safePwd=资金安全密码
        // 	&sign=请求加密签名串&reqTime=当前时间毫秒数
        // //# Response
        // {
        //     "code": 1000,
        //     "message": {
        //         "des": "success",
        //         "isSuc": true,
        //         "datas": {}
        //     }
        // }

        var getRes = function(data) {
            let res = this._getCallRes(data);
            res.body = body;
            if(!res.isSuccess) {
                return res;
            }

            return res;
        }.bind(this);
        
        var body = {
            currency: options.symbol, //btc:比特币 ltc :莱特币 eth :以太币 etc :ETC币 
            downloadId: options.outerId, //提现记录的id
            safePwd: options.safePwd //资金密码
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
                    }
                    else{
                        resolve(getRes(data));
                    }
                });
            }.bind(this));

            return promise;
        }
    }


    _getCallRes(data){
        if(data.hasOwnProperty('code') && data.code != 1000){
            return { isSuccess: false, message: data.message,code: data.code  };
        } 

        return { isSuccess: true, message: data.message,code: data.code  };
    }

    _getCoin(symbol){
        if(!symbol){
            return symbol;
        }

        let index = symbol.indexOf('#');
        return index == -1 ? symbol : symbol.replace('#','_');
    }

}


module.exports = ChbtcApi;


