'use strict';

var ConsulDirective = require('./lib/directive');

/**
 * Evergreen Module Declaration syntax
 * @type {{directives: Array}}
 */
module.exports = {
  directives: [ new ConsulDirective() ]
};