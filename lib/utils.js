'use strict';
var options = require('./options');
var regexes = require('./regexes');

exports.serverMap = function(host) {
    var servers = options.get('servers');
    if (regexes.prodRegex.test(host)) {
        return servers.prod;
    } else if (regexes.ciRegex.test(host)) {
        return servers.ci;
    }
    // TODO: QA & Stage
};