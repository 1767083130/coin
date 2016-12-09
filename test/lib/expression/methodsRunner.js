'use strict';

const app = require('../../../index.js');
const co = require('co');
const assert = require('assert');
const MethodsRunner = require('../../../lib/expression/methodsRunner');
const expression = require('../../../lib/expression/expression');

describe('支付测试. path: expression/methodsRunner.js ', function () {

    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        done();
    });
    
    after(function(done){
        done();
    })

    it('calculate 计算函数的值', function (done) {
        co(function *(){
            let getVarValueMethod = function* (stackItem,env){
                return yield* expression.getVariableValue(stackItem,env);
            };
            let options = {
                getVarValueMethod: getVarValueMethod,
                env: {
                    userName: 'lcm'
                }
            };

            let methodsRunner = new MethodsRunner(options);
            
            let express = 'btctrade.btc.buys[0].price';
            let buyPrice = yield* expression.getVariableValue(express,options.env);

            express = 'min(btctrade.btc.buys[0].price,btctrade.btc.sells[0].price,btctrade.btc.sells[1].price)'.toLowerCase(); 
            let res = yield* methodsRunner.calculate(express);
            assert.equal(buyPrice,res);

            // express = 'Min(Btctrade.btc.buys[0].price, btctrade.btc.sells[0].price,btctrade.btc.sells[1].price)'.toLowerCase(); 
            // res = yield* methodsRunner.calculate(express);
            // assert.equal(buyPrice,res);

            res =  eval('methodsRunner.min(3,8)');
            res = yield* eval('methodsRunner.min(3,8)');
            assert.equal(res,3);

            express = 'min(max(5,6,4),min(8,9,3,12)) > 0'.toLowerCase();
            res = yield* methodsRunner.calculate(express);
            assert.equal(res,3);

            done();
        }).catch(function(e){
            done(e);
        });
    });

})