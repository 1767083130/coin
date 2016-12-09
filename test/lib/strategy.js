'use strict';

var query = require('querystring'),
    request = require('supertest'),
    co = require('co'),
    assert = require('assert'),
    strategy = require('../../lib/strategy'),
    testUtil = require('../testUtil');

describe('支付测试. path: strategy.js', function () {

    var _strategy;
    //var _account;


    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        co(function *(){
            _strategy = yield* testUtil.getTestTransferStrategy();
            done();
        }).catch(function(e){
            done(e);
        });
    });
    
    after(function(done){
        done();
    })

    it('runStrategy 运行策略', function (done) {
        co(function *(){
            let res;
            res = yield* strategy.runTransferStrategy(_strategy);
            console.log(res.message)

            assert.equal(res.isSuccess, true);
            done();
        }).catch(function(e){
            done(e);
        });
    });
})

// var testApp = app.kraken.get('test:testApp');
// request(app)
//     .get('/pay/createSession?' + query.stringify({
//         appKey: testApp.appKey,
//         amount: 12,
//         distinctId: "123445",
//         tradeId: "a234dwer4235"
//     }))
//     .expect(200, function (err, res) {
//         if (err) return done(err);
//         assert.equal(res.body.isSuccess, true);
//         done();
//     });