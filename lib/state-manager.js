'use strict';

var util = require('util');
var lodash = require('lodash');
var EventEmitter = require('events').EventEmitter;

function StateManager(consul, context){
  EventEmitter.call(this);
  this.consul = consul;
  this.method = lodash.get(consul, context.method).bind(consul);
  this.methodContext = lodash.omit(context.options, ['mode', 'ignoreStartupNodata']);
  this.mode = context.options.mode;
  this.watch = null;
  this.value = null;
  // If there is not at least on error handler registered,
  // EventEmitter will throw an exception.
  this.on('error', function(){});
}

util.inherits(StateManager, EventEmitter);

StateManager.prototype.hasConfig = function(){
  return this.value !== null;
};

StateManager.prototype.update = function(value){
  this.value = value;
  this.emit('change', value);
};

StateManager.prototype.notifyError = function(err){
  this.emit('error', err);
};

StateManager.prototype.startWatch = function(){
  if (this.mode === 'watch'){
    this.watch = this.consul.watch(this.context);
    this.watch.on('change', this.update.bind(this));
    this.watch.on('error', this.notifyError.bind(this));
  }
};

StateManager.prototype.endWatch = function(){
  this.watch.end();
};

StateManager.prototype.refresh = function(callback){
  var manager = this;
  this.method(this.methodContext, function(err, value){
    if (err) {
      manager.notifyError(err);
    }
    else {
      manager.update(value);
    }
    if (callback instanceof Function) {
      callback(err, value);
    }
  });
};

module.exports = StateManager;
