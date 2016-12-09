'use strict';
const mongoose = require('mongoose');
const RealTimePrice = mongoose.model('RealTimePrice');
const SystemRunSettings = mongoose.model('SystemRunSettings');
const Api = require('./apiClient/api');
const configUtil = require('./configUtil')

const SITES = configUtil.getSites(); //['huobi','okcoin'];
const Main_Site = configUtil.getDefaultSite();

const Natural_Symbol = configUtil.getBusiness().natural;

const HISTORY_DAYS = 180;
const ONE_Day_Milli = 24 * 60 * 60 * 1000;
const Marketing_Interval = ONE_Day_Milli;

// let _account;
let _naturalPrices;
let _realPrices = []; //缓存一定时间内的市场价格

let realTimePrice = new class{

    getAllRealPrices(stepCallback){
        let sites = configUtil.getPlatforms();
        for(var siteItem of sites){
            for(var symbolItem of siteItem.symbols){
                this.getAsyncRealPrices([siteItem.site],[symbolItem.symbol],stepCallback);
            }
        }
    }

    /**
     * 获取特定交易网站的某个币种的价格信息
     * 
     * @param {String} site,交易网站
     * @param {String} symbol,币种
     * @returns {Object} 价格信息. e.g.
       {
            time: new Date(), //时间
            site: "huobi", //交易网站
            symbol: "btc", //币种
            buys: [[4005,1.3],[4004,1.54],[4003,1.45]], //买入委托，按照价格降序排序
            sells: [[4006,1.3],[4007,1.54],[4007,1.45]], //卖出委托，按照价格升序排序
       }
     *
     */
    * getRealPrice(site,symbol){
        let checkTime = function(time){
            var interal = (+new Date()) - time.getTime();
            return interal < 2000;
        }
        //先从缓存中读取
        for(var i = _realPrices.length - 1; i >= 0; i--){
            let item = _realPrices[i];
            if(item.symbol == symbol && item.site == site){
                if(checkTime(item.time)){
                    return item;
                } else {
                    break;
                }
            }
        }

        ////没有获取到，从数据库中读取 NOTICE:如果需要的话,可以这样做.代码先保留
        //let realTimePrice = yield RealTimePrice.find({ site: site, symbol: symbol }).sort({time: -1}).limit(1);
        //if(realTimePrice && realTimePrice.length > 0  && checkTime(realTimePrice[0].time)){
        //    return realTimePrice[0];
        //}

        //还没有获取到，从交易网站中获取
        let realPrices = yield* this.getSyncRealPrices([site],[symbol]);
        if(realPrices && realPrices.length > 0){
            return realPrices[0];
        }
    }

    getLatestRealPrices(){
        return _realPrices;
    }

    /**
     * 从各个交易网站中异步获取某个币种的实时行情，这里进行了保存
     *
     * @param {Array[String]} sites,交易平台，如['huobi','okcoin']
     * @param {String} symbol, 币种，如'btc'
     * @returns 
     * @private
     */
    getAsyncRealPrices(sites,symbols,stepCallback){
        //从各个交易网站中获取行情
        for(var i = 0; i < sites.length; i++){
            let site = sites[i];
            let api = new Api(site);

            for(var j = 0; j < symbols.length; j++){
                let symbol = symbols[j];
                api.getRealPrice(symbol,function(err,res){
                    if(err || !res.isSuccess){
                        if(!err){
                            err = new Error(`从交易网站(${site})获取行情失败`);
                        }

                        return stepCallback && stepCallback(err);
                    }
                    
                    let realTimePrice = res.realPrice;
                    try{
                        //将行情信息重新组织，放置到一个新的数组中,这样更方便后续操作
                        var detail = {
                            time: realTimePrice.time,
                            site: site, 
                            symbol: symbol,
                            buys: realTimePrice.buys,
                            sells: realTimePrice.sells
                        };

                        var lastRealPriceIndex = _realPrices.findIndex(function(value){
                            return value.site == site && value.symbol == symbol;
                        });
                        if(lastRealPriceIndex >= 0){
                            _realPrices[lastRealPriceIndex] = detail;
                        } else {
                            _realPrices.push(detail);
                        }

                        stepCallback && stepCallback(err,detail);
                    
                        let item = new RealTimePrice(detail);
                        item.save();
                    } catch(e) {
                        //忽略错误
                        stepCallback && stepCallback(e);
                    }
                });

            }
        }
    }

    /**
     * 从各个交易网站中同步获取某个币种的实时行情，只有全部获取成功才返回,这里不进行保存
     *
     * @param {Array[String]} sites,交易平台，如['huobi','okcoin']
     * @param {String} symbols, 币种，如['btc','eth']
     * @returns {Array} 如[{time:"2016/08/09 12:01:23",site:"huobi",symbol:"btc",buys:[5,4,3,2],sells:[12,11,10,9] }]
     * @private
     */
    * getSyncRealPrices(sites,symbols){

        //从各个交易网站中获取行情
        let promises = [];
        for(var i = 0; i < sites.length; i++){
            let site = sites[i];
            let api = new Api(site);

            for(var j = 0; j < symbols.length; j++){
                let promise = api.getRealPrice(symbols[j]);
                promises.push(promise);
            }
        }
        var values = yield Promise.all(promises);
        
        //将行情信息重新组织，放置到一个新的数组中,这样更方便后续操作
        let details = [];
        for(var m = 0; m < sites.length; m++){
            for(var n = 0; n < symbols.length; n++){
                let res = values[ m * n + n];
                if(res && res.isSuccess && res.realPrice){
                    details.push({
                        time: res.realPrice.time,
                        site: sites[m], 
                        symbol: symbols[n],
                        buys: res.realPrice.buys,
                        sells: res.realPrice.sells
                    });
                }
            }
        }

        return details;
    }

    
    /**
     * 获取根据交易策略调整各个币种仓位和整体持仓所要做的交易列表
     *
     * @param {Strategy} strategy, 交易策略
     * @param {Account} accountInfo, 帐户信息 
     * @return {String}
     * @api private
     */
    _getStrategyTrades(strategy,accountInfo){

        //调整整体仓位    
        let sellAmount = 0;  //需要买入或卖出的总额      
        var total = accountInfo.totalStock + accountInfo.availableNaturalCoin;
        var totalPercent = (accountInfo.totalStock / total * 100) | 0;
        if(totalPercent != strategy.totalPercent){ //调整整体
            sellAmount = (total * (strategy.totalPercent - totalPercent) / 100) | 0;
        }

        var trades = [];
        //调整每个币种的情况
        for(var item of accountInfo.symbols){ //每个币种
            if(item.symbol == Natural_Symbol){
                continue;
            }

            let strategyItem = strategy.stocks.find(function(value){
                return value.symbol == item.symbol;
            });
            // if(!strategyItem){ //todo
            //     continue;
            // }

            let itemPercent = item.price / total * 100;
            let amount =  ((strategyItem.amount - itemPercent) * this.getSymbolPrice(item.symbol)) | 0;

            var trade = {        
                site: "", //还需要根据行情来确定 //todo
                userName: strategy.userName,
                total: 0,	//总资产折合
                amount:  Math.abs(amount), //金额
                price: 0,  //价格 
                type: amount > 0 ? "buy" : "sell", //交易类型。buy或sell
                reason: "调仓", //原因
                symbol: item.symbol //cny、btc、ltc、usd
            };
            trades.push(trade);    
        }

        return trades;
    }


    /**
     * 获取某个币种的市场价格。计价方式取一段时间内多个平台的平均价
     *
     * @param {String} symbol, 币种，如"btc"
     * @return {Number} 价格
     * @api public
     */
    * getSymbolPrice(symbol){
        var naturalPrices = yield this.getNaturalPrices();
        for(var item of naturalPrices.symbols){
            if(item.symbol == symbol){
                return item.price;
            }
        }
    }


    /**
     * 获取各个币种的当前行情价格。因为各个平台的价格都不同，采用一定时间段内的平均价格进行计价
     * 
     * @returns {Object},各个币种的行情价格，格式为：
     *   { time: Date, //时间
     *     prices:[{ symbol: String, price: Decimal }] //币种价格
     *   } 
     * 
     * @public
     */
    * getNaturalPrices(){

        let symbolPrices = _naturalPrices;
        if(symbolPrices && (+new Date() - symbolPrices.time < Marketing_Interval)){
            return symbolPrices;
        }

        //币种的当前行情价格已指定的一家网站为准，如果获取失败，尝试执行另外一家网站
        symbolPrices = yield* this._getSitePrices(Main_Site);
        if(!symbolPrices){ //如果获取失败，尝试执行另外一家网站
            let secondSite;
            for(let site in SITES){
                if(site != Main_Site){
                    secondSite = site;
                    break;
                }
            }
            if(secondSite){
                symbolPrices = yield* this._getSitePrices(secondSite);
            }
        }
    
        //还是没有获取到,那么考虑使用5天内获取到的行情信息
        if(!symbolPrices && (  
            _naturalPrices && +new Date() - _naturalPrices.time < Marketing_Interval * 5)){
            symbolPrices = _naturalPrices;
        }

        return symbolPrices;
    }
     

    /** 
     * 获取网站的各个币种价格。
     * 
     * @param {String} site，网站名称
     * @returns {Object},价格信息，如：
     * { time: Date, //时间
     *   prices:[{ symbol: String, price: Decimal }] //币种价格
     * } 
     * 
     * @private
     */
    * _getSitePrices(site){
        let prices = [],
            symbolPrices = {
                time: new Date(),
                symbols: prices
            };

        for(let symbol of SYMBOLS){
            if(symbol == Natural_Symbol){
                prices.push({ symbol: symbol, price: 1 });
            } else {
                
                let avgPrice = yield DayPrice.find({ symbol: symbol, date: date, site: site }); //todo 计算平均值 
                if(avgPrice){
                    //取24小时内的平均价格
                    prices.push({ symbol: symbol, price: avgPrice });
                }else{
                    symbolPrices = null;
                    break;
                }
            }
        }

        return symbolPrices;
    }

    
    /**
     * 导入各个交易平台的日行情
     *
     * @public
     */
    * importDayPrices() {
   
        var oneDayMilli = 24 * 60 * 60 * 1000;
        for(var i = 0; i < SITES.length; i++){
            let site = SITES[i];

            //获取最近导入的日期
            let runLog = yield SystemRunSettings.getRecentDay(site); //这里可以考虑记录最近获取的提高效率

            var today = new Date();
            today.setHours(0, 0, 0, 0);

            /*
            导入日行情。
            （1）如果是第一次导入，则只导入今天的
            （2）如果不是第一次导入，则读取最近一次的日行情。最近一次的日行情不是今天时，需要弥补导入
            */
            let currentDate = today;
            if(runLog){
                var lastDate = runLog.lastTimeImportDayInfo;
                lastDate.setTime(+runLog.lastDay + oneDayMilli);
                currentDate = lastDate;
            } 

            let endDate = new Date();
            endDate.setHours(0, 0, 0, 0);
            yield* this.getPeriodDayPrices(currentDate,endDate);

            runLog.lastTimeImportDayInfo = new Date();
            runLog.save();
        }
    }

    /**
     * Invoke an api by method name.
     *
     * @param {String} method, method name
     * @param {Function(err, response)} callback
    */
    * getHistoryPrices() {
        var oneDayMilli = 24 * 60 * 60 * 1000;
    
        for(var i = 0; i < SITES.length; i++){
            var site = SITES[i];
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            /*
            导入历史的每日行情。
            （1）导入时间段: 半年前的日期~最早导入的日期
            */
            let currentDate = today;
            currentDate.setTime(today - oneDayMilli * HISTORY_DAYS);

            let endDate = new Date();
            endDate.setHours(0, 0, 0, 0);
            let firstDayPrice = yield* DayPrice.getFirstDayPrice(site);
            if(firstDayPrice){
                endDate = firstDayPrice.date;
            }

            yield* this.getPeriodDayPrices(currentDate,endDate);
        }
    }

    /**
     * Invoke an api by method name.
     *
     * @param {String} method, method name
     * @param {Function(err, response)} callback
     */
    * getPeriodDayPrices(startDate,endDate,site){
        let api = new Api(site);
        var currentDate = startDate;

        while(endDate >= currentDate){
        
            var isContinue = true;  //只要一次获取失败,则终止后面的执行

            //获取行情并保存
            var getDayPriceRes = yield api.getDayPrice(currentDate,site);
            if(dayPrice){
                dayPrice = yield DayPrice.create({
                    date: currentDate,
                    site: site, 
                    startPrice: 12, //todo
                    endPrice: { num: 12,price: 12 }, 
                    highPrice: { num: 12,price: 12 },
                    lowPrice: { num: 12,price: 12 },
                    totalNum: 12,
                    totalAmount: 12
                });

                if(dayPrice){ //todo

                } else {
                    isContinue = false;
                }
            }
            else{ //如果获取行情信息失败
                isContinue = false;
            }

            if(!isContinue){ //途中失败,则不往下执行了
                break;
            }

            var nextDayValue = +currentDate + ONE_Day_Milli; //推进到下一天
            currentDate.setTime(nextDayValue);
        }
    }


}();

module.exports = realTimePrice;

