'use strict';

var config = {
    "databaseConfig": {
        "host": "localhost",
        "database": "Stock"
    },
    "test": {
        "testApp": {
            "appKey": "a",
            "appSecret": "0123456789abcdef"
        }
    },
    "security": {
        "secret": "abdssdhfhde23239jhgdffdhhfhdvvxcm.dfhdjh?fdfhjdfhjhbgb", //加密密码 
        "tkellApp": {
            "appKey": "a",
            "appSecret": "0123456789abcdef",
            "authServerUrl": "http://localhost:8001/DesktopModules/JwtAuth/API/Auth/TokenGet",
            "serverUrl": "http://localhost:8001/DesktopModules/Services/API"
        }
    },
    "platforms": [
        {
            "site": "huobi",
            "identifiers": [
                {
                    "appKey": "ff01de28-2c1edde4-1d578373-f0373",
                    "appSecret": "b7be20ee-75f30365-da5974f8-4f083"
                }
            ],
            "autoTransfer": true, //是否支持自动转币
            "symbols": [{ symbol:"btc#cny",fees: 0.0001}, { symbol: "ltc#cny",fees: 0.001 }], //支持的货币
            "restUrl": "https://api.huobi.com/apiv3",
            "isValid": false
        },
        {
            "site": "okcoin",
            "identifiers": [{
                "appKey": "a",
                "appSecret": "0123456789abcdef"
            }],
            "autoTransfer": true,
            "symbols": [{ symbol:"btc#cny",fees:0.0001 }, { symbol: "ltc#cny",fees:0.001 } ],
            "restUrl": "http://localhost:8001/DesktopModules/Services/API",
            "isValid": false
        },
        {
            //比特币交易网 btctrade.com
            "site": "btctrade",
            "identifiers": [
                {
                    "appKey": "3frrr-rpuiq-pwtxa-uxdvc-ka4p1-768gg-uiwja",
                    "appSecret": "Qq!D.-ScVC6-~n$vc-r!AAR-BQ,S9-nERf5-(/v^q"
                }
            ],
            "autoTransfer": false,
            "symbols": [{ symbol:"btc#cny",fees:0.0001 }, { symbol:"ltc#cny",fees:0.001}, { symbol:"eth#cny",fees:0.01} ], 
            "restUrl": "http://api.btctrade.com",
            "isValid": true
        },
        {
            //中国比特币 chbtc.com
            "site": "chbtc",
            "identifiers": [
                {
                    "appKey": "bda2fe0d-30f1-4e00-8d0c-bf721629b2a2",
                    "appSecret": "c0175071-bd51-45ed-a6bd-915cf61ae8ad"
                }
            ],
            "autoTransfer": true,
            "symbols": [{ symbol:"btc#cny",fees:0.0001 }, { symbol:"ltc#cny",fees:0.001}, { symbol:"eth#cny",fees:0.01} ], 
            "restUrl": "https://trade.chbtc.com/api/",
            "isValid": true
        },
        {
            //云币网 yunbi.com
            "site": "yunbi",
            "identifiers": [{
                "appKey": "Ac1OtpQRDYEb0n6iCpDq2lAbgQvepxd030w3ZpN5",
                "appSecret": "FOAaxLBuiW1icRGfzifBOOXE6Z7EFMqx6C8MCUgN"
            }],
            "autoTransfer": true,
            "symbols":[{ symbol:"btc#cny",fees:0.0001 },{ symbol:"ltc#cny",fees:0.001},{ symbol:"eth#cny",fees:0.01}], 
            "restUrl": "https://yunbi.com/",
            "isValid": true
        }
    ],
    "bcrypt": {
        "difficulty": 8
    },
    "business": {
        "natural": "cny",
        "transfer": {
            "minTradeWait" : 50 * 60 * 1000, //50分钟
            "maxTradeWait" : 5 * 60 * 60 * 1000  //5个小时
        }
    }
}

module.exports = config;

