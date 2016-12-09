'use strict';

var app = require('../../../index.js'),
    request = require('supertest'),
    assert = require('assert'),
    co = require('co'),
    Api = require('../../../lib/apiClient/api');


testApi('yunbi');
//testApi('btctrade');

var wait = function (mils) {
    var now = new Date();
    while (new Date() - now <= mils);
};

function testApi(site){
    describe(`api. path: api.js 网站：${site}`, function () {
        let api,
            _symbol,
            sellId,buyId; //卖单ID

        //有比较耗时间的测试，设置每个测试的过期时间为1分钟
        this.timeout(1 * 60 * 1000);

        before(function (done) {
            api = new Api(site);
            _symbol = "eth#cny";
            done();
        });

        it('getRealPrice 获取即时价格 回调函数版', function (done) {
            api.getRealPrice('btc',function(err,res){
                assert.equal(!!res.isSuccess, true);
                assert.equal(res.realPrice.buys[0][0] > 0, true);
                done();
            });
        });

        it('getRealPrice 获取即时价格 generator函数版', function (done) {
            co(function *(){
                let res = yield api.getRealPrice('btc');
                assert.equal(!!res.isSuccess, true);
                assert.equal(res.realPrice.buys[0][0] > 0, true);

                done();
            }).catch(function(e){
                done(e);
            });
            //assert.equal(1,2);
            
        });


        it.only('buy 挂买单', function (done) {
            var options = {symbol: "eth#cny", amount: 0.1, price: 1}
            api.buy(options,function(err,res){
                debugger
                if(!res.isSuccess){
                    console.log('buy 挂买单:' + res.message);
                }

                assert.equal(res.isSuccess,true);
                buyId = res.outerId;
                done();
            });
        });

        
        it('getAccountInfo 获取账户信息', function (done) {
            //wait(1000);
            api.getAccountInfo(function(err,res){
                if(!res.isSuccess){
                    console.log('getAccountInfo 获取账户信息:' + res.message);
                }

                assert.equal(res.isSuccess,true);
                done();
            });
        });

        it('fetchRecentOrders 挂单查询', function (done) {   
            //wait(1000); 
            let since = ((+new Date() - 8 * 60 * 60 * 1000) / 1000) | 0;
            var options = {
                symbol: "eth#cny",  //交易币种（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
                type: 'all',  //  挂单类型[open:正在挂单, all:所有挂单]
                since: since
                //since: yesterday.toLocaleString() //+new Date() - dayMilli //时间戳, 查询某个时间戳之后的挂单
            };

            co(function *(){
                let fetchRes = yield* api.fetchRecentOrders(options,function(err,res){
                    if(!res.isSuccess){
                        console.log('fetchRecentOrders 挂单查询:' + res.message);
                    }
                    assert.equal(res.isSuccess,true);
                });

                assert.equal(fetchRes.isSuccess,true);
                done();
            }).catch(function(e){
                done(e);
            });


        });

        it('sell 挂卖单', function (done) {
            //wait(1000);
            var options = {symbol: _symbol, amount: 0.1, price: 1000}
            api.sell(options,function(err,res){
                if(!res.isSuccess){
                    console.log('sell 挂卖单:' + res.message);
                }
                assert.equal(res.isSuccess,true);
                sellId = res.outerId;
                done();
            });
        });

        it('fetchOrder 获取单', function (done) {
            co(function *(){
                let getTradeRes = yield api.fetchOrder({id: sellId,symbol: _symbol});
                if(!getTradeRes.isSuccess){
                    console.log('fetchOrder 获取单:' + getTradeRes.message);
                }

                assert.equal(getTradeRes.isSuccess,true);

                done();
            }).catch(function(e){
                done(e);
            });
        });

        it('cancelOrder 取消挂单', function (done) {
            //wait(1000);
            var id = sellId || 1;
            api.cancelOrder({id: id, symbol: _symbol},function(err,res){
                 if(!res.isSuccess){
                    console.log('cancelOrder 取消挂单:' + res.message);
                }
                assert.equal( res.isSuccess,true);
                done();
            });
            api.cancelOrder({id: buyId, symbol: _symbol},function(err,res){
                assert.equal( res.isSuccess,true);
                done();
            });
        });
    })
}