'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Account  = mongoose.model('Account');
const ClientIdentifier  = mongoose.model('ClientIdentifier');
const Strategy = mongoose.model('Strategy');
const Transfer = mongoose.model('Transfer');

const async = require('co').wrap;
const only = require('only');
const accountLib = require('../lib/account');
const transfer = require('../lib/transfer');
const configUtil = require('../lib/configUtil');
const paginate = require('../lib/utils/paginate');
const transferController = require('../lib/transferStrategys/transferController');

module.exports = function (router) {
    //router.get('/', account.index_api);

    router.get('/', async(function* (req, res) {
        let pageIndex = 0;
        let pageSize = 20;
    
        let userName = req.user.userName;
        let getRes = yield paginate(Transfer,{
            filters : { userName : userName},
            page:  pageIndex + 1,
            sort : { modified : -1 },
            perPage: pageSize
        });

        let model = {
            pageSize: pageSize,
            total: getRes.total,
            transfers: getRes.results,
            isSuccess: true
        };

        res.render('transfer', model);
    }));

    router.post('/transfersList', async(function* (req, res) {
        let sPageIndex = req.param('pageIndex');
        let sPageSize = req.param('pageSize');
        let pageIndex = Number(sPageIndex) || 0;
        let pageSize = Number(sPageSize) || 10;
    
        let userName = req.user.userName;
        paginate(transfer,{
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

    
    router.post('/updateTransferStatus', async(function* (req, res) {        
        let userName = req.user.userName;
        let sTransferId = req.param('transferId');
        let status = req.param('status');
        let transferId = mongoose.Types.ObjectId(sTransferId);


        let stepCallBack;
        yield* transfer.syncUserRecenttransfers(userName,sites,stepCallBack);
        res.json({ isSuccess: true });
    }));


}