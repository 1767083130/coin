'use strict';

const mongoose = require('mongoose');
const TransferStrategy = mongoose.model('TransferStrategy');
const TransferStrategyLog = mongoose.model('TransferStrategyLog');

const async = require('co').wrap;
const only = require('only');
const strategy = require('../lib/strategy');
const transferController = require('../lib/transferStrategys/transferController');
const paginate = require('../lib/utils/paginate');

module.exports = function (router) {
    //router.get('/', account.index_api);
    router.post('/strategysList', async(function* (req, res) {
        let sPageIndex = req.param('pageIndex');
        let sPageSize = req.param('pageSize');
        let pageIndex = Number(sPageIndex) || 0;
        let pageSize = Number(sPageSize) || 10;
    
        let userName = req.user.userName;
        paginate(TransferStrategy,{
            filters : { userName : userName },
            page:  pageIndex + 1,
            sort : { modified : -1 },
            perPage: pageSize
        }).exec(function (err,result) {
            var t = {
                total :0,
                isSuccess : false
            };  

            if(err){
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

    router.post('/saveAccountStrategy', async(function* (req, res) {
        let strategy = yield TransferStrategy.findOne({ userName: req.user.userName });
        if(!strategy){
            strategy = new TransferStrategy();
        }
        
        //todo
        strategy.userName = req.user.userName;
        strategy.account = req.body.accountStrategy;
        strategy = yield strategy.save();

        res.json({ isSuccess: true,strategy: strategy });
    }));

    router.post('/runTransferStrategy', async(function* (req, res) {
        let sStrategyId = req.body.strategyId;
        let strategyId;
        if(sStrategyId){
            strategyId = mongoose.Types.ObjectId(sStrategyId);
        }

        let transferStrategy = yield TransferStrategy.findOne({ _id: strategyId});
        let runRes = yield* strategy.runTransferStrategy(transferStrategy);
        res.json({ isSuccess: runRes.isSuccess, message: runRes.message });
    }));

    router.post('/getConditionResult', async(function* (req, res) {
        let userName = req.user.userName;
        let env = { userName: userName };
        let strategyType = req.body.strategyType || 'normal';
        let condition = req.body.condition || '1==0';

        let runRes = yield*  transferController.getConditionResult(condition,env,strategyType);
        res.json({ isSuccess: true, conditionResult: runRes });
    }));


};


