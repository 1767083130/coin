/**
 * A model for our account
 */
'use strict';
const mongoose = require('mongoose');

var dayPriceModel = function () {
    const DayPriceSchema = mongoose.Schema({
        date: { type : Date, require: true }, //交易日期
        site: { type: String },  //平台代号
        startPrice: { num: Number,price: Number },  //开盘价
        endPrice: { num: Number,price: Number },  //收盘价
        highPrice: { num: Number,price: Number }, //最高价
        lowPrice: { num: Number,price: Number }, //最低价
        newPrice: { num: Number,price: Number }, //最新
        totalNum: Number,  //成交量
        level: Number,//涨幅
        totalAmount: Number, //成交金额
        created: { type: Date, "default": Date.now() }, //创建日期
        symbol: String //货币类型
    });

     /**
     * Methods
     */
    DayPriceSchema.methods = {
    }
    
    /**
     * Statics
     */

    DayPriceSchema.statics = {

        /**
        * Find article by id
        *
        * @param {ObjectId} id
        * @api private
        */
        load: function (_id) {
            return this.findOne({ _id })
                .exec();
        },
        getFirstDayPrice: function(_id){
            return this.findOne({ _id }) //todo
                .exec();
        }

    };

    return mongoose.model('DayPrice', DayPriceSchema);
};

module.exports = new dayPriceModel();
