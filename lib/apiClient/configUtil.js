'use strict';

const config  = require('../../config/customConfig');

//let SiteIdentifierQueue = []; //数据格式为{ site: "huobi",identifierIndex: 0 }

let configUtil = new class {

    getDefaultIdentifier(site){
        let platform = this.getPlatform(site);
        return platform.identifiers[0];
    }

    getRestUrl(site){
        let platform = this.getPlatform(site);
        return platform.restUrl;
    }

    getPlatform(site){
        let platform = config.platforms.find(function(value,index){
            return value.site == site;
        });

        return platform.restUrl;
    }
}();

module.exports.configUtil = configUtil;