'use strict';

var app = require('../index.js'),
    mongoose = require('mongoose'),
    ClientIdentifier = mongoose.model('ClientIdentifier'),
    User = mongoose.model('User'),
    Account = mongoose.model('Account'),
    TransferStrategy = mongoose.model('TransferStrategy'),
    co = require('co');

let testUtil = new class{
    constructor(){
        co(function *(){
            yield* this.init();
        }.bind(this)).catch(function(e){
        });
    }
  
    * getTestTransferStrategy(){
        let transferStrategy = yield TransferStrategy.findOne({
            userName: "lcm",
            name: "test000000"
        });

        if(!transferStrategy){
            transferStrategy = new TransferStrategy({
                userName: "lcm", 
                isTest: true,
                openType: "private",
                
                priceRange: 0.1, //未成功的交易价格容忍度，如0.5，表示0.5%的价差

                name: "test000000",
                //itemId: { type: Schema.ObjectId },
                isSimple: false,  //是否为简单模式
                isValid: true,
                conditions: ['btctrade.eth#cny.buy + btctrade.eth#cny.sell > 0'], //需要满足的条件
                strategyType: "normal" , //策略类型。现在支持between、normal两种
                operates: [{

                    id: 1, //从1开始记数。1,2,3,4,5 ...
                    site: "btctrade", //平台名称

                    action: "trade",  //操作类型。分为 trade(成交)、transfer（转币）两种
                    tradeType: "buy", //buy或sell。当action=trade时有效

                    //transferSource: String, //移动路径源交易所,当action=transfer时有效，如 transferSource = 'huobi',transferTarget = 'btctrade'，表示从huobi移向btctrade
                    //transferTarget: String, //移动路径目标交易所

                    minTradeAmount: 0.1,
                    symbol: "eth#cny", //btc#cny、btc、ltc、usd。 注意，当action=trade时，为btc#cny; 当action=transfer时，为btc
                    previousOperate: 0,
                    nextOperate: 2,
                    tradeAmount: 0.1 //"btctrade.eth.account.available"  //比如 5 或者 5%,数字表示多少个，百分比表示账户总额中的百分之多少
                },{

                    id: 2, //从1开始记数。1,2,3,4,5 ...
                    site: "btctrade", //平台名称

                    action: "trade",  //操作类型。分为 trade(成交)、transfer（转币）两种
                    tradeType: "buy", //buy或sell。当action=trade时有效

                    //transferSource: String, //移动路径源交易所,当action=transfer时有效，如 transferSource = 'huobi',transferTarget = 'btctrade'，表示从huobi移向btctrade
                    //transferTarget: String, //移动路径目标交易所

                    minTradeAmount: 0.1,
                    symbol: "eth#cny", //btc#cny、btc、ltc、usd。 注意，当action=trade时，为btc#cny; 当action=transfer时，为btc
                    previousOperate: 1,
                    nextOperate: 0,
                    tradeAmount: 0.1 //"btctrade.eth.account.available"  //比如 5 或者 5%,数字表示多少个，百分比表示账户总额中的百分之多少
                }],
                priority: 0, //优先级 
                desc: "String",

                created: Date.now(),
                modified: Date.now()

            });
        }

        transferStrategy = yield transferStrategy.save();
        return transferStrategy;
           
    }

    * init(){
        yield* this.addAccount();
        yield*  this.addClients();
        this.addUsers();
    }
    
    addUsers() { //add two users
        var u1 = new User({
            name: 'Kraken McSquid',
            userName: 'lcm',
            password: 'lcm',
            role: 'admin'
        });

        var u2 = new User({
            name: 'Ash Williams',
            userName: 'zjp',
            password: 'zjp',
            role: 'user'
        });

        //Ignore errors. In this case, the errors will be for duplicate keys as we run this app more than once.
        u1.save();
        u2.save();
    }

    * addClients(){
        let clients = [];
        let _client = {
            site: "btctrade",
            userName: "lcm",
            appKey: "3frrr-rpuiq-pwtxa-uxdvc-ka4p1-768gg-uiwja",
            appSecret: "Qq!D.-ScVC6-~n$vc-r!AAR-BQ,S9-nERf5-(/v^q",
            safePassword: "360yee",
            coinAddresses: [{ 
                coin: "eth", 
                address: "0x28db98d005b960ffe28bddc4fc09691cdf9be859",
                fee: 0.01
            },{ 
                coin: "btc", 
                address: "1FcB5LAGavgRUGbcEsEB4VAC4YAruLsPuz",
                fee: 0.0001
            }],
            isValid: true,
            created: Date.now(),
            modified: Date.now()
        };
   
        let client = yield ClientIdentifier.findOne({ 
             userName: _client.userName,
             site:  _client.site,
             isValid: _client.isValid
        });

        if(!client){
            client = new ClientIdentifier(_client);
        } else {
            for(let key in _client){
                client[key] = _client[key];
            }
        }
        client = yield client.save();
        clients.push(client);

        return clients;
    }
    
    * addAccount(){
        var _account = {
            site: "btctrade", //平台名称
            userName: "lcm", 
            isTest: true, //是否为测试帐户
            isValid:true, //是否有效
            isLocked: false, //是否locked

            coins: [{
                coin: "eth",
                total: 2, //总额 = 可用数 + 冻结数
                frozen: 0, //冻结
                loan: 0, //借贷
                apply: 0,
                cost: 1  //成本
            },{
                coin: "cny",
                total: 9.84
            }],
            
            created: Date.now(),
            modified: Date.now()
        };

        let account = yield Account.findOne({ userName: "lcm", site: "btctrade"});
        if(!account){
            account = new Account(_account);
        } else {
            for(let key in _account){
                account[key] = _account[key];
            }
        }
        account = yield account.save();
        return account;
    }


}();

module.exports = testUtil

