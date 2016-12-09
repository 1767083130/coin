'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Account  = mongoose.model('Account');
const ClientIdentifier  = mongoose.model('ClientIdentifier');
const Strategy = mongoose.model('Strategy');
const TransferStrategyLog = mongoose.model('TransferStrategyLog');

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
        let pageSize = 10;
    
        let userName = req.user.userName;
        let getRes = yield paginate(TransferStrategyLog,{
            filters : { userName : userName},
            page:  pageIndex + 1,
            sort : { modified : -1 },
            perPage: pageSize
        });

        let model = {
            pageSize: pageSize,
            total: getRes.total,
            logs: getRes.results,
            isSuccess: true
        };

        res.render('transfer', model);
    }));

    router.post('/list', async(function* (req, res) {
        let sPageIndex = req.param('pageIndex');
        let sPageSize = req.param('pageSize');
        let sAuto = req.param('auto').trim();
        let sStatus = req.param('status').trim();

        let pageIndex = Number(sPageIndex) || 0;
        let pageSize = Number(sPageSize) || 10;

        let filters = { userName : userName };
        if(sAuto == "1"){
            filters.auto = true;
        } else if(sAuto == "0"){

            filters.auto = false;
        }

        if(sStatus){
            filters.status = sStatus;
        }



        let userName = req.user.userName;
        paginate(TransferStrategyLog,{
            filters : filters,
            page:  pageIndex + 1,
            sort : { modified : -1 },
            perPage: pageSize
        }).exec(function (err,getRes) {
            let t;
            if(err){
                t = {
                    isSuccess : false
                }; 
            }
            else{
                t = {
                    pageSize: pageSize,
                    total: getRes.total,
                    logs: getRes.results,
                    isSuccess: true
                };       
            }

            res.json(t);
            //var total = results.total;
        });

    }));

    router.post('/finishTransferStep', async(function* (req, res) {
        let sStrategyStepId = req.body.strategyStepId;
        let strategyStepId;
        if(sStrategyStepId){
            strategyStepId = mongoose.Types.ObjectId(sStrategyStepId);
        }

        let stepLog = yield TransferStrategyLog.aggregate(
            //{ $match: { "operates._id" : strategyStepId } },
            { $unwind:"$operates" },
            { $match: { "operates._id": strategyStepId } },
            { $group: { 
                userName: "$userName", 
                strategyId: "$strategyId", 
                operate: { $first: "$operates" } }
            }
        ).exec();

        if(!stepLog){
            return res.json({ isSuccess: false,errorCode:"200000", message: "找不到执行记录!" });
        }
        
        yield* transferController.finishTransferStep(stepLog.operate);
        res.json({ isSuccess: true });
    }));
  

    
    router.post('/updateStatus', async(function* (req, res) {        
        let userName = req.user.userName;
        let sTransferId = req.param('transferId');
        let status = req.param('status');
        let transferId = mongoose.Types.ObjectId(sTransferId);


        let stepCallBack;
        yield* transfer.syncUserRecenttransfers(userName,sites,stepCallBack);
        res.json({ isSuccess: true });
    }));


}