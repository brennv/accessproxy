#!/usr/bin/env node

'use strict';

var fs = require('fs'),
    path = require('path'),
    https = require('https'),
    httpProxy = require('http-proxy'),
    program = require('commander'),
    prompt = require('prompt'),
    version = require('./package.json').version;

program
    .version(version)
    .option('-l, --listen <n>', 'Listen', parseInt)
    .option('-t, --target <n>', 'Target', parseInt)
    .option('-r, --remove', 'Remove')
    .parse(process.argv);


var listenport = program.listen || 1337,
    targetport = program.target || 9000,
    ciServer;

var proxy = httpProxy.createProxyServer({});

// Cached regex(s)
var labsRegex = /(^prod\.foo\.redhat\.com)/,
    labsCiRegex = /(^foo\.redhat\.com)/,
    rewriteRegex = /^\/(chrome_themes|webassets|services).*/;

// Prevent proxy from bombing out
proxy.on('error', function() {});

var currentDir = path.join(path.dirname(fs.realpathSync(__filename)), '.');

function initServer() {
    var server = https.createServer({
        key: fs.readFileSync(currentDir + '/key.pem'),
        cert: fs.readFileSync(currentDir + '/cert.pem'),
    }, function(req, res) {
        var host = req.headers.host,
            url = req.url;
        var loopback = 'http://localhost:' + targetport;
        var options = {
            target: loopback,
            secure: false,
            prependPath: false
        };

        if (rewriteRegex.test(url)) {
            var target;
            if (labsRegex.test(host)) {
                target = 'access.redhat.com';
            } else if (labsCiRegex.test(host)) {
                target = ciServer;
            }
            if (target) {
                // Does not seem like I should be able to do this...
                req.headers.host = target;
                options.target = 'https://' + target;
            }
        }
        proxy.web(req, res, options);
    });

    console.log('proxy listening on port ' + listenport);
    console.log('proxy redirecting to port ' + targetport);
    server.listen(listenport);
}
var labsCiLocation = process.env.HOME + '/.accesslabsci';
if (program.remove) {
    try {
        fs.unlinkSync(labsCiLocation);
        console.log('Removed labsci file');
    } catch (e) {
        console.log('Errored removing labsci file. Did it exist?');
    } finally {
        process.exit(0);
    }
}

try {
    ciServer = fs.readFileSync(labsCiLocation) + '';
    initServer();
} catch (e) {
    prompt.message = 'Yo! Couldn\'t find a ci server to point to...'.white;
    prompt.delimiter = '><'.green;
    prompt.start();

    prompt.get({
        properties: {
            labsci: {
                description: 'Where should I point?'.magenta
            }
        }
    }, function(err, result) {
        if (result && result.labsci) {
            console.log('Pointing at: '.cyan + result.labsci.cyan);
            fs.writeFileSync(labsCiLocation, result.labsci);
            ciServer = result.labsci;
            initServer();
        }
    });
}
