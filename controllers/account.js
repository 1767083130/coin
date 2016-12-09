'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Account = mongoose.model('Account');
const ClientIdentifier  = mongoose.model('ClientIdentifier');
const TransferStrategy = mongoose.model('TransferStrategy');
const Strategy = mongoose.model('Strategy');

const async = require('co').wrap;
const only = require('only');
const accountLib = require('../lib/account');
const configUtil = require('../lib/configUtil');
const Decimal = require('decimal.js');

module.exports = function (router) {
    //router.get('/', account.index_api);
  
    router.get('/', async(function* (req, res) {
        let userName = req.user.userName;
        let accounts = yield Account.getUserAccounts(userName);
        let clients = yield ClientIdentifier.getUserClients(userName);

        let business = configUtil.getBusiness();
        business.sites = configUtil.getSites();
        business.symbols = configUtil.getSymbols();

        for(let account of accounts){
            for(let coin of account.coins){
                coin.available = new Decimal(coin.total).minus(coin.total,coin.frozen).toNumber();
            }
        }

        // var clientId = clients[0]._id;
        // var timeStamp = clientId.getTimestamp();
        // var id= mongoose.Types.ObjectId(clientId.toString());
        res.render('account', {
            userName: userName,
            business: JSON.stringify(business),
            accounts: JSON.stringify(accounts || []),
            clients: JSON.stringify(clients || [])
        });
    }));

    router.post('/syncAccounts', async(function* (req, res) {
        let sites = req.body.sites;
        let userName = req.user.userName;
        let accounts = yield* accountLib.syncUserAccounts(sites,userName);

        let syncRes;
        if(accounts.length == 0){
            syncRes = { isSuccess: false,message: "失败!" };
        } else {
            syncRes = { isSuccess: true };
        }
        res.json(syncRes);
    }));

    router.get('/getAccounts', async(function* (req, res) {
        if(!req.user){
            return res.status(403).redirect('/login');
        }

        let userName = req.user.userName;
        let accounts = yield Account.getUserAccounts(userName);

        res.json({ isSuccess: true,accounts: accounts });
    }));

    router.post('/saveTransferStrategy', async(function* (req, res) {
        let transferStrategy = yield TransferStrategy.findOne({ userName: req.user.userName });
        if(!transferStrategy){
            transferStrategy = new TransferStrategy();
        }
        
        
        transferStrategy.userName = req.user.userName;
        //stransferStrategy = req.body.transferStrategy || {};
        Object.assign(transferStrategy,req.body.transferStrategy);
        transferStrategy = yield transferStrategy.save();

        res.json({ isSuccess: true,transferStrategy: transferStrategy });
    }));


    router.post('/updateClient', async(function* (req, res) {
        if(!req.body.site){
            return res.json({ isSuccess: false,message: "参数site不能为空" });
        }
  
        let userName = req.user.userName;
        let client = yield ClientIdentifier.findOne({site: req.body.site, userName: userName });
        if(!client){
            client = new ClientIdentifier();
        }
        client.userName = userName;

        Object.assign(client,only(req.body,'site appKey appSecret'));
        client = yield client.save();

        res.json({ isSuccess: true,client: client });
    }));

    router.post('/toggleClientValid', async(function* (req, res) {
        if(!req.body.site){
            return res.json({ isSuccess: false });
        }

        let userName = req.user.userName;
        let client = yield ClientIdentifier.findOne({site: req.body.site, userName: userName });
        if(client){
            client.isValid = !client.isValid;
        }

        res.json({ isSuccess: true });
    }));


    router.post('/saveCoinAddress', async(function* (req, res) {
        let address = req.body.address;
        if(!address || !address.site || !address.coin){
            return res.json({ isSuccess: false });
        }

        let userName = req.user.userName;
        let client = yield ClientIdentifier.findOne({site: address.site, userName: userName });
        if(!client){
            client = new ClientIdentifier({ userName: userName, site: address.site });
        }

        let addresses = client.coinAddresses || [];
        let coinAddress = addresses.find(function(item){
            return item.coin == address.coin;
        });
    
        if(!coinAddress){
            coinAddress = {
                coin: address.coin,
                address: address.address,
                fee: address.fee
            };
            addresses.push(coinAddress);
        } else {
            coinAddress.coin = address.coin;
            coinAddress.address = address.address;
            coinAddress.fee = address.fee;
        }
        
        client = yield client.save();
        res.json({ isSuccess: client ? true : false });
    }));

    router.post('/deleteCoinAddress', async(function* (req, res) {
        if(!req.body.address){
            return res.json({ isSuccess: false });
        }

        let userName = req.user.userName;
        let address = req.body.address;
        if(!address || !userName){
            return res.json({ isSuccess: false });
        }

        let client = yield ClientIdentifier.findOne({site: address.site, userName: userName });
        if(!client){
            return res.json({ isSuccess: false });
        }

        let addresses = client.coinAddresses || [];
        let index = addresses.findIndex(function(item){
            return item.coin == address.coin;
        });

        if(index != -1){
            client.coinAddresses.splice(index,1);
        }

        client = yield client.save();
        res.json({ isSuccess: client ? true : false });
    }));
}

