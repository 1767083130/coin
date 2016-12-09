var socketPush1 = require('./socketClient1');
var socketPush = require('./socketClient');

socketPush.connect();
var g_checkTimerEvent = setInterval(socketPush.checkConnection,
            5000);

socketPush1.connect();
g_checkTimerEvent = setInterval(socketPush1.checkConnection,
            5000);

