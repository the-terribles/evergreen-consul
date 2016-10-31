'use strict';

var lodash = require('lodash'),
    errors = require('./errors'),
    consul = require('consul'),
    URL = require('url'),
    Joi = require('joi'),
    querystring = require('querystring'),
    BaseOptions = require('./base-options'),
    StateManager = require('./state-manager'),
    EvergreenConsulExpressionError = errors.EvergreenConsulExpressionError,
    EvergreenConsulInvalidEntityTypeError = errors.EvergreenConsulInvalidEntityTypeError,
    EvergreenConsulConnectionFailure = errors.EvergreenConsulConnectionFailure,
    EvergreenConsulValidationError = errors.EvergreenConsulValidationError;

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
 *   And Evergreen-specific options:
 *    - mode (String, default: 'once'): How should the value be returned?
 *      * once: Look up the value once and return that value as the value of the expression.
 *      * watch: Continuously watch for changes and update the configuration.
 *    - ignoreStartupNodata (Boolean, default: false): If the directive is unable to 
 *        pull data from Consul, should the failure be ignored? (TRUE) Or should it cause
 *        startup to fail (FALSE)?
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
 * @param _consul {Object} Replace the consul instance when testing.
 * @constructor
 */
function ConsulDirective(config, env, _consul){

  env = env || process.env;

  if (lodash.isUndefined(config) || lodash.isNull(config)){

    var uriString = env[ConsulDirective.EnvironmentKey] || 'http://localhost:8500',
        parsedUrl = URL.parse(uriString, true);

    config = {};

    lodash.forOwn(parsedUrl.query, function(value, key){
      config[key] = ConsulDirective.tryParse(value);
    });

    config.host = parsedUrl.hostname;
    config.port = ConsulDirective.tryParse(parsedUrl.port) || 80; //Assuming HTTP conventions here.
    config.secure = parsedUrl.protocol === 'https:';
  }

  this.config = config;

  this.consul = _consul || consul(this.config);

  this.methods = {
    'acl.get': {
      aliases: ['acl'],
      options: BaseOptions.keys({
        id: Joi.string().required(),
      }),
    },
    'acl.list': {
      aliases: ['acls'],
      options: BaseOptions,
    },
    'agent.members': {
      aliases: ['members'],
      options: BaseOptions,
    },
    'agent.self': {
      aliases: ['self'],
      options: BaseOptions,
    },
    'agent.check.list': {
      aliases: ['agent.checks'],
      options: BaseOptions,
    },
    'agent.service.list': {
      aliases: ['agent.services'],
      options: BaseOptions,
    },
    'catalog.datacenters': {
      aliases: ['datacenters'],
      options: BaseOptions,
    },
    'catalog.node.list': {
      aliases: ['node.list', 'nodes'],
      options: BaseOptions,
    },
    'catalog.node.services': {
      aliases: ['node.services'],
      options: BaseOptions.keys({
        node: Joi.string().required(),
      }),
    },
    'catalog.service.list': {
      aliases: ['service.list', 'services'],
      options: BaseOptions,
    },
    'catalog.service.nodes': {
      aliases: ['services.nodes'],
      options: BaseOptions.keys({
        service: Joi.string().required(),
        tag: Joi.string(),
      }),
    },
    'event.list': {
      aliases: ['events'],
      options: BaseOptions.keys({
        name: Joi.string(),
      }),
    },
    'health.node': {
      aliases: [],
      options: BaseOptions.keys({
        node: Joi.string().required(),
      }),
    },
    'health.checks': {
      aliases: [],
      options: BaseOptions.keys({
        service: Joi.string().required(),
      }),
    },
    'health.service': {
      aliases: [],
      options: BaseOptions.keys({
        service: Joi.string().required(),
        tag: Joi.string(),
        passing: Joi.boolean(),
      }),
    },
    'health.state': {
      aliases: [],
      options: BaseOptions.keys({
        state: Joi.string().valid('any', 'passing', 'warning', 'critical').required(),
      }),
    },
    'kv.get': {
      aliases: ['kv'],
      options: BaseOptions.keys({
        key: Joi.string().required(),
        recurse: Joi.boolean(),
        raw: Joi.boolean(),
        buffer: Joi.boolean(),
      }),
    },
    'kv.keys': {
      aliases: ['keys'],
      options: BaseOptions.keys({
        key: Joi.string().required(),
        separator: Joi.string(),
      }),
    },
    'query.list': {
      aliases: ['query'],
      options: BaseOptions,
    },
    'query.get': {
      aliases: [],
      options: BaseOptions.keys({
        query: Joi.string().required(),
      }),
    },
    'query.execute': {
      aliases: ['query'],
      options: BaseOptions.keys({
        query: Joi.string().required(),
      }),
    },
    'query.explain': {
      aliases: [],
      options: BaseOptions.keys({
        query: Joi.string().required(),
      }),
    },
    'session.get': {
      aliases: ['session'],
      options: BaseOptions.keys({
        id: Joi.string().required(),
      }),
    },
    'session.node': {
      aliases: [],
      options: BaseOptions.keys({
        node: Joi.string().required(),
      }),
    },
    'session.list': {
      aliases: ['sessions'],
      options: BaseOptions,
    },
    'status.leader': {
      aliases: ['leader'],
      options: BaseOptions,
    },
    'status.peers': {
      aliases: ['peers'],
      options: BaseOptions,
    },
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
  if (lodash.isNull(value) || lodash.isUndefined(value)) return null;
  try {
    value = JSON.parse(value);
    return value;
  }
  catch (e){
    return value;
  }
};

/**
 * Get the Consul method and configuration.
 * @param methodName {string} Name of the method
 * @returns {null|{method: {string}, config: {Object}}}
 */
ConsulDirective.prototype.getMethod = function(methodName){
  var methodConfig = { method: null };
  lodash.forOwn(this.methods, function(config, key){
    if (methodName === key || config.aliases.indexOf(methodName) >= 0) {
      methodConfig.options = config.options;
      methodConfig.method = key;
    }
  });
  return methodConfig;
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
  var methodName = expression, options = '';

  if (expression.indexOf('?') > 1){
    // Cut the expression.
    try {
      methodName = expression.slice(0, expression.indexOf('?'));
      options = expression.slice(expression.indexOf('?') + 1);
    }
    catch (e){
      throw new EvergreenConsulExpressionError(expression);
    }
  }

  var methodConfig = this.getMethod(methodName);
  
  if (methodConfig.method === null){
    throw new EvergreenConsulInvalidEntityTypeError(methodName);
  }

  if (options){
    options = querystring.parse(options);
  }
  else {
    options = {};
  } 

  var validationResults = Joi.validate(options, methodConfig.options);

  if (validationResults.error){
    throw new EvergreenConsulValidationError(validationResults.error);
  }

  return { method: methodConfig.method, options: validationResults.value };
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

  var me = this, consulContext = null;

  try {
    consulContext = me.parseExpression(context.expression);
  }
  catch (e){
    return callback(e);
  }

  var ignoreStartupNoData = consulContext.options.ignoreStartupNodata;

  var stateManager = new StateManager(this.consul, consulContext);
  
  stateManager.refresh(function(err, data){
    if (err && !ignoreStartupNoData) {
      return callback(new EvergreenConsulConnectionFailure(err));
    }
    // Watching will only occur if "mode=watch".
    stateManager.startWatch();

    return callback(null, context.resolve(stateManager));
  });
};

module.exports = ConsulDirective;