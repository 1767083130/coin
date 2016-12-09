'use strict';

const configUtil = require('../configUtil');
const trade = require('../trade');
const transfer = require('../transfer');
const common = require('../common');
const expression = require('../expression/expression');
const account = require('../account');
const MethodsRunner = require('../expression/methodsRunner');
const clientIdentifier = require('../clientIdentifier');
//const Api = require('./apiClient/api');

const mongoose = require('mongoose');
const TransferStrategyLog = mongoose.model('TransferStrategyLog');
const Decimal = require('decimal.js');
const NaturalCoin = configUtil.getNaturalCoin();

/**
 * btctrade交易网站接口实现
 */
class BaseStrategyRunner {
    constructor(){
    }

    static getInstance(type){
        let Strategy;

        switch(type.toLowerCase()){
        case 'between':
            Strategy = require('./betweenStrategyRunner');
            break;
        case 'normal':
            Strategy = require('./normalStrategyRunner');
            break;
        default:
            throw new Error(`类型为${type}的策略没有实现`);
        }

        return new Strategy();
    }


    /**
     * 执行操作策略
     * 
     * @param {TransferStrategy} strategy，交易策略
     * @param {Array} realPrices,即时价格，可以为空
     * @returns { isSuccess: false, message:""}
     * @public
     */
    * runStrategy(strategy,realPrices){
        let res = { isSuccess: true };
        //let transferStrategyLog = yield* this.getStrategyTrades(strategy);
        let env = { userName: strategy.userName };
        let condition = strategy.conditions.join(' & ');

        let conditionTrades = yield* this.getConditionResult(condition,env,realPrices);
        if(conditionTrades.length == 0){
            return { isSuccess: true,message: "成功运行，策略没有满足交易条件"}
        }

        let getLogRes = yield* this.getTransferStrategyLog(conditionTrades,strategy);
        if(!getLogRes.isSuccess){
            return { isSuccess: false,message: getLogRes.message, errorCode: getLogRes.errorCode };
        }

        let transferStrategyLog = getLogRes.log;
        transferStrategyLog.transferStrategy = strategy;

        for(let operateLog of transferStrategyLog.operates){
            if(!operateLog.orgOperate.previousOperate || (operateLog.orgOperate.previousOperate <= 0)) {
                if(operateLog.totalAmount <= 0){
                    continue;
                }

                let identifier = yield clientIdentifier.getUserClient(strategy.userName,operateLog.orgOperate.site);
                if(!identifier){
                    return { 
                        isSuccess: false, 
                        message: `找不到ClientIdentifier。userName:${strategy.userName},site:${operateLog.orgOperate.site}`,
                        errorCode: "100003"
                    };
                } 

                operateLog.transferStrategyLog = transferStrategyLog;
                res = yield* this.runOperate(operateLog,identifier,operateLog.totalAmount);
                if(!res.isSuccess){
                    //这里应当进行失败时弥补 //todo 很重要
                    transferStrategyLog.status = 'failed';
                    transferStrategyLog.modified = new Date();
                    transferStrategyLog.errorMessage = res.message;

                    operateLog.status = 'failed';
                    operateLog.errorMessage = res.message;
                    break;
                } else {
                    operateLog.consignAmount = operateLog.totalAmount;
                    operateLog.status = 'assign';
                    operateLog.actionIds.push(res.actionId);
                }
            }
        }
        
        transferStrategyLog.save(function(err){
            if(err){
                //todo 应当记录
                console.log(err);
            }
        });
        return res;
    }

    /**
     * 获取符合条件表达式的交易数量以及价格等信息
     *
     * @Returns 返回。 .e.g.
     *{
            symbol: variableObj.symbol,
            site: variableObj.site,
            tradeType: variableObj.tradeType,
            amount: amount,
            price: price
        }
     *
     * @public
     */
    * getConditionResult(condition,env,realPrices) {
        throw new Error('调用了没有实现的方法');
    }


        
    /**
     * 执行操作
     * 
     * @param {operate} operate
     * @param {identifier} ClientIdentifier
     * @returns {[Trade]} 
     * @public
     */
    * runOperate(operateLog,identifier,stepAmount){
        let res;
        let operate = operateLog.orgOperate;

        if(operate.action == "trade"){
            res = yield* trade.runTradeOperate(operateLog,identifier,stepAmount)
        } else if(operate.action == "transfer"){
            res = yield* transfer.runTransferOperate(operateLog,identifier,stepAmount);
        } else {
            res = { isSuccess:false, message: `不能识别的操作:${operate.action}`,errorCode: '200000' }
        }
  
        return res;
    }


    /**
     * 获取条件表达式中的变量的详情
     * @param {String} variable, 条件表达式中的变量 如 huobi.btc#cny.buy
     * 
     * @returns 变量的详情，如 { site: "huobi",symbol: "btc#cny", variable: "buy",tradeType:"buy" },表示huobi网站中btc#cny的价格,
     *    variable暂时支持 buy（买入价）、sell（卖出价）
     */
    _getVariableObject(variableItem){
        var items = variableItem.split('.');
        if(items.length != 2 && items.length != 3){
            return;
        }

        let variableName = items.length == 2 ? 'buy' : items[2];
        if(variableName){
            return {
                site: items[0],
                symbol: common.getTradeRegularSymbol(items[1]),
                variable: variableName.toLowerCase(),
                tradeType: variableName
            };
        }
    }

    * getTransferStrategyLog(conditionTrades,strategy) { 
        var accounts = yield account.getUserAccounts(strategy.userName);


        let transferStrategyLog = new TransferStrategyLog({
            strategyId: strategy._id,
            userName: strategy.userName,
            status: 'wait', //wait,sucess,failed
            reason: '', //failed reason
            currentStep: 1,
            operates: [],
            //errorMessage: '',
            startTime: Date.now(),
            //endTime: Date,
            modified: Date.now()
        });

        //let isContinue = true;
        let res = { isSuccess: true };
        for(var i = 0; i < strategy.operates.length; i++){
            let operate = strategy.operates[i];
            let accountItem = accounts.find(function(item){
                return item.site == operate.site && item.userName == strategy.userName;
            });
            if(!accountItem){
                return { isSuccess: false, message: "找不到账户，有可能还没同步",errorCode: "100002" };
            }

            var conditionTrade =  conditionTrades.find(function(item){
                let tradeType = (operate.tradeType == 'buy' ? 'sell' : 'buy'); 
                return item.site == operate.site && item.symbol == operate.symbol && item.tradeType == tradeType;
            }) 
            if(!conditionTrade){
                return { isSuccess: false, message: "运行错误，策略中的需要委托交易或转币的币种只能为条件表达式出现的币种",errorCode: "200000" };
            }
            
            let env = { userName: strategy.userName };
            let amount = yield* this.getOperateAmount(operate.tradeAmount,conditionTrades,env);
            //let amount0 =   conditionTrade.amount * (operate.tradeAmount || 100) / 100;

            if(operate.action == 'transfer'){ //操作类型。分为 trade(成交)、transfer（转币）两种
                //成交金额
                amount = TransferStrategyLog.generateCoinDibsAmount(amount,operate.symbol);
                if(amount <= 0 || amount < operate.minTradeAmount) {
                    //isContinue = false;
                    res.message = `账户余额不足`;
                    res.isSuccess = false;
                }
                amount = common.fixCoinAmount(amount,operate.symbol);

                //是否自动执行
                var sysAuto = operate.auto && configUtil.isAutoTransfer(operate.symbol);

                let totalAmount = (operate.id == 1 ? totalAmount : 0);
                totalAmount = common.fixCoinAmount(totalAmount); 

                let logTransferOperate = {
                    orgOperate: operate,
                    actionIds: [],
                    //委托 -> 等待 -> 成交 -> 分批或不分批执行下一步
                    //几种金额的关系 totalAmount >= consignAmount >= actualAmount >= undeal
                    totalAmount: totalAmount, //需要执行的总金额 
                    undeal: 0, //这一步已经执行完成,但是下一步未处理的金额 
                    consignAmount: 0, //委托金额
                    actualAmount: 0, //实际转币或成交金额
                    //price: Number, //委托价格。当action=trade时有效
                    status: 'wait', //wait,success,failed,hand(等待人工处理),assign(已委托)
                    auto: sysAuto

                };
                transferStrategyLog.operates.push(logTransferOperate);

            } else if(operate.action == 'trade') {
                let arr = operate.symbol.split('#');
                
                let sellCoinLeft,buyCoinLeft,
                    coin = arr[0];
                if(operate.tradeType == "sell"){ //卖出时不需要考虑资金是否充足,但不能超账户剩余数量
                    sellCoinLeft = accountItem.getAvailable(arr[0]);
                    amount = Math.min(sellCoinLeft,amount);
                } else { //buy
                    buyCoinLeft = accountItem.getAvailable(arr[1]);
                    let canBuyAmount = new Decimal(buyCoinLeft).div(conditionTrade.price).toNumber();
                    amount = Math.min(canBuyAmount,amount);
                }

                if(operate.id == 1 || operate.validAccount){
                    if(amount <= 0 || amount < operate.minTradeAmount) {
                        res.isSuccess = false;
                        res.message = `网站${operate.site}账户余额不足。sellCoinLeft:${sellCoinLeft},可买数量为${amount},但每单的最小量为${operate.minTradeAmount}`;
                        //isContinue = false;
                    }
                }

                let isFirstOperate = !operate.previousOperate || operate.previousOperate <= 0;
                let totalAmount = (isFirstOperate ? amount : 0);
                totalAmount = common.fixCoinAmount(totalAmount);  //保留4位小数

                if( (isFirstOperate && (operate.minTradeAmount <= totalAmount))
                   || !isFirstOperate){
                //if(!isFirstOperate || operate.minTradeAmount <= totalAmount){
                    //成交金额
                    let consignPrice = common.fixPrice(conditionTrade.price); //保留2位小数 
                    let logTransferOperate = {
                        orgOperate: operate,
                        actionIds: [],
                        totalAmount: totalAmount, //需要执行的总金额 
                        undeal: 0, //这一步已经执行完成,但是下一步未处理的金额 
                        consignAmount: 0, //委托金额
                        actualAmount: 0, //实际转币或成交金额
                        price: consignPrice, //委托价格。当action=trade时有效
                        status: 'wait', //wait,success,failed,hand(等待人工处理),assign(已委托)
                        auto: operate.auto
                    };
                    transferStrategyLog.operates.push(logTransferOperate);
                }
            }
        }

      
        if(res.isSuccess){
            transferStrategyLog = yield transferStrategyLog.save();
            res = { isSuccess: true, log: transferStrategyLog };
        } 

        return res;
    }

    * getOperateAmount(amountExpression,conditionTrades,env){
        let stack = expression.getConditionStacks(amountExpression);
        let stackNew = [];

        let getVarValueMethod = function* (stackItem){
            return yield* this.getStackItemValue(stackItem,conditionTrades,env);
        }

        //将表达式的变量用值替换掉,形成一个新的堆栈
        for(let j = 0; j < stack.length; j++){
            let stackItem = stack[j];

            //getStackItemValue 返回的值:
            //{ value: 8, type: 'method' } //value:处理后返回的值 type:表达式类型
            let stackItemValue =  yield* this.getStackItemValue(stackItem,conditionTrades,env); // 
            if(stackItemValue.type == 'method'){
                let options = {
                    getVarValueMethod: getVarValueMethod,
                    env: {
                        userName: env.userName
                    }
                };

                let methodsRunner = new MethodsRunner(options);
                let val = yield* methodsRunner.calculate(stackItem);
                stackNew.push(val);
            } else {
                stackNew.push(stackItemValue.value);
            }
        }

        //新的可以执行的表达式
        let expressNew = stackNew.join('');

        //计算表达式的值，只要返回false,则终止运行,否则推进数组indexs
        let res,amount;
        try{
            res = eval(expressNew);
            amount = parseFloat(res);
            if(isNaN(amount) || !isFinite(amount)){
                amount = 0;
            }
        } catch(e) {
            amount = 0;
        }

        return amount;
    }

    /**
     * 获取堆栈项的值
     * 
     * @param {String} stackItem,堆栈项
     * @param {Array} conditionRealPrices,各个网站某档的即时价格. 如:
     *   [{ site: "huobi", symbol: 34,price: 324,amount: 34 },{ site: "btctrade", symbol: 34,price: 324,amount: 34 }]
     * @returns {Obejct} 处理后的值. 如: { value: 8, type: 'method' } //value:处理后返回的值 type:表达式类型
     *     
     */
    * getStackItemValue(stackItem,conditionRealPrices,env){ // [{ site: "huobi", symbol: 34,price: 324,amount: 34 }]
        var item = {}, //处理后的值
            itemValue,
            expressionType;
            
        expressionType = expression.getExpressionItemType(stackItem);
        itemValue = stackItem;
        item.type = expressionType;

        if(expressionType == 'variable'){
            //如果是牵涉到委托价格的(如huobi.btc.buy),获取表达式的含义,返回数据如下:
            //如:{ site: "huobi",symbol: "btc#cny", variable: "buy",tradeType:"buy" }
            let assignPriceInfo = this._getAssignPriceInfo(stackItem);

            if(assignPriceInfo){  //如果表达式表示的是符合条件的委托价格 如 huobi.btc.buy或huobi.btc.sell
                let realPrice = conditionRealPrices.find(function(value){
                    return value.symbol == assignPriceInfo.symbol 
                            && value.site == assignPriceInfo.site
                            && value.tradeType == assignPriceInfo.tradeType;
                });

                if(realPrice){
                    if(assignPriceInfo.fieldName == 'price'){
                        itemValue = realPrice.price;
                    } else if(assignPriceInfo.fieldName == 'amount'){
                        itemValue = realPrice.amount;
                    }
                }
            } else { //不是则通过这里获取值
                let variableValue = yield* expression.getVariableValue(stackItem,env);
                itemValue = variableValue;
            }

        } else if(expressionType == 'value'){
            itemValue = stackItem;
            if(stackItem.indexOf('%') != -1){
                itemValue = stackItem.replace('%','');
                itemValue = parseFloat(itemValue) / 100;
            } else {
                itemValue = parseFloat(itemValue);
            }
            
        } else if( expressionType == 'method'){
            itemValue = stackItem;
        } else { //operator 
            itemValue = stackItem;
        }

        item.value = itemValue;
        return item;
    } 
   
    /**
     * 获取[buy/sell]条件表达式中的变量的详情
     * @param {String} variable, 条件表达式中的变量 如 huobi.btc#cny.buy
     * 
     * @returns 变量的详情，如 
         { site: "huobi",symbol: "btc#cny", variable: "buy",tradeType:"buy" },表示huobi网站中btc#cny的价格,
     *    variable暂时支持 buy（买入价）、sell（卖出价）
     */
    _getAssignPriceInfo(variableItem){
        var items = variableItem.split('.');
        if(items.length < 2){
            return;
        }
        
        let variableName = items[2].toString().toLowerCase();
        if(variableName != 'buy' && variableName != 'sell'){ //只能为buy或sell
            return;
        }

        var fieldName = 'price';
        if(items.length >= 4){
            fieldName = items[3].toString().toLowerCase();
        }

        if(!variableName || 
           (fieldName != 'price' && fieldName != 'amount')){ //只能为price或amount
            return;
        }

        return {
            site: items[0],
            symbol: common.getTradeRegularSymbol(items[1]),
            variable: variableName.toLowerCase(),
            tradeType: variableName,
            fieldName: fieldName
        };
    }


    getPercentAmount(amount){
        if(!amount){
            return 0;
        }

        var isPercent = (amount.indexOf('%') != -1);
        if(isPercent){
            amount = amount.replace('%','');
        }

        var float = parseFloat(amount);
        if(isNaN(float) || !isFinite(float)){
            float = 0;
        }

        return {
            isPercent: isPercent,
            amount: float
        }
    }

}

module.exports = BaseStrategyRunner;