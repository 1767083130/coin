'use strict';
const NormalStrategyRunner = require('../../../lib/transferStrategys/normalStrategyRunner');
const co = require('co');
const assert = require('assert');

describe('支付测试. path: strategy.js', function () {


    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        done();
    });
    
    after(function(done){
        done();
    });

    it('getConditionResult 计算条件表达式的结果(不满足条件)', function (done) {
        co(function *(){
            debugger
            let realPrices = [{
                site: "chbtc", //交易网站
                symbol: "eth#cny", //币种
                buys: [[50.2,1.3],[50.09,1.54],[50,1.45],[49.98,2]], //买入委托，按照价格降序排序
                sells: [[50.58,80],[50.6,100.54],[50.89,1.45],[51,200]] //卖出委托，按照价格升序排序
            },{
                site: "btctrade", //交易网站
                symbol: "eth#cny", //币种
                buys: [[50.8,13],[50.71,1.54],[50.6,1.45],[50.4,123],[50.3,43]], //买入委托，按照价格降序排序
                sells: [[50.9,1.3],[51,154],[51.56,145.9]] //卖出委托，按照价格升序排序
            }];    

            let normalStrategyRunner = new NormalStrategyRunner();
            let res = yield* normalStrategyRunner.getConditionResult(
                ' (btctrade.eth.buy - chbtc.eth.sell) /  btctrade.eth.buy * 100 >= 3',
                {userName: "lcm"},realPrices);
            assert.equal(res.length,0);
            
            done();
        }).catch(function(e){
            done(e);
        });
    });


    it('getConditionResult 计算条件表达式的结果(满足条件)', function (done) {
        co(function *(){
            let realPrices = [{
                site: "chbtc", //交易网站
                symbol: "eth#cny", //币种
                buys: [[50.2,1.3],[50.09,1.54],[50,1.45],[49.98,2]], //买入委托，按照价格降序排序
                sells: [[50.58,80],[50.6,100.54],[50.89,1.45],[51,200]] //卖出委托，按照价格升序排序
            },{
                site: "btctrade", //交易网站
                symbol: "eth#cny", //币种
                buys: [[50.8,13],[50.71,1.54],[50.6,1.45],[50.4,123],[50.3,43]], //买入委托，按照价格降序排序
                sells: [[50.9,1.3],[51,154],[51.56,145.9]] //卖出委托，按照价格升序排序
            }];    

            let normalStrategyRunner = new NormalStrategyRunner();
            let res = yield* normalStrategyRunner.getConditionResult(
                ' (btctrade.eth.buy - chbtc.eth.sell) /  btctrade.eth.buy * 100 >= 0.4',
                {userName: "lcm"},realPrices);

            assert.equal(res.length,2);

            let res0 = res.find(function(value){
                return value.site == "btctrade";
            });
            assert.equal(res0.amount, 13);

            let res1 = res.find(function(value){
                return value.site == "chbtc";
            });
            assert.equal(res1.amount, 80);
            
            done();
        }).catch(function(e){
            done(e);
        });
    });
});