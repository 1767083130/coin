'use strict';

var query = require('querystring'),
    request = require('supertest'),
    co = require('co');

describe('支付测试. path: strategy.js', function () {


    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        done();
    });
    
    after(function(done){
        done();
    })

    it('runStrategy 运行策略', function (done) {
        co(function *(){
           
            done();
        }).catch(function(e){
            done(e);
        });
    });
})
