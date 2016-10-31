'use strict';

var util = require('util');

/**
 * Really shitty way to call "super" on an error.
 * @param name {String} Name of the Error.
 * @param message {String} Message passed to Error.
 */
var superError = function(name, message){
  var error = Error.call(this, message);
  this.name = name;
  this.message = error.message;
  this.stack = error.stack;
};

/**
 * Should be thrown if the supplied expression is invalid
 * @param expression {String} Expression
 * @constructor
 */
function EvergreenConsulExpressionError(expression){
  superError.call(
    this,
    'EvergreenConsulExpressionError',
    util.format(
      'The supplied expression is invalid: %s', expression)
  );

  this.expression = expression;
}

util.inherits(EvergreenConsulExpressionError, Error);

exports.EvergreenConsulExpressionError = EvergreenConsulExpressionError;

/**
 * Should be thrown if the entity is not an official Consul entity (kv, query, catalog, etc.).
 * @param entity {String} Entity
 * @constructor
 */
function EvergreenConsulInvalidEntityTypeError(entity){
  superError.call(
    this,
    'EvergreenConsulInvalidEntityTypeError',
    util.format(
      'The supplied entity type is invalid: %s', entity)
  );

  this.entity = entity;
}

util.inherits(EvergreenConsulInvalidEntityTypeError, Error);

exports.EvergreenConsulInvalidEntityTypeError = EvergreenConsulInvalidEntityTypeError;

/**
 * Should be thrown if an error occurs communicating with Consul.
 * @param nestedError {Error} Error from the connection.
 * @constructor
 */
function EvergreenConsulConnectionFailure(nestedError){
  superError.call(
    this,
    'EvergreenConsulConnectionFailure',
    'There was an error connecting to Consul'
  );
  this.nestedError = nestedError;
}

util.inherits(EvergreenConsulConnectionFailure, Error);

exports.EvergreenConsulConnectionFailure = EvergreenConsulConnectionFailure;

/**
 * Should be thrown if an error occurs communicating with Consul.
 * @param nestedError {Error} Joi Validation Error
 * @constructor
 */
function EvergreenConsulValidationError(nestedError){
  superError.call(
    this,
    'EvergreenConsulValidationError',
    'There was an error in the options supplied with the request'
  );
  this.nestedError = nestedError;
}

util.inherits(EvergreenConsulValidationError, Error);

exports.EvergreenConsulValidationError = EvergreenConsulValidationError;