'use strict';

const transfer = require('../transfer');
const trade = require('../trade');
const account = require('../account');

const clientIdentifier = require('../clientIdentifier');
const configUtil = require('../configUtil');
const Decimal = require('decimal.js');
const BaseStrategyRunner = require('./baseStrategyRunner');

const mongoose = require('mongoose');
const TransferStrategyLog = mongoose.model('TransferStrategyLog');
const TransferStrategy = mongoose.model('TransferStrategy');
const ExchangeException = mongoose.model('ExchangeException');
const Transfer = mongoose.model('Transfer');

/**
 * btctrade交易网站接口实现
 */
let transferController = new class {
    constructor(){
    }

    /**
     * 执行平台之间的差价操作策略
     * 
     * @param {strategy} strategy，交易策略
     * @returns { isSuccess: false, message:""}
     */
    * runStrategy(strategy){
        let instance = BaseStrategyRunner.getInstance(strategy.strategyType);
        return yield* instance.runStrategy(strategy);
    }

    /**
     * 获取符合条件表达式的交易数量以及价格等信息
     * @param {string} condition
     * @param {object} env 如{"userName" : "lcm" }
     * @param {String} strategyType 平台之间差价策略类型,如 normal\between等
     * @Returns 返回。 .e.g.
     *{
            symbol: variableObj.symbol,
            site: variableObj.site,
            tradeType: variableObj.tradeType,
            amount: amount,
            price: price
        }
     *
     * @public
     */
    * getConditionResult(condition,env,strategyType){
        let instance = BaseStrategyRunner.getInstance(strategyType);
        return yield* instance.getConditionResult(condition,env);
    }

    /**
     * 订单状态变更处理函数
     * @param {Object} e,参数，至少要有两个字段.e.g. 
     *  { trade: refreshTrade, //变更后的订单
     *     changeAmount: 23 } //变更的额度
     * 
     */
    * onTradeStatusChanged(e){
        if(e.trade.reason != 'transfer'){
            return;
        }

        let identifier = e.identifier;
        if(!identifier){
            identifier = yield clientIdentifier.getUserClient(e.trade.userName,e.trade.site);
        }

        if(!identifier){
            console.log(`未找到identifier`);
            return;
        }

        //let operateId = trade.operateId;
        let transferStrategyLog = yield TransferStrategyLog.findOne({_id: e.trade.actionId });
        let transferStrategy = yield TransferStrategy.findOne({ _id: transferStrategyLog.strategyId });

        let currentLogOperate = transferStrategyLog.operates.find(function(value){
            return value._id.toString() == e.trade.operateId.toString();
        });
        let currentOperate = currentLogOperate.orgOperate;

        //更改未处理金额
        currentLogOperate.actualAmount = new Decimal(currentLogOperate.actualAmount || 0).plus(e.changeAmount).toNumber();
        currentLogOperate.undeal = new Decimal(currentLogOperate.undeal || 0).plus(e.changeAmount).toNumber();
        
        //余下未完成交易的数额
        let leftAmount = new Decimal(currentLogOperate.totalAmount).minus(currentLogOperate.actualAmount).toNumber();

        if(currentOperate.nextOperate && currentOperate.nextOperate > 0){ //如果有下一步
            let nextOperate = transferStrategy.operates.find(function(value){
                return value.id == currentOperate.nextOperate;
            });
            let nextLogOperate = transferStrategyLog.operates.find(function(value){
                return value.orgOperate.id == currentLogOperate.orgOperate.nextOperate;
            });
            nextLogOperate.transferStrategyLog = transferStrategyLog;

            var run = false, //是否需要执行
                operateStatus = 'part_success'; 
            //判断是否可以进行下一步操作
            if(currentOperate.batchMin >= 0){ //能分批 
                let waitEnough = (currentOperate.batchWait <= 0    //满足分批的等待时间
                    || +currentLogOperate.startTime <= +new Date() - currentOperate.batchWait * 1000)

                if( (currentLogOperate.undeal >= currentOperate.batchMin) //满足分批的金额
                    && waitEnough){ //满足分批的等待时间
                    run = true;
                } 

                //还有一种情况可以执行分批:
                //余下未完成交易的数额已经很小,不能满足下次分批操作,这样的零头忽略
                if(leftAmount < currentOperate.batchMin && waitEnough){
                    run = true;
                    operateStatus = 'success';
                }
            } else { //不能分批,则当前操作必须全部执行完成
                //nothing to do
            }

            if(leftAmount <= 0){ //当前操作全部执行完成
                run = true;
                operateStatus = 'success';
            }

            //更改操作状态
            currentLogOperate.status = operateStatus;

            if(nextOperate){
                if(run){
                    try {
                        if(nextLogOperate.action == 'transfer'){
                            //如果是转币操作，这里需要记录转币前账户余额，方便后面判断是否转币到帐
                            //todo 这里应该可以用更好的办法
                            let siteAccount = account.getSiteAccount(transferStrategyLog.userName,nextLogOperate.site);
                            let accountAmount = siteAccount.getTotal(nextLogOperate.symbol);
                            nextLogOperate.accountAmount = accountAmount;
                        }

                        let runOperateRes = yield* this.runOperate(nextLogOperate,null,currentLogOperate.undeal);
                        if(runOperateRes.isSuccess){
                            currentLogOperate.undeal = 0;
                        } 
                    } catch(err){
                        console.log(err);
                    }
                }
            }
        } else { //没有下一步了
            if(leftAmount <= 0){ //当前操作全部执行完成
                currentLogOperate.status = 'success';
            }
        }


        //检测是否可以结束此次策略的运行
        let notSuccessOperate = transferStrategyLog.operates.find(function(value){
            return value.status != 'success';
        });

        if(!notSuccessOperate){ //所有步都已经全部完成
            transferStrategyLog.status = 'success';
        }

        yield transferStrategyLog.save();
    }


            
    /**
     * 执行操作
     * 
     * @param {operate} operate
     * @param {identifier} ClientIdentifier
     * @returns {[Trade]} 
     * @public
     */
    * runOperate(operateLog,identifier,stepAmount){
        let res;
        if(operateLog.orgOperate.action == "trade"){
            res = yield* trade.runTradeOperate(operateLog,identifier,stepAmount)
        } else if(operateLog.orgOperate.action == "transfer"){
            res = yield* transfer.runTransferOperate(operateLog,identifier,stepAmount);
        } else {
            res = { isSuccess:false, message: `不能识别的操作:${operateLog.orgOperate.action}`,errorCode: '200000' }
        }

        return res;
    }

    * finishTransferStep(operateLog){
        if(operateLog.actionIds.length == 0){
            return { isSuccess: false,errorCode: 200000, message:`转币操作还没有执行，不能更改状态！`  };
        }

        if(operateLog.actionIds.length > 1){
            return { isSuccess: false,errorCode: 200000,message:`系统错误，策略交易中转币操作被分成多步执行`  };
        }

        let actionId = operateLog.actionIds[0];
        let transferModel = yield Transfer.find({ _id: actionId });
        yield* transfer.finishTransfer(transferModel);

        let res = {
            isSuccess: true,
            transfer: transferModel
        };
        return res;
   
    }

    /**
     * 订单状态变更处理函数
     * @param {Object} e,参数，至少要有两个字段.e.g. 
     *  {  trade: refreshTrade, //变更后的订单
     *     changeAmount: 23,  //变更的额度
     *     identifier: {}     //授权信息.可以为空 
     *  }
     * 
     */
    * onTradeDelayed(e){
        if(['consign','wait','part_success'].indexOf(e.trade.status) != -1){
            return;
        }

        let transferConfig = configUtil.getBusiness().transfer;
        if(e.trade.reason != 'transfer' 
          || e.timeDelayed > transferConfig.maxTradeWait
          || e.timeDelayed < transferConfig.minTradeWait){ //被延迟10分钟
            return;
        }

        let strategyLog = yield TransferStrategyLog.loadByOperateId(e.trade.actionId);
        if(strategyLog){
            //todo 这里系统异常处理
            console.log(`未找到_Id为${e.trade.actionId}的log`);
            return;
        }

        let operate = strategyLog.operates.find(function(value){
            return value._id.toString() == e.trade.operateId.toString();
        });

        if(!operate){
            console.log(`未找到_Id为${e.trade.actionId}的operate`);
            return;
        }

        let identifier = e.identifier;
        if(!identifier){
            identifier = yield clientIdentifier.getUserClient(e.trade.userName,e.trade.site);
        }

        if(!identifier){
            console.log(`未找到identifier`);
            return;
        }

        if(operate.id == 0 || operate.id == 1){
            //尚未执行任何操作，则撤销
            yield* trade.cancelTrade(e.trade,identifier);
        
        } else {
            if(trade.autoRetry){
                //todo 这里是有问题的.不成功则重新发起委托,有可能会导致委托价格不可控
                //已经不能撤销了，则重新执行委托
                yield* trade.retryTrade(e.trade,identifier,0.2); 
            } else {

                //记录异常
                //todo 需要确认延迟多久
                let exchangeException = new ExchangeException({
                    userName: trade.userName,
                    exchangeType: "trade", //市场行为类型
                    site: trade.site,
                    actionId: trade._id, //tradeId or transferId
                    operateId: trade.operateId, //transferStrategyLog.operate._id
                    status: 0, //0，尚未处理；1，已处理
                    //message: String,
                    causeCode: "delay", //异常类型
                    autoHandle: false,  //是否需要自动处理，否则为人工处理
                    handleCode: "cancel" //处理办法.
                    //realHandleCode: String,
                    //desc: String,
                });
                exchangeException.save();
            }
        }
    }

    * onTransferStatusChanged(e){
        if(!e.transfer || e.transfer.status != 'success'){
            return;
        }


        let identifier = e.identifier;
        if(!identifier){
            identifier = yield clientIdentifier.getUserClient(e.trade.userName,e.trade.site);
        }
        
        if(!identifier){
            console.log(`未找到identifier`);
            return;
        }

        //let operateId = trade.operateId;
        let transferStrategyLog = yield TransferStrategyLog.findOne({_id: e.transfer.actionId });
        if(!transferStrategyLog){
            //todo 应当记录错误日志
            console.log('系统错误。transferStrategyLog为空');
            return;
        }

        let transferStrategy = yield TransferStrategy.findOne({ _id: transferStrategyLog.strategyId });
        if(!transferStrategy){
            //todo 应当记录错误日志
            console.log('系统错误。transferStrategy为空');
            return;
        }

        let currentLogOperate = transferStrategyLog.operates.find(function(value){
            return value._id.toString() == e.trade.operateId.toString();
        });
        if(!currentLogOperate){
            //todo 应当记录错误日志 
            console.log('系统错误。transferStrategy为空');
            return;
        }
        let currentOperate = currentLogOperate.orgOperate;

        //更改未处理金额
        currentLogOperate.actualAmount = e.transfer.consignAmount;

        if(currentOperate.nextOperate && currentOperate.nextOperate > 0){ //如果有下一步
            let nextOperate = transferStrategy.operates.find(function(value){
                return value.id == currentOperate.nextOperate;
            });
            let nextLogOperate = transferStrategyLog.operates.find(function(value){
                return value.orgOperate.id == currentLogOperate.orgOperate.nextOperate;
            });
            nextLogOperate.transferStrategyLog = transferStrategyLog;

            var  operateStatus = 'success'; 

            //更改操作状态
            currentOperate.status = operateStatus;

            if(nextOperate){
                try {
                    let runOperateRes = yield* this.runOperate(nextLogOperate,identifier,e.transfer.consignAmount);
                    if(runOperateRes.isSuccess){
                        currentLogOperate.undeal = 0;
                    } else {
                        currentLogOperate.undeal = new Decimal(currentLogOperate.undeal).plus(e.transfer.consignAmount).toNumber();
                    }
                } catch(err){
                    console.log(err);
                }
            }
        } 

        //检测是否可以结束此次策略的运行
        let notSuccessOperate = transferStrategyLog.operates.find(function(value){
            return value.status != 'success';
        });

        if(!notSuccessOperate){ //所有步都已经全部完成
            transferStrategyLog.status = 'success';
        }

        yield transferStrategyLog.save();
    }

    * onTransferDelayed(e){
        let transfer = e.transfer;
        if(!transfer || transfer.status == 'success'  || e.timeDelayed < 30 * 60 * 1000){ //被延迟30分钟
            return;
        }

        //todo 需要确认延迟多久
        let exchangeException = new ExchangeException({
            userName: transfer.userName,
            exchangeType: "transfer", //市场行为类型
            site: transfer.site,
            actionId: transfer._id, //tradeId or transferId
            operateId: transfer.operateId, //transferStrategyLog.operate._id
            status: 0, //0，尚未处理；1，已处理
            //message: String,
            causeCode: "delay", //异常类型
            autoHandle: false,  //是否需要自动处理，否则为人工处理
            handleCode: "cancel" //处理办法.
            //realHandleCode: String,
            //desc: String,
        });
        exchangeException.save();
    }

}();

module.exports = transferController;