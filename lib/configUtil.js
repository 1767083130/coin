'use strict';

const config  = require('../config/customConfig');

//let SiteIdentifierQueue = []; //数据格式为{ site: "huobi",identifierIndex: 0 }

let configUtil = new class {

    getDefaultIdentifier(site){
        let platform = this._getPlatform(site);
        if(platform && platform.isValid && platform.identifiers){
            return platform.identifiers[0];
        }
    }

    getRestUrl(site){
        let platform = this._getPlatform(site);
        if(platform){
            return platform.restUrl;
        }
    }

    getSites(){
        var sites = [];
        var platforms = config.platforms;
        for(let platform of platforms){
            platform.isValid && sites.push(platform.site);
        }

        return sites;
    }

    getDefaultSite(){
        return 'huobi';
    }

    getNaturalCoin(){
        return this.getBusiness().business.natural;
    }

    getSymbols(){
        var symbols = [];
        var platforms = config.platforms;

        for(let platform of platforms){
            for(let symbolItem of platform.symbols){
                if(symbols.indexOf(symbolItem.symbol) == -1){
                    symbols.push(symbolItem.symbol);
                }
            }
        }

        return symbols;   
    }

    getWithdrawFees(symbol,site){
        var platform = this.getPlatform(site);
        let symbolItem = platform.symbols.find(function(value){
            return value.symbol == symbol;
        });

        return symbolItem.fees;
    }

    isAutoTransfer(site){
        let platform = this._getPlatform(site);
        return platform && platform.autoTransfer;
    }
    
    getBusiness(){
        return config.business;
    }

    getPlatforms(){
        let platforms = [];
        for(let item of config.platforms){
            if(item.isValid){
                platforms.push(item);
            }
        }
        return platforms;
    }

    getPlatform(site){
        let platforms = this.getPlatforms();
        return platforms.find(function(value){
            return value.site == site;
        });
    }

    getNaturalCoin(){
        return config.business.natural;
    }

    getDatabaseConfig(){
        return config.databaseConfig;
    }



    _getPlatform(site){
        let platform = config.platforms.find(function(value,index){
            return value.site == site;
        });

        return platform; 
    }

}();

module.exports = configUtil;