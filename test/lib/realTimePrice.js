'use strict';

var app = require('../../index.js'),
    request = require('supertest'),
    assert = require('assert'),
    co = require('co'),
    realTimePrice = require('../../lib/realTimePrice');

describe('支付测试. path: realTimePrice.js', function () {

    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        done();
    });

    it('getAllRealPrices 获取即时价格', function (done) {
        realTimePrice.getAllRealPrices(function(err,realTimePrice){
            assert.equal(err, null);
        });

        done();
    });

    it('getRealPrice 获取即时价格', function (done) {
        co(function *(){
            let realPrice = yield* realTimePrice.getRealPrice('btctrade','btc');
            assert.equal(!!realPrice, true);
            done();
        }).catch(function(e){
            done(e);
        });
    });

})