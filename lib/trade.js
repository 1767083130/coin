'use strict';
const mongoose = require('mongoose');
const Trade  = mongoose.model('Trade');
const Strategy = mongoose.model('Strategy');
const EventManager = require('./eventManager');
const Decimal = require('decimal.js');

const Api = require('./apiClient/api');
const realTimePrice = require('./realTimePrice');
const account = require('./account');
const common = require('./common');
const clientIdentifier = require('./clientIdentifier');

let trade = new class{
    constructor(){
        this.tradeStatusChangedEvent = new EventManager('tradeStatusChangedEvent');
        this.tradeDelayedEvent = new EventManager('tradeDelayedEvent');
    }

    * runTradeOperate(operateLog,identifier,stepAmount){
        let res = { isSuccess: false };
        let operate = operateLog.orgOperate;
        let transferStrategyLog = operateLog.transferStrategyLog;

        if(stepAmount <= 0){
            return { isSuccess: false, errorCode: "100006", message: "参数stepAmount不能<=0" };
        }
        
        if(!transferStrategyLog){
            return  { isSuccess: false, errorCode: "100006", message: "参数operate.trategyLog不能为空" };
        }

        if(operate.action != "trade"){
            return  { isSuccess: false, errorCode: "100006", message: "operate.action不为trade时，不能执行此方法" };
        }

        if(!identifier){
            identifier = yield clientIdentifier.getUserClient(transferStrategyLog.userName,operate.site);  
            if(!identifier){
                return  { isSuccess: false, errorCode: "100003", message: "client为空" };              
            }
        }

        let trade = {
            site: operate.site, //平台名称
            userName: transferStrategyLog.userName, 
            isTest: transferStrategyLog.isTest,
            tradeType: operate.tradeType, //buy或sell
            reason: "transfer", //原因
            symbol: operate.symbol, //cny、btc、ltc、usd
            consignDate: new Date(), //委托时间

            price: operateLog.price, //委托价格
            amount: stepAmount, //总数量

            consignAmount: stepAmount, //已委托数量
            //bargainAmount:  { type: Number, "default": 0 }, //已成交数量
            //prarentTrade: { type: Schema.ObjectId },
            //childTrade: { type: Schema.ObjectId }, 
            actionId: transferStrategyLog._id,
            operateId: operateLog._id, //操作Id
            isSysAuto: true,
            //outerId: String,  //外部交易网站的Id
            status: "wait", 

            created: new Date(), //创建时间
            modified: new Date() //最近修改时间
        };

        res = yield* this.createTrade(trade,identifier);
        if(res.isSuccess){
            //operateLog.undeal -= stepAmount;
            operateLog.consignAmount = new Decimal(operateLog.consignAmount).plus(stepAmount).toNumber();
            yield transferStrategyLog.save();
        }

        return res;
    }

    /**
     * 提交一个交易委托，并保存记录。 
     *
     * @param {Trade} trade, 交易委托 如{ site: "huobi", userName: "lcm", autoRetry: false,
     *          consignAmount: 12,price: 12, tradeType: "buy" || "sell",reason: "调仓", symbol: 'btc' }
     * @param {ClientIdentifier} identifier
     * @returns {Object}  是否成功。如{ isSuccess: false, message: "交易平台返回错误信息：余额不足" }
     * @public
     */
    * createTrade(trade,identifier){
        if(!identifier){
            identifier = yield clientIdentifier.getUserClient(trade.userName,trade.site); 
            if(!identifier){
                //todo 最好记录
                return { isSuccess: false, errorCode: "100003", message: `找不到授权信息.userName:${trade.userName},site:${trade.site} ` };
            }
        }

        let api = new Api(identifier);
        let newTrade = new Trade(trade);

        newTrade.modified = new Date();
        newTrade.status = 'consign';

        if(trade.isTest){
            newTrade = yield newTrade.save(newTrade); 
        } else {
            //todo 这里要考虑系统的鲁棒性
            let tradeRes;
            let apiOptions = { symbol: newTrade.symbol, amount: trade.consignAmount, price: newTrade.price };

            if(trade.tradeType == "buy"){
                tradeRes = yield api.buy(apiOptions);
            } else  if(trade.tradeType == "sell"){
                tradeRes = yield api.sell(apiOptions);
            }

            if(!tradeRes.isSuccess){
                return { isSuccess: false, errorCode: "100005", message: `交易平台返回错误信息：${tradeRes.message}` };
            } else {
                newTrade.status = 'consign';
                newTrade.outerId = tradeRes.outerId;
                newTrade = yield newTrade.save(newTrade);  
            }
        }

        let refreshAccountOptions = {
            userName: newTrade.userName, 
            symbol: newTrade.symbol,
            site: newTrade.site, 
            price: newTrade.price, 

            amount: newTrade.amount,
            consignAmount: newTrade.consignAmount,  //委托数量
            bargainAmount: 0, //已成交数量
            bargainChangeAmount: 0, //已成交数量的变更数

            tradeType: newTrade.tradeType
        };

        let newAccount = yield* account.refreshAccountTrading(refreshAccountOptions,'create');
        if(!newAccount){
            //todo 应当能弥补
            return { isSuccess: false, errorCode: "100002", message: `找不到账户信息,账户信息同步失败，但是有可能进行交易。userName：${newTrade.userName}，site: ${newTrade.site}` };
        }

        return { isSuccess: true, actionId: newTrade._id };
    }

    /**
     * 取消订单
     * 
     * @param {Trade} trade
     * @identifier {ClientIdentifier} identifier
     */
    * cancelTrade(trade,identifier){
        let api = new Api(identifier);

        if(!trade){    
            return { isSuccess: false, errorCode: "100006",message: "参数错误。trade不能为空" };
        } 

        if(["buy","sell"].indexOf(trade.tradeType) == -1){
            return { isSuccess: false, errorCode: "100006",message: "参数错误。trade.tradeType必须为buy或sell" };    
        }

        //先撤消原有委托
        let cancelTradeRes = yield api.cancelTrade(trade.site,trade.outerId);
        if(!cancelTradeRes.isSuccess){
            return { isSuccess: false, errorCode: "100005", message: `调用api撤消委托失败。${cancelTradeRes.message}` };
        }

        if(cancelTradeRes.isSuccess){
            //这里有可能产生脏数据，应重新获取订单详情
            let fetchOrderRes = yield api.fetchOrder({id: trade.outerId,symbol: trade.symbol});
            if(fetchOrderRes.isSuccess){
                trade.consignAmount = fetchOrderRes.order.consignAmount;
                trade.bargainAmount = fetchOrderRes.order.bargainAmount;
            } 

            //更改本地的委托
            trade.status = "auto_canceled";
            trade.modified = Date.now();
            trade = yield trade.save();

            let changeType = 'cancel';
            let changeAmount = new Decimal(trade.consignAmount).minus(trade.bargainAmount).toNumber(); 
                              // trade.consignAmount - trade.bargainAmount;
            //更新账户信息
            let options = {
                userName: trade.userName, 
                symbol: trade.symbol,
                site: trade.site, 
                price: trade.price, 

                consignAmount: 0,
                bargainAmount: 0,
                bargainChangeAmount: changeAmount,

                tradeType: trade.tradeType
            };
            yield* account.refreshAccountTrading(options, changeType);
        } 

        return true;
    }

    
    
    /**
     * 尝试废掉未成功交易的委托，并提交新的委托
     *
     * @param {Trade} trade
     * @param {ClientIdentifier} identifier,可以为空
     * @param {Function(err, response)} callback
     * @private
     * 
     */
    * retryTrade(trade,identifier,options) {
        //当等待一定时间段后(这里设置为5分钟)，如果交易委托没有被执行，
        //（1）当前价格导致交易成本增加幅度超过1%，继续等待,直到人工处理或者行情变动后价格合适操作
        //（2）当前价格导致交易成本没有增加或者增加幅度不超过1%（应当可以设置幅度），撤消交易委托，并且以当前价格申请新的交易委托。
        //（3）买入委托和卖出委托都应进行处理
        //todo 这里设置为5分钟,应当可以传入
        if(trade.isTest){
            return { isSuccess: true };
        }

        let priceRange = options.priceRange || 0.2;

        if(!identifier){
            identifier = yield clientIdentifier.getUserClient(trade.userName,trade.site);
        }

        /*
         realPrices 实时行情.如
         { site: "A", symbol: "btc",
             details: [{ amount: 122, level: 1, price: 13 }, { amount: 122, level: 1, price: 12 }, { amount: 100, level: 1, price: 10 }, { amount: 100, level: 1, price: 9}]
         }; */
        let realPrice = yield* realTimePrice.getRealPrice(trade.site,trade.symbol);

        let res = { isSuccess: false };
        if(!identifier || !realPrice){
            res.message = '系统错误';
            return res;
        }

        if(!priceRange){
            let strategy = yield Strategy.getUserStrategy(trade.userName);
            if(strategy){
                priceRange = strategy.trade.priceRange;
            }
        }
        priceRange = priceRange || 0.2;

        var getConsignPrice = function (trade) {
            let item = { price: 0, amount: 0 };
            let prices;
            if(trade.tradeType == "buy"){ //买入
                prices = realPrice.buys;
            } else if(trade.tradeType == "sell"){ //卖出 
                prices = realPrice.sells;
            }

            for(let price of prices){
                if(price.length < 2){
                    continue;
                }
                
                let itemPriceRange = new Decimal(price[0]).minus(trade.price).abs().div(trade.price).toNumber();
                              //Math.abs((price[0] - trade.price) / trade.price)
                if(itemPriceRange < priceRange){
                    item.price = price[0];
                    item.amount += price[1];
                }
            }

            return item;
        }

        var consignPrice = getConsignPrice();
        if (consignPrice && consignPrice > 0) {
            yield* this._refreshConsignTrade(trade,identifier,consignPrice);
        }

        res.isSuccess = true;
        return res;
    }

    /**
     * 同步第三方交易平台和本系统间的订单状态,如果在一定时间内没有成交成功的委托，尝试重新提交新的委托
     *
     * @param {Function(err, response)} stepCallBack
     * @public
     */
    * syncRecentTrades(stepCallBack) {
        let createdStart = new Date(),
            createdEnd = new Date();
        let since = ((+new Date() - 8 * 60 * 60 * 1000) / 1000) | 0;
        createdStart.setTime(since); //8小时前

        //todo 这里要注意系统的健壮性
        //获取未成功并且未取消的委托
        let userTrades = { userName: "", trades: [] };          
        let trades = yield Trade.find({ 
            status:{ $in:['consign','part_success'] },
            consignDate: { $lt:createdEnd, $gt:createdStart }
        }).sort({ userName: -1}); //如果用户量大或者多服务器时，可以考虑改善这里的做法

        if(trades.length == 0){
            let stepRes = { 
                userTrades: userTrades,
                isSuccess: true, 
                message: "没有需要同步的订单",
                stepCount: 0
            };
            stepCallBack && stepCallBack(stepRes);
        }

        yield* this._syncRecentTrades(since,trades,stepCallBack);
    }

     /**
      * 处理一个用户的所有委托.如果在一定时间内没有成交成功的委托，尝试重新提交新的委托
      *
      * @param {Array(Trade)} userTrades
      * @param {Object} identifier 
      * @param {Function(err, response)} stepCallBack，单个委托处理后的回调函数
      * @private
      */
    * syncUserRecentTrades(userName,sites,stepCallBack){
        let createdStart = new Date(),
            createdEnd = new Date();
        let since = ((+new Date() - 8 * 60 * 60 * 1000) / 1000) | 0; //8小时前
        createdStart.setTime(since) 
        //createdEnd.setTime( +new Date() - 0. * 1000 ) //0.1秒前
       
        //获取未成功并且未取消的委托
        let userTrades = { userName: "", trades: [] };          
        let trades = yield Trade.find({ 
            userName: userName,
            site: { $in: sites },
            status:{ $nin:['success','auto_canceled','canceled','auto_retry'] },
            created: { $lt:createdEnd, $gt:createdStart }
        }); 

        if(trades.length > 0){
            yield* this._syncRecentTrades(since,trades,stepCallBack);
        } else {
            let stepRes = { 
                userTrades: userTrades,
                isSuccess: true, 
                message: "没有需要同步的订单",
                stepCount: 0
            };
            stepCallBack && stepCallBack(stepRes);
        }
    }


    /**
     * 同步第三方交易平台和本系统间的订单状态,如果在一定时间内没有成交成功的委托，尝试重新提交新的委托
     *
     * @param {Function(err, response)} stepCallBack
     * @public
     */
    * _syncRecentTrades(since,trades,stepCallBack) {
        let userTrades = { userName: "", trades: [] };   

        //处理委托。如果在一定时间内没有成交成功的委托，尝试重新提交新的委托；如果在第三方交易平台交易成功，则应同步状态
        let isNextUser = false; //是否又切换到另外一个用户的委托
        for(let i = 0; i < trades.length; i++){
            
            //这里注意，先针对每个用户筛选出委托，然后对一个用户的所有委托，集中进行处理
            let trade = trades[i];
            if(!userTrades.userName || trade.userName == userTrades.userName){
                isNextUser = false;
            }else{
                userTrades.trades = [];
                isNextUser = true;
            }

            userTrades.userName = trade.userName;
            userTrades.trades.push(trade);
        
            if(isNextUser || i == trades.length - 1){ //已收集完一个用户的需要处理的委托
                try{
                    let identifiers = yield clientIdentifier.getUserClients(userTrades.userName); 
                    if(!identifiers){
                        continue;
                    }

                    let allSiteTrades = []; //数组项为用户某个网站的全部委托，如{ site: "huobi",trades:[]}
                    for(let userTrade of userTrades.trades){
                        let site = userTrade.site, item;
                        item = allSiteTrades.find(function(value){
                            return value.site == site;
                        });

                        if(!item){
                            item = { site: site, trades: [] };
                            allSiteTrades.push(item);
                        }
                        item.trades.push(userTrade); 
                    }

                    for(let siteTrades of allSiteTrades){
                        let identifier = identifiers.find(function(item){
                            return item.site == siteTrades.site;
                        });
                        if(identifier){
                            //处理一个用户某个网站的所有委托
                            yield* this._syncUserRecentTrades(since,siteTrades.trades,identifier);
                            stepCallBack && stepCallBack({ userTrades: userTrades, isSuccess: true, message: `同步用户[${userTrades.userName}]的委托成功`});
                        } else {
                            let stepRes = { 
                                userTrades: userTrades,
                                isSuccess: false, 
                                message: `同步用户[${userTrades.userName}]的委托失败,找不到授权信息`,
                                stepIndex: i, 
                                stepCount: trades.length 
                            };
                            stepCallBack && stepCallBack(stepRes);
                        }
                    }
                } catch(e) {
                    let stepRes = { 
                        userTrades: userTrades,
                        isSuccess: false, 
                        message: `同步用户[${userTrades.userName}]的委托失败`,
                        stepIndex: i, 
                        stepCount: trades.length 
                    };
                    stepCallBack && stepCallBack(stepRes);
                }
            }
        }//for
    }

     /**
      * 处理一个用户的所有委托.如果在一定时间内没有成交成功的委托，尝试重新提交新的委托
      *
      * @param {Number}  since,秒级时间戳
      * @param {Array(Trade)} userTrades
      * @param {Object} identifier 
      * @param {Function(err, response)} stepCallBack，单个委托处理后的回调函数
      * @private
      */
    * _syncUserRecentTrades(since,trades,identifier){
        let api = new Api(identifier);
        let outerTrades = [];
        
        //将委托按照币种分类
        let symbolsTrades = [];
        for(let trade of trades){
            let item = symbolsTrades.find(function(value){
                return value.symbol == trade.symbol;
            });
            if(item){
                item.trades.push(trade);
            } else {
                symbolsTrades.push({
                    symbol: trade.symbol,
                    trades: [trade]
                });
            }
        }
        
        //获取委托的最新状态
        for(let symbolTrades of symbolsTrades){
            var options = {
                since: since, //8小时前
                symbol: symbolTrades.symbol,  //交易币种（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
                type: 'all'  //  挂单类型[open:正在挂单, all:所有挂单]
            };
            let getTradesRes = yield* api.fetchRecentOrders(options);
            if(!getTradesRes.isSuccess || !getTradesRes.orders){
                throw new Error(`获取第三方交易平台委托失败。${getTradesRes.message}`); //todo待确认
            }
            outerTrades = [].concat(outerTrades,getTradesRes.orders);
        }

        for(let trade of trades){
            if(trade.status == 'wait'){
                continue;
            }

            let outerTrade = outerTrades.find(function(value){
                return value.outerId == trade.outerId;
            });

            if(!outerTrade){
                let getTradeRes = yield api.fetchOrder({id: trade.outerId,symbol: trade.symbol });
                if(getTradeRes.isSuccess){
                    outerTrade = getTradeRes.order;
                }
            }

            if(outerTrade){
                let changeAmount = new Decimal(outerTrade.bargainAmount).minus(trade.bargainAmount).toNumber(); //更改帐户的金额
                if(changeAmount > 0){
                    yield* this.refreshTrade(trade,outerTrade,identifier);

                    let e = { trade: trade,  changeAmount: changeAmount };
                    this.tradeStatusChangedEvent.trigger(e);
                } else {
                    if(['wait','consign','part_success'].indexOf(trade.status) != -1){
                        let e = { trade: trade,  timeDelayed: +new Date() - (+trade.consignDate)  };
                        this.tradeDelayedEvent.trigger(e);
                    }
                }
            }
        }

        //todo 待确认
        // for(let outerTrade of outerTrades){
        //     let trade = trades.find(function(value){
        //         return value.outerId == outerTrade.outerId;
        //     });

        //     outerTrade.userName = identifier.userName;
        //     if(!trade){
        //         let trade = this.getTrade(outerTrade);
        //         trade = new Trade(trade);
        //         yield trade.save();  
        //     } 
        // }
    }

    getTrade(outerTrade){
        let status = "consign";
        if(status == 'open'){ //open(开放)
            status = "consign";
        } else if(status == 'closed'){ //closed(全部成交)
            status = "success";
        } else if(status == 'canceled'){ //canceled(撤消)
            status = "canceled";
        }

        return {
            site: outerTrade.site, //平台名称
            userName: outerTrade.userName, 
            isTest: false,
            tradeType: trade.type, //buy或sell
            reason: "outer", //原因
            symbol: common.getTradeRegularSymbol(outerTrade.symbol), //cny、btc、ltc、usd

            consignDate: outerTrade.consignDate, //委托时间
            price: outerTrade.price, //委托价格
            amount: outerTrade.consignAmount, //总数量
            consignAmount: outerTrade.consignAmount, //已委托数量
            bargainAmount: outerTrade.bargainAmount, //已成交数量
            status: status,
            isSysAuto: false,
            created: Date.now(), //创建时间
            modified: Date.now() //最近修改时间
        };
    }

    /**
     * 订单完成或完成部分后，对operateLog、account等进行相应处理
     * 
     * @private
     */
    * refreshTrade(trade,outerTrade,identifier){
        //{outerId: "423425", //挂单ID
        //datetime: new Date(),  //挂单时间
        //type: "buy",  //类型（buy, sell）
        //price: 100,  //挂单价格(单位为分)
        //consignAmount: 12, //挂单数量
        //bargainAmount: 20, //成交数量
        //status: 'canceled'}  //open(开放), closed(全部成交), canceled(撤消)

         //同步委托状态，碰到失败的或者是委托在一定时间(10分钟)后未交易的，根据市场价格重新提交一个委托

        try{  
            //if(['success','canceled','auto_canceled','auto_retry','failed'].indexOf(trade.status) != -1){
            //    //todo 因为获取的是外部网站的status为open的委托，
            //    //此时，应该是系统出问题了，最好记录下以便排查
            //    continue; 
            //}

            let tradeStatus = trade.status;
            if(outerTrade.status == 'canceled'){
                tradeStatus = 'canceled';
            } else if(outerTrade.status == 'open'){
                tradeStatus = (outerTrade.bargainAmount > 0 ? 'part_success' : 'consign');
            } else if(outerTrade.status == 'closed'){
                let leftAmt = new Decimal(outerTrade.consignAmount).minus(outerTrade.bargainAmount).toNumber();
                tradeStatus = leftAmt > 0 ? 'canceled' : 'success'; //如果有未成交的部分，则为'canceled',否则为success
            }  


            //更新账户信息
            let changeType, //需要更改帐户的原因类型。为空时表示没有更改
                changeAmount = new Decimal(outerTrade.bargainAmount).minus(trade.bargainAmount).toNumber(); //更改帐户的金额
            if(changeAmount > 0){ //委托被交易
                changeType = 'bargain';
            }

            if(tradeStatus == 'canceled' || tradeStatus == 'auto_canceled'){ //委托被取消
                changeType = 'cancel';
            } 

            if(changeType){
                let options = {
                    userName: trade.userName, 
                    symbol: trade.symbol,
                    site: trade.site, 
                    price: trade.price, 

                    amount: trade.amount,
                    consignAmount: outerTrade.consignAmount,
                    bargainAmount: outerTrade.bargainAmount,
                    bargainChangeAmount: changeAmount,

                    tradeType: trade.tradeType
                };
                yield* account.refreshAccountTrading(options, changeType);
            }
                
            trade.consignAmount = outerTrade.consignAmount;
            trade.bargainAmount = outerTrade.bargainAmount;
            trade.status = tradeStatus;
            trade.modified = new Date();
            yield trade.save();
            
            return true;

        }catch(e){
            console.log(e);
            //todo 记录异常
            return false;
        }
    }

    /**
     * 撤销未成交的委托，重新提交新的委托
     *
     * @param {Trade} trade
     * @param {ClientIdentifier} identifier
     * @private
     */
    * _refreshConsignTrade(trade,identifier,consignPrice){
        let api = new Api(identifier);

        let res = { isSuccess: false };
        if(!trade){
            res.errorCode = '100006';
            res.message = "trade不能为空"
            return res;
        } 

        if(["buy","sell"].indexOf(trade.tradeType) == -1){
            res.errorCode = '100006';
            res.message = "trade.tradeType必须为buy或sell"
            return res;
        }

        //先撤消原有委托
        let cancelRes = yield* this.cancelTrade(trade,identifier);
        if(!cancelRes.isSuccess){
            return cancelRes;
        }
      
        //todo 应注意系统的健壮性
        //生成一个新的委托 
        let leftAmount = new Decimal(trade.consignAmount).minus(trade.bargainAmount);
        let consignAmount = Math.min(consignPrice.amount,leftAmount);
        var newTrade = new Trade({
            site: trade.site, //平台名称
            userName: trade.userName, 
            isTest: trade.isTest,
            tradeType: trade.tradeType, //buy或sell
            reason: trade.reason, //原因
            symbol: trade.symbol, //cny、btc、ltc、usd
            consignDate: Date.now(), //委托时间
            price: consignPrice.price, //委托价格
            amount:  trade.amount - trade.bargainAmount, //总数量
            consignAmount: consignAmount, //已委托数量
            bargainAmount: 0, //已成交数量
            prarentTrade: trade._id, //如果一定时间未成交成功，可能会针对这个委托以不同的价格重新发起一个新的委托，
                                                     //那末，新的委托的prarentTrade就为此委托.一个委托至多只会发起一个新的委托
            childTrade: null,   //如果一定时间未成交成功，可能会针对这个委托以不同的价格重新发起一个新的委托，
                                                     //那末，此委托的childTrade就为新委托

            bargains: [], //已成交列表
            actionId: trade.actionId,
            //outerId: String,  //外部交易网站的Id
            queues:[], 
            status: "wait",
            isSysAuto: true,
            previousTrade: trade.previousTrade,//前置交易
            nextTrade: trade.nextTrade, //后置交易
            created: Date.now(), //创建时间
            modified: Date.now() //最近修改时间
        });

        newTrade = yield Trade.create(newTrade);
        if(!newTrade){
            res.errorCode = '200000';
            res.message = "添加trade失败"
            return res;
        }

        //更改本地的委托
        trade.status = "auto_retry";
        trade.modified = Date.now();
        trade.childTrade = newTrade._id; 
        trade = yield trade.save();

        //向交易网站提交委托
        let apiRes;
        let apiTrade = {
            site: newTrade.site,
            symbol: newTrade.symbol,
            tradeType: newTrade.tradeType,
            amount: consignAmount,
            price: newTrade.price
        };

        if(trade.tradeType == "buy"){
            apiRes = yield api.buy(apiTrade);
        }
        else if(trade.tradeType == "sell"){
            apiRes = yield api.sell(apiTrade);
        }

        if(apiRes.isSuccess){
            newTrade.outerId = apiRes.outerId;
            newTrade.consignAmount = apiTrade.amount;
            newTrade.consign = "consign";
            newTrade.modified = Date.now();
            newTrade = yield Trade.save(newTrade);

            //更新账户信息
            let changeType = 'create';
            let options = {
                userName: newTrade.userName, 
                symbol: newTrade.symbol,
                site: newTrade.site, 
                price: newTrade.price, 

                amount: newTrade.amount,
                consignAmount: newTrade.consignAmount,
                bargainAmount: 0,
                bargainChangeAmount: 0,

                tradeType: newTrade.tradeType
            };
            yield* account.refreshAccountTrading(options, changeType);

        } else {
            res.errorCode = '100005';
            res.message = `调用api撤消委托失败。${apiRes.message}`;
            return res;
        }

        res.isSuccess = true;
        res.trade = newTrade;
        return res;
    }

}();

module.exports = trade;