'use strict';

const transferController = require('./transferStrategys/transferController.js');
const stopLoss = require('./strategys/stopLoss.js');

let strategy = new class{
    constructor(){
    }

    /**
     * 执行平台之间的差价操作策略
     * 
     * @param {strategy} strategy，交易策略
     * @returns { isSuccess: false, message:""}
     */
    * runTransferStrategy(transferStrategy){
        let res = yield* transferController.runStrategy(transferStrategy);
        return res;
    }

    /**
     * 执行平台之间的差价操作策略
     * 
     * @param {strategy} strategy，交易策略
     * @returns { isSuccess: false, message:""}
     */
    * runAllTransferStrategys(){
        //todo 
    }


    * runStopLoss(stopLossLog,accountInfo,identifier){
        let res = yield* stopLoss.runStopLoss(stopLossLog,accountInfo,identifier);
        return res;
    }

    * runStopLosses(){
        yield* stopLoss.runStopLosses(function(stepRes){
           console.log('执行完成一个'); //todo
        });
    }
}();

module.exports = strategy;

