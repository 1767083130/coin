'use strict';

const mongoose = require('mongoose');
const Account  = mongoose.model('Account');
const ClientIdentifier  = mongoose.model('ClientIdentifier');
const AccountHistory = mongoose.model('AccountHistory');
const Api = require('./apiClient/api');
const Decimal = require('decimal.js');

const co = require('co');
const realTimePrice = require('./realTimePrice');
const configUtil = require('./configUtil');
const common = require('./common');

const Natural_Symbol = configUtil.getNaturalCoin();
const UseCost = true; 

let account = new class{

    /**
     * 获取用户全部有效帐户信息
     */
    getUserAccounts(userName,callBack){
        return Account.find({ 
            userName: userName,
            isValid: true
        },callBack);
    }

    /**
     * 获取用户某个交易网站的帐户信息
     */
    getSiteAccount(userName,site,callBack){
        return Account.findOne({ 
            userName: userName,
            site: site,
            isValid: true
        },callBack);
    }

    /**
     * 同步用户的帐户持仓情况，
     * 在两种情况下需要更新账户。（1）创建委托；（2）委托状态更改。
     *
     * @param {trade} trade 
     *   如，let trade = {
            userName: "lcm", 
            symbol: "eth#btc", //币种，如eth#btc,eth(等价于eth#cny)
            site: "huobi", 
            price: 12,  //价格

            consignAmount: 60,  //委托数量
            bargainAmount: 20, //已成交数量
            bargainChangeAmount: 20, //已成交数量的变更数

            tradeType: "buy || sell"
        };
     * @param {type} type，总共有3种：create（创建委托）,bargain（委托成交）,cancel(取消委托) 在什末情况下更新账户。
     * @return {Account} 同步后的Account
     * @api public
     */
    * refreshAccountTrading(trade, type){
        let symbols = trade.symbol.split('#');
        if(symbols.length == 1){
            symbols.push('cny');
        }

        let tradeSymbol = symbols[0],
            naturalSymbol = symbols[1];
        let account = yield Account.findOneAndUpdate({ 
            userName: trade.userName, 
            site: trade.site
        });

        if(!account){
            //这里可能是账户信息还没有和交易网站同步
            return;
        }

        let tradeSymbolItem = this._getCoinItem(account.coins,tradeSymbol); 
        let naturalSymbolItem = this._getCoinItem(account.coins,naturalSymbol);

        if(type == 'create'){ //生成委托时
            let totalAmount = new Decimal(trade.consignAmount).times(trade.price).toNumber();
            if(trade.tradeType == 'buy'){
                naturalSymbolItem.frozenChange = totalAmount; // *
                tradeSymbolItem.applyChange = trade.consignAmount;

            } else if (trade.tradeType == 'sell'){
                tradeSymbolItem.frozenChange =  trade.consignAmount;
                naturalSymbolItem.applyChange = totalAmount; 
            }
        } else if(type == 'bargain') { //委托被交易时
            let totalAmount = new Decimal(trade.bargainChangeAmount).times(trade.price).toNumber();
            if(trade.tradeType == 'buy'){
                naturalSymbolItem.frozenChange = -totalAmount;
                naturalSymbolItem.totalChange = -totalAmount; 

                tradeSymbolItem.totalChange = trade.bargainChangeAmount;
                tradeSymbolItem.applyChange = -trade.bargainChangeAmount; 

            } else if (trade.tradeType == 'sell'){
                tradeSymbolItem.frozenChange = -trade.bargainChangeAmount;
                tradeSymbolItem.totalChange = -trade.bargainChangeAmount; 

                naturalSymbolItem.frozenChange = totalAmount;
                naturalSymbolItem.applyChange = -totalAmount;
            }
        } else if(type == 'cancel'){ //取消委托时
            let changeFrozenAmount = new Decimal(trade.bargainChangeAmount).plus(trade.consignAmount).minus(trade.bargainAmount);
            if(trade.tradeType == 'buy'){
                tradeSymbolItem.totalChange = trade.bargainChangeAmount;
                tradeSymbolItem.applyChange = -trade.bargainChangeAmount; 

                naturalSymbolItem.totalChange = -new Number(trade.bargainChangeAmount).times(trade.price).toNumber();
                naturalSymbolItem.frozenChange = -changeFrozenAmount.times(trade.price).toNumber(); 
                                                  //-(trade.bargainChangeAmount + (trade.consignAmount - trade.bargainAmount ) * trade.price )
            } else if (trade.tradeType == 'sell'){
                tradeSymbolItem.totalChange = -trade.bargainChangeAmount;
                tradeSymbolItem.frozenChange = -changeFrozenAmount.toNumber();
                                             //-(trade.bargainChangeAmount + (trade.consignAmount - trade.bargainAmount)); 
                naturalSymbolItem.totalChange = new Decimal(trade.bargainChangeAmount).times(trade.price).toNumber();
                                              //trade.bargainChangeAmount * trade.price;
                naturalSymbolItem.applyChange = -new Decimal(trade.bargainChangeAmount).times(trade.price).toNumber();
                                              //-trade.bargainChangeAmount * trade.price;
            }
        }

        let hasChanged = false; //账户是否变更
        if(tradeSymbolItem.totalChange != 0 || 
           tradeSymbolItem.frozenChange != 0 ||
           tradeSymbolItem.applyChange != 0 ){

            tradeSymbolItem.total = common.fixCoinAmount(new Decimal(tradeSymbolItem.total).plus(tradeSymbolItem.totalChange)); //保留4位
            tradeSymbolItem.frozen = common.fixCoinAmount(new Decimal(tradeSymbolItem.frozen).plus(tradeSymbolItem.frozenChange)); //保留4位
            tradeSymbolItem.apply = common.fixCoinAmount(new Decimal(tradeSymbolItem.apply).plus(tradeSymbolItem.applyChange)); //保留4位
            
            let accountHistory = new AccountHistory({
                site: trade.site,  
                userName: trade.userName,
                coin: tradeSymbolItem.coin,
        
                total: tradeSymbolItem.totalChange, 
                frozen: tradeSymbolItem.frozenChange,
                apply: tradeSymbolItem.applyChange, 

                exchangeType: "trade", //"trade"\"transfer"
                exchangeId: trade._id, //订单或转币ID
                changeType: type, //在什末情况下更新账户.总共有3种：create（创建委托）,bargain（委托成交）,cancel(取消委托)。

                operateId: trade.operateId, //操作Id
                created: Date.now()
            });
            accountHistory.save(function(err){
                //todo 记录异常
                console.log(err);
            });
            hasChanged = true;
        }


        if(naturalSymbolItem.totalChange != 0 || 
           naturalSymbolItem.frozenChange != 0 ||
           naturalSymbolItem.applyChange != 0 ){

            naturalSymbolItem.total = common.fixCoinAmount(new Decimal(naturalSymbolItem.total).plus(naturalSymbolItem.totalChange));  //保留4位
            naturalSymbolItem.frozen = common.fixCoinAmount(new Decimal(naturalSymbolItem.frozen).plus(naturalSymbolItem.frozenChange)); //保留4位
            naturalSymbolItem.apply = common.fixCoinAmount(new Decimal(naturalSymbolItem.apply).plus(naturalSymbolItem.applyChange)); //保留4位
      
            let accountHistory = new AccountHistory({
                site: trade.site,  
                userName: trade.userName,
                coin: naturalSymbolItem.coin,
        
                total: naturalSymbolItem.totalChange, //总额 = 可用数 + 冻结数
                frozen: naturalSymbolItem.frozenChange, //冻结
                apply: naturalSymbolItem.applyChange, //申请借贷

                exchangeType: "trade", //"trade"\"transfer"
                exchangeId: trade._id, //订单或转币ID
                changeType: type, //在什末情况下更新账户.总共有3种：create（创建委托）,bargain（委托成交）,cancel(取消委托)。

                operateId: trade.operateId, //操作Id
                created: Date.now()
            });
            yield accountHistory.save();
            hasChanged = true;
        }

        if(hasChanged){
            account = yield account.save();
        }

        return account;
    }


    /**
     * 同步用户的帐户持仓情况，
     * 在两种情况下需要更新账户。（1）创建委托；（2）委托状态更改。
     *
     * @param {transfer} transfer 
     *   如，let transfer = {
            source: { type: String, required: true }, //移动路径源交易所
            target: { type: String, required: true }, //移动路径目标交易所
            userName: { type: String, required: true }, 
            coin: String, //cny、btc、ltc、usd
            consignAmount: { type: Number, "default": 0 }
        };
     * @param {type} type，总共有3种：create（创建委托）,bargain（委托成交）,cancel(取消委托) 是否是创建委托时，更新账户。
     * @return {Account} 同步后的Account
     * @api public
     */
    * refreshAccountTransfering(transfer, type){
        let sourceAccount = yield Account.getUserAccount(transfer.userName,transfer.source);
        let targetAccount = yield Account.getUserAccount(transfer.userName,transfer.target);

        if(!sourceAccount || !targetAccount){
            //这里可能是账户信息还没有和交易网站同步
            //TODO 最好记录
            return;
        }

        let sourceAccountItem = this._getCoinItem(sourceAccount.coins,transfer.coin); 
        let targetAccountItem = this._getCoinItem(targetAccount.coins,transfer.coin);

        if(type == 'create'){ //生成委托时
            //（1）冻结源网站账户相应数量的币
            //（2）添加目标网站账户中相应数量币的请求数（未到帐）
            sourceAccountItem.frozenChange = common.fixCoinAmount(new Decimal(sourceAccountItem.frozenChange).plus(transfer.consignAmount));
            targetAccountItem.applyChange = common.fixCoinAmount(new Decimal(sourceAccountItem.applyChange).plus(transfer.consignAmount));
        } else if(type == 'bargain') { //委托被交易时
            //(1) 源网站账户减去相应数量的币并解除冻结那部分数量的币
            //(2) 目标网站账户添加相应数量的币
            sourceAccountItem.frozenChange = common.fixCoinAmount(new Decimal(sourceAccountItem.frozenChange).minus(transfer.consignAmount));
            sourceAccountItem.totalChange = common.fixCoinAmount(new Decimal(sourceAccountItem.totalChange).minus(transfer.consignAmount));
            targetAccountItem.totalChange = common.fixCoinAmount(new Decimal(targetAccountItem.totalChange).plus(transfer.consignAmount));
        } else if(type == 'cancel'){ //取消委托时
            //（1）解冻源网站账户相应数量的币
            //（2）目标网站账户中减去相应数量币的请求数（未到帐）
            sourceAccountItem.frozenChange = common.fixCoinAmount(new Decimal(sourceAccountItem.frozenChange).minus(transfer.consignAmount));
            targetAccountItem.applyChange = common.fixCoinAmount(new Decimal(targetAccountItem.applyChange).minus(transfer.consignAmount));
        }

        let hasChanged = false;
        if(sourceAccountItem.totalChange != 0 || 
           sourceAccountItem.frozenChange != 0 ||
           sourceAccountItem.applyChange != 0 ){
            
            let accountHistory = new AccountHistory({
                site: transfer.site,  
                userName: transfer.userName,
                coin: sourceAccountItem.coin,
        
                total: sourceAccountItem.totalChange, //总额 = 可用数 + 冻结数
                frozen: sourceAccountItem.frozenChange, //冻结
                apply: sourceAccountItem.applyChange, //申请借贷

                exchangeType: "transfer", //"trade"\"transfer"
                exchangeId: transfer._id, //订单或转币ID
                changeType: type, //在什末情况下更新账户.总共有3种：create（创建委托）,bargain（委托成交）,cancel(取消委托)。

                operateId: transfer.operateId, //操作Id
                created: Date.now()
            });
            accountHistory = yield accountHistory.save();
            hasChanged = true;
        }

        if(targetAccountItem.totalChange != 0 || 
           targetAccountItem.frozenChange != 0 ||
           targetAccountItem.applyChange != 0 ){
            
            let accountHistory = new AccountHistory({
                site: transfer.site,  
                userName: transfer.userName,
                coin: targetAccountItem.coin,
        
                total: targetAccountItem.totalChange, //总额 = 可用数 + 冻结数
                frozen: targetAccountItem.frozenChange, //冻结
                apply: targetAccountItem.applyChange, //申请借贷

                exchangeType: "transfer", //"trade"\"transfer"
                exchangeId: transfer._id, //订单或转币ID
                changeType: type, //在什末情况下更新账户.总共有3种：create（创建委托）,bargain（委托成交）,cancel(取消委托)。

                operateId: transfer.operateId, //操作Id
                created: Date.now()
            });
            accountHistory = yield accountHistory.save();
            hasChanged = true;
        }

        if(hasChanged){
            account = yield account.save();
        }

        return account;
    }

    /**
     * 同步用户的帐户持仓情况
     *
     * @param {ClientIdentifier} identifier, 第三方平台的开放api访问授权帐户
     * @return {Account} 同步后的Account
     * @api public
     */
    * syncSiteAccount(identifier){
        let api = new Api(identifier);
        let getAccountRes = yield api.getAccountInfo();             

        if(!getAccountRes.isSuccess || !getAccountRes.account){
            throw new Error(`从第三方交易平台获取账户信息失败。${getAccountRes.message}`);
        }
        
        let account = yield Account.findOneAndUpdate(
            { userName: identifier.userName, site: identifier.site, isTest:false },
            { isLocked: true});
        if(!account){
            let coins = getAccountRes.account.coins;

            for(let i = 0; i < coins.length; i++){
                let coinItem = coins[i];
                let orgCoin = account.coins.find(function(value){
                    return value.coin == coinItem.coin;
                }) || { total: 0, frozen: 0, loan: 0,apply: 0, cost: 0 }  
                
                let changeInfo = {
                    totalChange: new Decimal(orgCoin.total).minus(coinItem.total).toNumber(),
                    frozenChange: new Decimal(orgCoin.frozen).minus(coinItem.frozen).toNumber(),
                    applyChange: new Decimal(orgCoin.apply).minus(coinItem.apply).toNumber()
                };

                let accountHistory = new AccountHistory({
                    site: identifier.site,  
                    userName: identifier.userName,
                    coin: coinItem.coin,
        
                    total: changeInfo.totalChange, 
                    frozen: changeInfo.frozenChange, 
                    apply: changeInfo.applyChange, 

                    exchangeType: "other", 
                    //exchangeId: transfer._id, //订单或转币ID
                    changeType: "sync_accounts",

                    //operateId: transfer.operateId, //操作Id
                    created: Date.now()
                });
                accountHistory = yield accountHistory.save();
            }

            account = new Account({
                userName: identifier.userName, 
                site: identifier.site,
                coins: getAccountRes.account.coins
            });
            account = yield account.save();
        } else {
            account.coins = getAccountRes.account.coins;
            account.modified = new Date();
            account.isLocked = false;
            account = yield account.save();
        }

        return account;
    }

    /**
     * 同步用户的帐户持仓情况
     *
     * @param {Account} account
     * @return {Account} 同步后的Account
     * @api public
     */
    * syncAccount(account){
        if(account.isTest){
            return;
        }


        let identifier = yield ClientIdentifier.findOne({ site: account.site, userName: account.userName,isValid: true });
        if(!identifier){
            return;
        }

        let newAccount = yield* this.syncSiteAccount(identifier)
        return newAccount;
    }

    /**
     * 同步用户的帐户持仓情况
     *
     * @param {Account} account
     * @return {Account} 同步后的Account
     * @api public
     */
    * syncAllAccounts(stepCallback){
        let index = 0;
        let clientIdentifiers = yield ClientIdentifier.find({ isValid: true });

        for(let clientIdentifier of clientIdentifiers){
            let stepRes = { 
                stepIndex: index, 
                message: `第${index}个同步成功，总共${clientIdentifiers.length}个`,
                isSuccess: true,
                stepCount: clientIdentifiers.length 
            };
            
            try{
                let account = yield* this.syncSiteAccount(clientIdentifier);

                let stepRes = { 
                    account: account, 
                    stepIndex: index, 
                    isSuccess: true,
                    message: `第${index}个同步成功`,
                    stepCount: clientIdentifiers.length 
                };
                stepCallback(stepRes);

            }catch(e){
                stepRes.isSuccess = false;
                stepRes.message = `第${index}个同步失败，总共${clientIdentifiers.length}个。错误信息:${e.message}`;
                stepCallback(stepRes);
            }

            index++;
        }
    }

    * syncUserAccounts(sites,userName){
        let arrSites = sites.split(',');

        let accounts = [];
        for(let i = 0; i < arrSites.length; i++){
            let identifier = yield ClientIdentifier.findOne({ site: arrSites[i], userName: userName,isValid: true });
            if(!identifier){
                continue;
            }

            let account = yield* this.syncSiteAccount(identifier)
            accounts.push(account);
        }

        return accounts;
    }

    
    /**
     * 获取用户账户资产情况。
     * 
     * @param {String} userName, 用户名
     * @returns {Object} 返回格式为 { 
     *      totalStock: 123,   //整个账户用本位币计量的总资产
     *      totalAvailableNatural: 3332, //可用的本位币
     *      coins:[{ "coin": "ltc", amount: 12, price: 243}] } //amount:数量 price：价格
     * @api private
     * 
     */
    * getMarketAccountInfo(userName) {  //todo
        var totalAsset = 0; //账户币种总价值（不包括本位币）
        var accountInfo = {}; //账户资产情况

        // 统计一个币种的市场价并记入总资产
        var addItem = function* (item){ 
            var marketPrice;
            if(!UseCost){
                marketPrice = yield* realTimePrice.getSymbolPrice(item.symbol);
                if(!marketPrice || marketPrice <= 0){ //如果获取不到市场价，则以成本价计算
                    marketPrice = item.cost / item.amount;
                }
            }

            var existItem = accountInfo.coins.find(function(value,index){
                return value.coin == item.symbol; 
            });

            if(existItem){
                existItem.amount += item.amount;
                existItem.price += (UseCost ? item.cost : marketPrice * item.amount);
            }
            else{
                item.price += (UseCost ? item.cost : marketPrice * item.amount);
                accountInfo.coins.push(item);
            }

            totalAsset += marketPrice * item.amount;
        }.bind(this);
    
        //计算账户证券资产总值
        let accounts = yield Account.find({ userName: userName});
        for(var account of accounts){ 
            for(var totalItem of account.totals){
                if(totalItem.symbol != Natural_Symbol){
                    yield* addItem({ "symbol": totalItem.symbol, "amount": totalItem.amount,"cost" : totalItem.cost });
                }
            }

            for(var applyItem of account.applys){
                if(totalItem.symbol != Natural_Symbol){
                    yield* addItem({ "symbol": applyItem.symbol, "amount": applyItem.amount,"cost" : applyItem.cost });
                }
            }
        }
        accountInfo.totalStock = totalAsset;

        //计算本位币可用余额
        let totalNaturalCoin = account.totals.find(function(value,index){
            return value.symbol == Natural_Symbol; 
        });
        let availableNaturalCoin = account.applys.find(function(value,index){
            return value.symbol == Natural_Symbol; 
        });
        accountInfo.totalAvailableNatural = (totalNaturalCoin ? totalNaturalCoin.amount : 0) 
                    - (availableNaturalCoin ? availableNaturalCoin.amount : 0);

        return accountInfo;

    }
    
    _getCoinItem(items,coin){
        let coinItem = items.find(function(item,index) {
            return item.coin == coin;
        });

        if(!coinItem){
            coinItem = { coin: coin,total: 0, frozen: 0,apply: 0 };
            items.push(coinItem);
        }

        coinItem.totalChange = 0;
        coinItem.frozenChange = 0;
        coinItem.applyChange = 0;
        return coinItem;
    }

}();

module.exports = account;