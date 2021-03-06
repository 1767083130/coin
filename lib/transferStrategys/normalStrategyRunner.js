'use strict';

const realTimePrice = require('../realTimePrice');
const common = require('../common');
const expression = require('../expression/expression');
const MethodsRunner = require('../expression/methodsRunner');
const BaseStrategyRunner =  require('./BaseStrategyRunner');
const Decimal = require('decimal.js');


/**
 * btctrade交易网站接口实现
 */
class NormalStrategyRunner extends BaseStrategyRunner {
    constructor(){
        super(); 
    }

    /**
     * 获取符合条件表达式的交易数量以及价格等信息
     * 
     * @param {string} condition,条件表达式 
     * @param {Object} env, 如 { userName: "lcm"}
     * @param {Object} realPrices,即时价格，可以为空
     * @returns 返回满足条件的委托信息
     */
    * getConditionResult(condition,env,realPrices) { 
        var stack = expression.getConditionStacks(condition);

        var variableValues = yield* this._getVarRealPrices(stack,realPrices); //表达式的变量
        var indexs = [], //行情价格中的索引
            amounts = [], //能符合条件的委托价格
            len = variableValues.length;

        for(var i = 0; i < len; i++){
            indexs[i] = 0;
            //amounts[i] = variableValues[i].values[0][1]; //[1]
        }

        var isAllEnd = function(){
            for(var i = 0; i < len; i++){
                var isEnd = (indexs[i] == variableValues[i].values.length);
                if(!isEnd){
                    return false;
                }
            }

            return true;
        }
        
        //获取符合条件的委托数量最小的一方
        var getMinAmountItem = function() {
            if(amounts.length == 0){
                return -1;
            }


            var min = Math.max.apply(null,amounts), //amounts[0],
                minIndex = -1;
            for(let i = 0; i < amounts.length; i++){
                if (min >= amounts[i] &&  //取较小者
                    indexs[i] < variableValues[i].values.length - 1) { //数组索引不能超界限
                    min = amounts[i];
                    minIndex = i;
                }
            }

            return minIndex;
        }

        var lastIndex = 0, isFirst = true;
        while (isFirst || !isAllEnd()) {
            var expressNew,
                minItem = 0;

            var stackNew = [],
                conditionRealPrices = []; //

            //获取需要用到的即时价格信息
            for(let i = 0; i < len; i++){
                let index = indexs[i];
                let price = variableValues[i].values[index][0];
                let amount = variableValues[i].values[index][1];

                conditionRealPrices.push({
                    site: variableValues[i].site, 
                    symbol: variableValues[i].symbol,
                    price: price,
                    amount: amount,
                    tradeType: variableValues[i].tradeType
                });
            }
            
            var getVarValueMethod = function* (stackItem){ //todo 待确认
                return this.getStackItemValue(stackItem,conditionRealPrices,env);
                //return yield* super.getStackItemValue(stackItem,conditionRealPrices,env);
            }.bind(this);

            //将表达式的变量用值替换掉,形成一个新的堆栈
            for(let j = 0; j < stack.length; j++){
                let stackItem = stack[j];

                //getStackItemValue 返回的值:
                //{ value: 8, type: 'method' } //value:处理后返回的值 type:表达式类型
                let stackItemValue =  yield* this.getStackItemValue(stackItem,conditionRealPrices,env); // 
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
            expressNew = stackNew.join('');

            //计算表达式的值，只要返回false,则终止运行,否则推进数组indexs
            var res;
            try{
                res = eval(expressNew);
            } catch(e) {
                res = false;
            }

            if (res) {
                if (isFirst) {
                    for (let m = 0; m < len; m++) {
                        amounts[m] = variableValues[m].values[0][1]; //[1]
                    }
                }

                if (indexs[lastIndex] > 0) {
                    var level = indexs[lastIndex];
                    amounts[lastIndex] = new Decimal(amounts[lastIndex]).plus(variableValues[lastIndex].values[level][1]).toNumber();
                    //amounts[lastIndex] += variableValues[lastIndex].values[level][1];
                }

                //推进数组indexs
                minItem = getMinAmountItem();
                lastIndex = minItem;
                
                if (minItem != -1) {
                    indexs[minItem]++;
                } else {
                    //amounts[lastIndex] += variableValues[lastIndex].values[level][1];
                    break;
                }
            } else {
                if (isFirst) {
                    for (let m = 0; m < len; m++) {
                        amounts[m] = 0;
                    }
                } else {
                    indexs[lastIndex]--;
                }

                break;
            }

            isFirst = false;
        }

        var conditionTrades = this._getConditionTrades(variableValues, indexs, amounts);
        return conditionTrades;
    }

    * getStackItemValue(stackItem,conditionRealPrices,env){
        return yield* super.getStackItemValue(stackItem,conditionRealPrices,env);
    }

    /**
     * 获取满足条件的交易
     */
    _getConditionTrades(variableValues, indexs, amounts) {
        var trades = [];
        for (var i = 0; i < variableValues.length; i++) {
            var index = indexs[i];
            var amount = amounts[i];
            if (amount == 0) {
                return [];
            }

            var variableValue = variableValues[i]; //{ stackItem: stackItem, values: res.values }
            var variableObj = this._getVariableObject(variableValue.stackItem);
            var price = variableValue.values[index][0]; //[0]为价格，[1]为数量

            trades.push({
                symbol: variableObj.symbol,
                site: variableObj.site,
                tradeType: variableObj.tradeType,
                amount: amount,
                price: price
            });
        }

        return trades;
    }

   

    /**
     * 获取计算条件表达式需要的即时价格信息
     *
     * @param {Array} stack,条件表达式的堆栈
     * @returns {Array} 即时价格信息 如:
       [{ 
          stackItem: 'huobi.btc.buy', 
          values: [[4012,0.5],[4011,0.6]]
       }]
     */
    * _getVarRealPrices(stack,realPrices){
        let variables = [];

        for (var i = 0; i < stack.length; i++) {
            let stackItem = stack[i];
            let expressionType = expression.getExpressionItemType(stackItem);
            if(expressionType != 'variable'){
                continue;
            }

            let assignPriceInfo = this._getAssignPriceInfo(stackItem);
            if(assignPriceInfo){
                let realPrice;
                if(realPrices){
                    realPrice = realPrices.find(function(value){
                        return value.site == assignPriceInfo.site && value.symbol == assignPriceInfo.symbol;
                    });
                }

                if(!realPrice){
                    realPrice = yield* realTimePrice.getRealPrice(assignPriceInfo.site,assignPriceInfo.symbol);
                }

                if(!realPrice){
                    return;
                }

                let existsVariable = variables.find(function(value){
                    return value.stackItem == stackItem;
                });

                var tradeType = assignPriceInfo.tradeType;
                if(!existsVariable){
                    variables.push({ 
                        stackItem: stackItem, 
                        values: (tradeType == 'buy' ? realPrice.buys : realPrice.sells),
                        site: assignPriceInfo.site,
                        symbol: assignPriceInfo.symbol,
                        tradeType: assignPriceInfo.tradeType
                    });
                }
            }
        }

        return variables;
    }

}

module.exports = NormalStrategyRunner;