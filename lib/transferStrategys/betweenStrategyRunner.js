'use strict';
const BaseStrategyRunner =  require('./BaseStrategyRunner');

/**
 * btctrade交易网站接口实现
 */
class BetweenStrategyRunner extends BaseStrategyRunner {
    constructor(){
        super(); 
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
     * @protected
     */
    * getConditionResult(condition,env) {
        throw new Error('调用了没有实现的方法');
    }
    
}

module.exports = BetweenStrategyRunner;