'use strict';

const account = require('./account');
const login = require('./login');

module.exports = function (router) {
    
    router.get('/', account.index_api);
    login(router);


    router.get('/test', function(req,res){
        res.write('sdfsdfsdfd');
        res.end();
    });

    router.get('/profile', function(req, res) {
        res.render('profile', { user: req.user });
    });

    router.get('/admin', function(req, res) {
        res.render('admin', {});
    });

    //Allow the users to log out 
    router.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/login');
    });

    //帐户
    router.post('/account/syncAccounts', account.syncAccounts_api);
    router.get('/account/getAccounts', account.getAccounts_api);
    router.get('/account/updateStrategy', account.updateStrategy_api);
    router.get('/account/updateClient', account.updateClient_api);
    router.get('/account/stopClient', account.stopClient_api);

};


