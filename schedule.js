'use strict';
require('./index');

const mongoose = require('mongoose');
const TransferStrategy = mongoose.model('TransferStrategy');

const trade = require('./lib/trade');
const transfer = require('./lib/transfer');
const account = require('./lib/account');
const realTimePrice = require('./lib/realTimePrice');
const strategy = require('./lib/strategy');
const transferController =  require('./lib/transferStrategys/transferController');
const co = require('co');

const INTERVAL = 1000;

function runSchedule(options) {
    options = options || {};

    if (options.oneTime) { //只执行一次
        syncRecentTrades();
        //syncAllAccounts();
        getRealTimePrices();
        runRealExchanges();
    }
    else {
        //setTimeout(syncAllAccounts, 0);   //(syncAllAccounts,INTERVAL * 5);
        
        setInterval(syncRecentTrades, INTERVAL * 0.5);        
        setInterval(getRealTimePrices, 600);
        setInterval(runRealExchanges, INTERVAL * 60);

        // setInterval(syncAllTrades, INTERVAL * 5);
        // //setInterval(syncTransfers,INTERVAL);
        // setInterval(getRealTimePrices, 600);
        // setInterval(runRealExchanges, INTERVAL * 10);

        //检查状态，如果碰到超时未执行完毕的任务，则认为执行失败
        //setInterval(checkTask,20000);
  
        //syncRecentTrades(siteRealPrices,identifier,callBack) {
        //setInterval(tradeController.getRealTimePrices, INTERVAL);
    }
}

runSchedule();

function getRealTimePrices(){
    co(function* (){
        realTimePrice.getAllRealPrices(function(err,res){
            if(err){
                console.log('获取行情时发生错误' + (new Date()).toLocaleString());
                return;
            }

            //let realPrices = realTimePrice.getLatestRealPrices();
            //console.log(`最近的实时行情中总共有${realPrices.length}个数据项`);
        });
    }).catch(function(err){
        console.error(err);
    })
}

function syncTransfers(){
    co(function* (){
        console.log('--开始同步转币信息--');
        let count = 0;
        yield* transfer.syncTransfers(function(stepRes){ 
            console.log(stepRes.message);

            count++;      
            if(stepRes.stepCount <= count){
                console.log('--同步转币信息结束--');
            }
        });
    });
}

function syncAllAccounts(){
    co(function* (){
        //console.log('--开始同步全部账户--');
        let count = 0;
        yield* account.syncAllAccounts(function(stepRes){
            //let stepRes = { 
            //    account: account, 
            //    stepIndex: i, 
            //    message: `第${i}个同步成功，总共${accounts.length}个`,
            //    isSuccess: true;
            //    stepCount: accounts.length 
            //};   
            console.log(stepRes.message);

            count++;      
            if(stepRes.stepCount <= count){
                //console.log('--同步全部账户结束--');
            }
        });
    });
}

function syncRecentTrades(){
    co(function* (){
        //console.log('--开始同步全部账户的订单状态--');
        let count = 0;

        trade.tradeStatusChangedEvent.unregister(transferController,transferController.onTradeStatusChanged);
        trade.tradeDelayedEvent.unregister(transferController,transferController.onTradeDelayed);

        trade.tradeStatusChangedEvent.register(transferController,transferController.onTradeStatusChanged);
        trade.tradeDelayedEvent.register(transferController,transferController.onTradeDelayed);

        yield* trade.syncRecentTrades(function(stepRes){
            //let stepRes = { 
            //    account: account, 
            //    stepIndex: i, 
            //    message: `第${i}个同步成功，总共${accounts.length}个`,
            //    isSuccess: true;
            //    stepCount: accounts.length 
            //}; 
            debugger;  
            console.log(stepRes.message);

            count++;      
            if(stepRes.stepCount <= count){
                //console.log('--同步全部账户的订单状态结束--');
            }
        });
    }).catch(function(err){
        console.log(err);
    });
}

function runRealExchanges(){
    co(function* (){       
        let transferStrategys = yield TransferStrategy.find({
            isValid: true
        });

        for(var item of transferStrategys){
            let res = yield* strategy.runTransferStrategy(item);
            if(res.isSuccess){
                console.log(`成功执行策略${item.name},策略ID为：${item._id.toString()}。message:${res.message}`);
            } else {
                console.log(`执行策略${item.name}失败,策略ID为：${item._id.toString()}，错误信息：${res.message}`);
            }
        }
    }).catch(function(err){
        console.error(err);
    });
}

