﻿'use strict';

const methodReg = /(min|max|between)\((.*)\)/i;

class MethodsRunner{

    constructor(options){
        var _defaultOptions = {
            getVarValueMethod: null,
            env: {}
        };
        this.options = Object.assign({}, _defaultOptions,options);
    }
    
    /**
     * 执行函数，返回函数运行返回的结果
     *
     * @param {String} express,表达式.e.g. min(min(3,5),max(54,89))
     * @param {Function} fun,计算变量值的方法
     * @returns {Object} 函数运行返回的结果. e.g. 3
     * @api public 
     */
    * calculate(express) {
        if(!express || typeof express != 'string'){
            return express;
        }
        express = express.toString().toLowerCase();

        //进行函数计算
        var matches = express.match(methodReg);
        if (matches && matches.index != -1) { //表达式为函数
            var funName = matches[1];
            var funArgsExpress = matches[2];

            var stack = [],
                splits = [], //函数参数的分割位置
                funArgs = [], //参数
                funArgValues = []; //参数值

            //取得函数参数的分割位置
            for (var i = 0; i < funArgsExpress.length; i++) { 
                var char = funArgsExpress[i];
                if (char == '(') {
                    stack.push(char);
                } else if (char == ')') {
                    stack.pop();
                } else if (char == ',') {
                    if (stack.length == 0) {
                        splits.push(i);
                    }
                }
            }

            var lastIndex = 0, start = 0;
            for (var j = 0; j < splits.length; j++) {
                start = (j == 0 ? lastIndex : lastIndex + 1);
                funArgs.push(funArgsExpress.substring(start, splits[j]));
                lastIndex = splits[j];
            }
            start = (lastIndex == 0 ? lastIndex : lastIndex + 1);

            let arg = funArgsExpress.substring(start, funArgsExpress.length);
            funArgs.push(arg.trim());

            for (var m = 0; m < funArgs.length; m++) {
                var funArg = funArgs[m];
                var res =  yield* this.calculateItem(funArg);
                funArgValues.push(res);
            }

            return yield* eval('this.' + funName + '(' + funArgValues.join(',') + ')');

        } else {
            return express;
        }
    }

    /**
     * 判断是否为函数
     *
     * @param {String} express,表达式.e.g. min(min(3,5),max(54,89))
     * @returns {Boolean} 
     * @api public
     */
    static isMethod(express) {
        if(!express){
            return false;
        }
        
        let str = express.toString();
        var matches = str.match(methodReg);
        return matches && matches.index != -1;
    }


    /**
     * min函数，返回参数中的最小数
     *
     * @api private
     */
    * min(){
        // var args = [];
        // for(var i = 0; i < arguments.length; i++){
        //     var argValue = yield* this.calculateItem(arguments[i]);
        //     args.push(argValue);
        // }

        return Math.min.apply(null,arguments);
    }

    /**
     * max函数，返回参数中的最大数
     *
     * @api private
     */
    * max(){
        // var args = [];
        // for(var i = 0; i < arguments.length; i++){
        //     var argValue = yield* this.calculateItem(arguments[i]);
        //     args.push(argValue);
        // }
        return Math.max.apply(null,arguments);
    }

    /**
     * between函数，判断第一个参数的值是否位于后面两个参数的值之间
     *
     * @api private
     */
    * between(){
        if(arguments.length < 3){
            return false;
        }

        // var argVal = yield* this.calculateItem(arguments[0]); 
        // var argVal1 = yield* this.calculateItem(arguments[1]); 
        // var argVal2 = yield* this.calculateItem(arguments[2]); 
        let argVal = arguments[0],
            argVal1 = arguments[1],
            argVal2 = arguments[2];
        return (argVal >= argVal1 && argVal <= argVal2);
    }

    /**
     * 获取表达式的值
     */
    * calculateItem(expressionItem){
        let res;
        if(MethodsRunner.isMethod(expressionItem)){
            res = yield* this.calculate(expressionItem);
        } else {
            var fun = this.options.getVarValueMethod;
            var env = this.options.env;

            res = fun ? yield* fun(expressionItem,env) : expressionItem;
        }

        return res;
    }
}

module.exports = MethodsRunner