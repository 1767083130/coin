'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Account  = mongoose.model('Account');
const ClientIdentifier  = mongoose.model('ClientIdentifier');
const Strategy = mongoose.model('Strategy');
const Trade = mongoose.model('Trade');

const async = require('co').wrap;
const only = require('only');
const accountLib = require('../lib/account');
const trade = require('../lib/trade');
const configUtil = require('../lib/configUtil');
const paginate = require('../lib/utils/paginate');
const transferController = require('../lib/transferStrategys/transferController');

module.exports = function (router) {
    //router.get('/', account.index_api);

    router.post('/tradesList', async(function* (req, res) {
        let sPageIndex = req.param('pageIndex');
        let sPageSize = req.param('pageSize');
        let pageIndex = Number(sPageIndex) || 0;
        let pageSize = Number(sPageSize) || 10;
    
        let userName = req.user.userName;
        paginate(Trade,{
            filters : { userName : userName},
            page:  pageIndex + 1,
            sort : { modified : -1 },
            perPage: pageSize
        }).exec(function (err,result) {
            let t;
            if(err){
                t = {
                    total :0,
                    isSuccess : false
                }; 
                res.json(t);
            }
            else{
                t = {
                    total :result.total,
                    results : result.results,
                    isSuccess : true
                };    

                res.json(t);     
            }
            //var total = results.total;
        });

    }));

    
    router.post('/syncRecentTrades', async(function* (req, res) {
        
        let userName = req.user.userName;
        let site = req.body.site;

        let sites = [];
        if(site == -1){
            sites = configUtil.getSites();
        } else {
            sites.push(site);
        }

        trade.tradeStatusChangedEvent.unregister(transferController,transferController.onTradeStatusChanged);
        trade.tradeDelayedEvent.unregister(transferController,transferController.onTradeDelayed);
       
        trade.tradeStatusChangedEvent.register(transferController,transferController.onTradeStatusChanged);
        trade.tradeDelayedEvent.register(transferController,transferController.onTradeDelayed);

        let stepCallBack;
        yield* trade.syncUserRecentTrades(userName,sites,stepCallBack);
        res.json({ isSuccess: true });
    }));


}