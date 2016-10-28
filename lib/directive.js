'use strict';

var _ = require('lodash'),
    errors = require('./errors'),
    consul = require('consul'),
    URL = require('url'),
    querystring = require('querystring'),
    EvergreenConsulExpressionError = errors.EvergreenConsulExpressionError,
    EvergreenConsulInvalidEntityTypeError = errors.EvergreenConsulInvalidEntityTypeError;

/**
 * Initialize the ConsulDirective.
 *
 * Usage in the template:
 *
 *   $consul:<entity-type>?<options>
 *
 *   Where <entity-type> represents an aspect of Consul:
 *    - acl.get | acl
 *    - acl.list | acls
 *    - agent.members | members
 *    - agent.self | self
 *    - agent.check.list | agent.checks
 *    - agent.service.list | agent.services
 *    - catalog.datacenters | datacenters
 *    - catalog.node.list | node.list | nodes
 *    - catalog.node.services | node.services
 *    - catalog.service.list | service.list | services
 *    - catalog.service.nodes | service.nodes
 *    - event.list | events
 *    - health.node
 *    - health.checks
 *    - health.service
 *    - health.state
 *    - kv.get | kv
 *    - kv.keys | keys
 *    - session.get | session
 *    - session.node
 *    - session.list | sessions
 *    - status.leader | leader
 *    - status.peers | peers
 *
 *   And general <options> provided by the node-consul library:
 *    - dc (String, optional): datacenter (defaults to local for agent)
 *    - wan (Boolean, default: false): return WAN members instead of LAN members
 *    - consistent (Boolean, default: false): require strong consistency
 *    - stale (Boolean, default: false): use whatever is available, can be arbitrarily stale
 *    - index (String, optional): used with ModifyIndex to block and wait for changes
 *    - wait (String, optional): limit how long to wait for changes (ex: 5m), used with index
 *    - token (String, optional): ACL token
 *
 *   And specific <options> depending on the operation (see node-consul documentation;
 *   the values are passed through).
 *
 * Note:  options.token will override the token passed in via EV_CONSUL_URI (if present).
 *
 * Example:
 *
 *   // Get a Consul Key Value pair.
 *   $consul:kv?key=environments/{{env.DEPLOY_ENV}}/services/email
 *   $consul:catalog?service={{services.email}}
 *
 * @param config {{ uri: {String} }} optional configuration.
 *               If the 'uri' is not specified, then the environment variable will be used.  If the
 *               environment variable is not present, it will default to localhost:8500.
 * @param env {Object} Environment - used for testing without having to set environment variables.
 * @constructor
 */
function ConsulDirective(config, env){

  env = env || process.env;

  if (_.isUndefined(config) || _.isNull(config)){

    var uriString = env[ConsulDirective.EnvironmentKey] || 'http://localhost:8500',
        parsedUrl = URL.parse(uriString, true);

    config = {};

    _.forOwn(parsedUrl.query, function(value, key){
      config[key] = ConsulDirective.tryParse(value);
    });

    config.host = parsedUrl.hostname;
    config.port = ConsulDirective.tryParse(parsedUrl.port) || 80; //Assuming HTTP conventions here.
    config.secure = parsedUrl.protocol === 'https:';
  }

  this.config = config;

  this.consul = consul(this.config);

  this.methods = {
    'acl.get': this.consul.acl.get,
    'acl': this.consul.acl.get,
    'acl.list': this.consul.acl.list,
    'acls': this.consul.acl.list,
    'agent.members': this.consul.agent.members,
    'members': this.consul.agent.members,
    'agent.self': this.consul.agent.self,
    'self': this.consul.agent.self,
    'agent.check.list': this.consul.agent.check.list,
    'agent.checks': this.consul.agent.checks,
    'agent.service.list': this.consul.agent.service.list,
    'agent.services': this.consul.agent.service.list,
    'catalog.datacenters': this.consul.catalog.datacenters,
    'datacenters': this.consul.catalog.datacenters,
    'catalog.node.list': this.consul.catalog.node.list,
    'node.list': this.consul.catalog.node.list,
    'nodes': this.consul.catalog.node.list,
    'catalog.node.services': this.consul.catalog.node.services,
    'node.services': this.consul.catalog.node.services,
    'catalog.service.list': this.consul.catalog.service.list,
    'service.list': this.consul.catalog.service.list,
    'services': this.consul.catalog.service.list,
    'catalog.service.nodes': this.consul.catalog.service.nodes,
    'service.nodes': this.consul.catalog.service.nodes,
    'event.list': this.consul.event.list,
    'events': this.consul.event.list,
    'health.node': this.consul.health.node,
    'health.checks': this.consul.health.checks,
    'health.service': this.consul.health.service,
    'health.state': this.consul.health.state,
    'kv.get': this.consul.kv.get,
    'kv': this.consul.kv.get,
    'kv.keys': this.consul.kv.keys,
    'keys': this.consul.kv.keys,
    'session.get': this.consul.session.get,
    'session': this.consul.session.get,
    'session.node': this.consul.session.node,
    'session.list': this.consul.session.list,
    'sessions': this.consul.session.list,
    'status.leader': this.consul.status.leader,
    'leader': this.consul.status.leader,
    'status.peers': this.consul.status.peers,
    'peers': this.consul.status.peers,
  };
}

/**
 * The environment key for ConsulDirective.
 * @type {string}
 * @private
 */
ConsulDirective.EnvironmentKey = 'EV_CONSUL_URI';

/**
 * Try parsing the value or return the value
 * @param value {String}
 * @returns {*}
 */
ConsulDirective.tryParse = function(value){
  if (_.isNull(value) || _.isUndefined(value)) return null;
  try {
    value = JSON.parse(value);
    return value;
  }
  catch (e){
    return value;
  }
};

/**
 * Parse the supplied expression into a request that can be made to
 * Consul.
 * @param expression {string} The configuration expression (minus the strategy)
 *   e.g. kv?key=environments/blue/services/email
 * @returns {{ method: {Function}, options: {Object} }}
 * @throw EvergreenConsulExpressionError if the expression can't be parsed.
 * @throw EvergreenConsulInvalidEntityTypeError the method/entity is not in the
 *   list of methods (above).
 */
ConsulDirective.prototype.parseExpression = function(expression){
  var method = expression, options = '';

  if (expression.indexOf('?') > 1){
    // Cut the expression.
    try {
      method = expression.slice(0, expression.indexOf('?'));
      options = expression.slice(expression.indexOf('?') + 1);
    }
    catch (e){
      throw new EvergreenConsulExpressionError(expression);
    }
  }
  
  if (!this.methods.hasOwnProperty(method)){
    throw new EvergreenConsulInvalidEntityTypeError(method);
  }
  else {
    method = this.methods[method];
  }

  if (options){
    options = querystring.parse(options);
  }
  else {
    options = {};
  } 

  return { method: method, options: options };
};

/**
 * The name of the strategy.  This is also the directive prefix.
 * @type {string}
 */
ConsulDirective.prototype.strategy = 'consul';

/**
 * Handle the expression.
 * @param context {DirectiveContext} Evergreen directive context
 * @param _tree {Object} tree (not used)
 * @param _metadata {Object} metadata about the tree (not used)
 * @param callback {Function}
 */
ConsulDirective.prototype.handle = function(context, _tree, _metadata, callback){

  var me = this, parsed = null;

  try {
    parsed = me.parseExpression(context.expression);
  }
  catch (e){
    return callback(e);
  }
  console.log(parsed);
};

module.exports = ConsulDirective;