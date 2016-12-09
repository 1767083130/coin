'use strict';

const app = require('express')(),
    kraken = require('kraken-js'),
    options = require('./lib/spec')(app),
    nunjucks = require('nunjucks'),
    fs = require('fs'),
    join = require('path').join,
    express = require('express'),
    models = join(__dirname, 'models');

// Bootstrap models
fs.readdirSync(models)
    .filter(function(file){ 
        return ~file.search(/^[^\.].*\.js$/);
    })
    .forEach(function(file){ 
        require('./models/' + file);
    });

app.use(kraken(options));
app.use('/assets',express.static('assets'));
app.use('/assets',express.static('public'));

nunjucks.configure('./public/templates', {
    autoescape: true,
    express: app
});


app.on('start', function () {
    console.log('Application ready to serve requests.');
    console.log('Environment: %s', app.kraken.get('env:env'));
});

module.exports = app;
