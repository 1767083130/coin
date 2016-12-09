'use strict';

class ApiBase{

    getRealPrice(symbol,callBack){
        var siteName = this.getSiteName();
        var buys = [96,95,94,93];
        var sells = [100,99,98,97];
        let detail = {
            time: Date.now(),
            site: siteName,  

            buys: buys, //买10 //{ amount: Number,level:Number,price:Number } //买方深度
            sells: sells, //卖10 //{ amount: Number,level:Number,price:Number }  //asks :卖方深度
            symbol: symbol //类型;
        };

        let res = {
            isSuccess: true,
            realPrices: detail
        };

        if(callBack){
            callBack(null,res);
        } else {
            var promise = new Promise(function(resolve, reject) {
                resolve(res);
            });

            return promise;
        }
    }

    sortRealPrices(realPrices){
        realPrices.buys.sort(function(a,b){
            return b[0] - a[0];
        });
        realPrices.sells.sort(function(a,b){
            return a[0] - b[0];
        });
    }

    //mergeItems([0.25,0.26,0.36],{ direction: "down",deep: 0.1}) //=> [0.2,0.3]
    static mergeItems(items, options) { //options: {direction: "up/down", deep: "1/0.1/0.01"}
        var defaults = {
            direction: "up",
            deep: "1"
        };
        var args = Object.assign({}, defaults, options);
        var deep = parseFloat(args.deep);
        if (isNaN(deep) || !isFinite(deep)) {
            throw new Error('参数deep必须为数字');
        }

        if (1 / deep != parseInt(1 / deep)) {
            throw new Error('参数deep必须为类似0.1,0.01的数字');
        }
        args.deep = deep;

        if (['up', 'down'].indexOf(args.direction) == -1) {
            throw new Error('参数direction必须为up或down');
        }
        
        var merged = [];
        items.sort(function (a, b) {
            return a.price - b.price;
        });//先排序

        var last;
        for (var i = 0; i < items.length; i++) {
            var newItem = Object.assign({},items[i]);
            var price = this.mergeItem(items[i].price, options);
            newItem.price = price;

            if (newItem.price != last.price) {
                merged.push(newItem);
            }else {
                last.amount += newItem.amount;
            }
            last = newItem;
        }

        return merged;
    }

    isNumeric(val){
        let num = parseFloat(val);
        if(!isNaN(num) && isFinite(num)){
            return true;
        }

        return false;
    }

    
    //mergeItem(0.25,{ direction: "down",deep: 0.1}); //=> 0.2
    //mergeItem(0.25,{ direction: "up",deep: 0.1}); //=> 0.3
    //mergeItem(0.25,{ direction: "down",deep: 0.01}); //=> 0.25
    static mergeItem(item, args) {
        var newItem;
        var blowup = item * (1 / args.deep);
        if (args.direction == 'up') {
            newItem = Math.ceil(blowup) / (1 / args.deep);
        }
        else { //down
            newItem = Math.floor(blowup) / (1 / args.deep);
        }

        return newItem;
    }


}


module.exports = ApiBase;


