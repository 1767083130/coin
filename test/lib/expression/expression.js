'use strict';

const app = require('../../../index.js');
const query = require('querystring');
const request = require('supertest');
const co = require('co');
const assert = require('assert');
const expression = require('../../../lib/expression/expression');
const mongoose = require('mongoose');

describe('支付测试. path: strategy.js', function () {

    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        done();
    });
    
    after(function(done){
        done();
    })

    it('getVariableValue 计算表达式的值', function (done) {
        co(function *(){
            let env = { userName: "lcm" };
            let stackItem = 'btctrade.btc.account';
            let res = yield* expression.getVariableValue(stackItem,env);

            stackItem = 'btctrade.btc.account.total';
            res = yield* expression.getVariableValue(stackItem,env);

            stackItem = 'btctrade.btc.account.total0';
            res = yield* expression.getVariableValue(stackItem,env);
            assert.equal(res == stackItem,true);
    
            stackItem = 'btctrade.btc.buys[0].amount';
            res = yield* expression.getVariableValue(stackItem,env);
            assert.equal(res > 0,true);

            stackItem = 'btctrade.btc.buys[0].price';
            res = yield* expression.getVariableValue(stackItem,env);
            assert.equal(res > 0,true);

            stackItem = 'btctrade.btc.sells[0].price';
            res = yield* expression.getVariableValue(stackItem,env);
            assert.equal(res > 0,true);

            stackItem = 'btctrade.btc.sells[0].amount';
            res = yield* expression.getVariableValue(stackItem,env);
            assert.equal(res > 0,true);

            stackItem = 'aaabbb';
            res = yield* expression.getVariableValue(stackItem,env);
            assert.equal(res == stackItem,true);

            done();
        }).catch(function(e){
            done(e);
        });
    });

})