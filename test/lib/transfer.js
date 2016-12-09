'use strict';

var query = require('querystring'),
    request = require('supertest'),
    co = require('co'),
    assert = require('assert'),
    strategy = require('../../lib/trade'),

    mongoose = require('mongoose'),
    Account = mongoose.model('Account');

describe('支付测试. path: strategy.js', function () {
    before(function (done) {

    });
    
    after(function(done){
        done();
    })

    it('runTradeOperate 运行策略的操作步', function (done) {
        co(function *(){
            yield* runTradeOperate(operate, identifier);

            assert.equal(!!trades, true);
            done();
        }).catch(function(e){
            done(e);
        });
    });

})