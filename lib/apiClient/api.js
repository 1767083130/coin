'use strict';
const configUtil  = require('../configUtil');

class Api {
    constructor(identifierOrSite){
        debugger
        this.client = this._getClient(identifierOrSite);
    }

    /**
     * 获取即时价格
     * @Returns {Object}  e.g  { isSuccess: true,message: "",errorCode:
     *            result: { site:"houbi", buys: [[5,1],[4,1],[3,1],[2,1]], sells:[[10,1],[9,1],[8,1],[7,1]],symbol:"btc" } }
     */ 
    getRealPrice(symbol,callBack){
        debugger
        return this.client.getRealPrice(symbol,callBack);
    }

    /**
     * 获取每天的交易行情
     * @Returns {Object}  e.g  { isSuccess: true,message: "",errorCode:
     *            result: { site:"houbi", prices: [5,4,3,2],symbol:"btc" } }
     */ 
    getDayPrices(day,symbol){
        return this.client.getDayPrices(day,symbol);
    }

    /**
     * 挂买单
     * 
     * @param {Object} options  请求参数，如 {symbol: "btc#cny", amount: 0.1, price: 1}
     * @returns {"result":true,"id":123} id: 挂单ID; result: true(成功), false(失败)
     */
    buy(options,callBack){
        return this.client.buy(options,callBack);
    }

    /**
     * 挂卖单
     * 
     * @param {Object} options  请求参数，如 {symbol: "btc#cny", amount: 0.1, price: 1}
     * @returns {"result":true,"id":123} id: 挂单ID; result: true(成功), false(失败)
     */
    sell(options,callBack){
        return this.client.sell(options,callBack);
    }

    /**
     * 取消挂单
     * 
     * @param {Object} options 挂单ID {id: 3423423,symbol: "btc#cny"}
     * @returns {"isSuccess":true,"message":"eewew"} id: 挂单ID; result: true(成功), false(失败)
     */
    cancelOrder(options,callBack){
        return this.client.cancelOrder(options,callBack);
    }

    /**
     * 挂单查询
     * 
     * @param {Object} options  请求参数，如 {
     *    symbol: "btc#cny",  //交易币种,可为空（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
     *    type: 'open',  //  挂单类型[open:正在挂单,可为空 all:所有挂单,默认为all]
     *    pageIndex: 0,  //页数。从0开始计数
     *    pageSize: 10   //每页大小。最大数为20
     * }
     * @returns { isSuccess: true,message: "", orders: [
        outerId: "423425", //挂单ID
        consignDate: new Date(),  //挂单时间
        site: "huobi",
        tradeType: "buy",  //类型（buy, sell）
        price: 90,  //挂单价格(单位为元)
        consignAmount: 12, //挂单数量
        bargainAmount: 20, //成交数量
        status: 'canceled'  //open(开放), closed(全部成交), canceled(撤消)
       ]}
     */
    fetchOrders(options,callBack){
        /* NOTICE
         (1) 这里默认系统是每页查询20个数,如果不是,需要额外处理
         (2) 如果没有任何的历史订单,则只取两天内的
         */
        options.pageIndex = options.pageIndex || 0;
        options.pageSize = options.pageSize || 20;
        options.type = options.type || 'all';

        return this.client.fetchOrders(options,callBack);
    }

    /**
     * 获取最近的订单
     * 
     * @param {Object} options 请求参数，如 {
     *     symbol: "btc#cny",  //交易币种（btc#cny,eth#cny,ltc#cny,doge#cny,ybc#cny）
     *     since: +new Date() / 10000 | 0, //起始时间戳，since，lastOrderId必须填写一个
     *     lastOrderId: "1236549877", //最后一次同步时获取到的委托Id
     * }
     * 
     * @returns { isSuccess: true,message: "", orders: [
        outerId: "423425", //挂单ID
        consignDate: new Date(),  //挂单时间
        site: "huobi",
        tradeType: "buy",  //类型（buy, sell）
        price: 90,  //挂单价格(单位为元)
        consignAmount: 12, //挂单数量
        bargainAmount: 20, //成交数量
        status: 'canceled'  //open(开放), closed(全部成交), canceled(撤消)
       ]}
     */
    * fetchRecentOrders(options,stepCallBack){
        if(!options.since && !options.lastOrderId){
            throw new Error('参数lastTime，lastOrderId必须填写一个');
        }

        /**
         * 不同的平台实现方式不同。如果能获取到最近全部成交订单，则不需要额外实现，否则需要另外实现
         */
        if(this.client.fetchRecentOrders){
            return yield* this.client.fetchRecentOrders(options,stepCallBack);
        } else {
            let fetchOrdersOptions =  {
                symbol: options.symbol,
                pageIndex: 0,  //页数。从0开始计数
                pageSize: 100   //每页大小 //NOTICE:不同的交易网站有可能有不同的限制，这个需要格外注意
            }
            
            let res = { isSuccess: true,orders: [] };
            let isContinue = true;
            while(isContinue){
                let fetchRes = yield this.fetchOrders(fetchOrdersOptions);
                stepCallBack && stepCallBack(null,fetchRes);

                if(fetchRes.isSuccess){
                    fetchOrdersOptions.pageIndex++;
                    if(fetchRes.orders.length != fetchOrdersOptions.pageSize){
                        isContinue = false;
                    } 

                    for(let order of fetchRes.orders){
                        if( (options.lastOrderId && order.outerId == options.lastOrderId)
                            || (options.since && +order.consignDate < +options.since)){
                            isContinue = false;
                            break;
                        } else {
                            res.orders.push(order);
                        }
                    }
                } else {
                    isContinue = false;

                    res.message = fetchRes.message;
                    res.errorCode = '100005';
                    return res;
                }
            }

            return res;
        }
    }


    /**
     * 查询订单信息
     * 
     * @param {Object} options 挂单ID {id: 3423423,symbol: "btc#cny"}
     * @returns {Object} e.g. 
       { isSuccess: true, order:
       { id: 1,site: "btctrade",consignDate: '', type: 'buy',price: 12,consignAmount: 120,bargainAmount: 123,status: '状态：open(开放), closed(结束), cancelled(撤消)' } }
     */
    fetchOrder(options,callBack){
        return this.client.fetchOrder(options,callBack);
    }


    /**
     * 获取账户信息
     * 
     * @returns e.g.
     * { isSuccess:true, account: { site: Site_Name,
     *     coins: [{symbol: "btc",
     *     total: 1, //总额  = 可用数 + 冻结数
     *     frozen: 1,//冻结数
     *     apply: 1 }] }  //申请数
     */
    getAccountInfo(callBack){
        return this.client.getAccountInfo(callBack);
    }

    /**
     * 提币或提现
     * 
     * @param {Object} options  请求参数，如 { coin: "btc", amount: 12,fees： 0.01,safePassword:'1234po4', address: "a213we234234sdfsdwer324"}
     * @returns {isSuccess:true,outerId:123} outerId: 挂单ID; result: true(成功), false(失败)
     */
    withdraw(options,callBack){ 
        return this.client.withdraw(options,callBack);
    }

    /**
     * 取消提币或提现
     * 
     * @param {Object} options  请求参数，如 { coin: "btc", outerId: "3242334", safePassword:'1234po4'}
     * @returns {isSuccess:true}  result: true(成功), false(失败)
     */
    cancelWithdraw(options,callBack){
        return this.client.cancelWithdraw(options,callBack);
    }   
    
    _getClient(identifierOrSite){
        let identifier,site;
        if(typeof identifierOrSite == 'string'){
            site = identifierOrSite;
            identifier = configUtil.getDefaultIdentifier(identifierOrSite);
        }else{
            identifier = identifierOrSite;
            site = identifier.site;
        }

        if(!identifier){
            return null;
        }

        let Client = require(`./platforms/${site}/api`);
        return new Client(identifier);
    }
}

module.exports = Api
