'use strict';
const mongoose = require('mongoose');

var db = function(){
    return {
        config: function(conf){
            mongoose.Promise = global.Promise;
            mongoose.connect('mongodb://' + conf.host + '/' + conf.database);
            var db = mongoose.connection;
            db.on('error',console.error.bind(console,'connection error:'));
            db.once('open',function callback(){
                console.log('db connection open');
            });
        }
    };
};
module.exports = db();