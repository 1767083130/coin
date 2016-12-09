'use strict';

var query = require('querystring'),
    request = require('supertest'),
    co = require('co'),
    assert = require('assert'),
    expression = require('../../lib/expression/expression'),
    mongoose = require('mongoose');

describe('支付测试. path: strategy.js', function () {

    //有比较耗时间的测试，设置每个测试的过期时间为1分钟
    this.timeout(1 * 60 * 1000);

    before(function (done) {
        done();
    });
    
    after(function(done){
        done();
    })

    it('calculate 计算函数的值', function (done) {
        var express = 'min(max(5,6,4),min(8,9,3,12))'.toLowerCase();
        var res = expression.calculate(express);
        assert.equal(res,3);

        done();
    });

})