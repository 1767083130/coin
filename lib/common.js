'use strict';

const configUtil = require('./configUtil');
const NaturalCoin = configUtil.getNaturalCoin();
const Decimal = require('decimal.js');

let common = new class{

    /**
     * 获取符合统一规则的交易货币符号。规定为"进仓的货币#出仓的货币",比如"btc#cny",表示用人民币买入比特币
     *
     * @param {String} symbol, 有可能不规则的交易货币符号，如"btc"或"btc#cny"
     * @returns {string} 符合统一规则的交易货币符号.如 "btc#cny"
     */
    getTradeRegularSymbol(symbol){
        if(symbol.indexOf('#') == -1){
            return symbol + '#' + NaturalCoin;
        }

        return symbol;
    }

    getRealTradeAmount(tradeAmount,accountAmount){
        if(tradeAmount.indexOf('%') == -1){
            let num = parseFloat(tradeAmount);
            if(!isNaN(num) && isFinite(num)){
                return Math.min(num,accountAmount);
            }
        } else {
            let s = tradeAmount.substring(0,tradeAmount.length - 1);
            let percent = parseFloat(s);
            if(!isNaN(percent) && isFinite(percent)){
                let num = accountAmount * percent / 100;
                return Math.min(num,accountAmount);
            }
        }

        return 0;
    }

    fixCoinAmount(amount){
        let obj;
        if(typeof amount != 'object'){
            obj  = new Decimal(amount);
        } else { //被认为是Decimal对象
            obj = amount;
        }

        return obj.toDP(4, Decimal.ROUND_DOWN).toNumber();
    }

    fixPrice(price){
        let obj;
        if(typeof price != 'object'){
            obj  = new Decimal(price);
        } else { //被认为是Decimal对象
            obj = price;
        }

        return obj.toDP(2, Decimal.ROUND_DOWN).toNumber();
    }
    
    getServiceUrl(apiUrl) {
        return '/DesktopModules/Services/Api' + apiUrl;
    }

    getMainDomain() {
        var isTest = this.isTest();
        if (isTest) {
            return "http://localhost"; //TODO 这里测试先改为www.360yee.com
        }
        else
        {
            return "http://www.tkell.cn";
        }
    }
}();

module.exports = common;