'use strict';

var chai = require('chai'),
  expect = chai.expect,
  util = require('util'),
  lodash = require('lodash'),
  errors = require('../lib/errors'),
  DirectiveContext = require('trbl-evergreen/lib/directive-context.js'),
  TestUtils = require('trbl-evergreen/test/utils.js'),
  ConsulDirective = require('../lib/directive');

describe('Consul Source Directive', function() {

  describe('Configuration', function(){

    it('should configure itself from environment variable.', function(){

      var directive = new ConsulDirective(null, {
        EV_CONSUL_URI: 'https://consul.the-trbl.com:18500?dc=us-east-1&consistent=true&token=abc123'
      });

      expect(directive.config.host).to.eq('consul.the-trbl.com');
      expect(directive.config.port).to.eq(18500);
      expect(directive.config.secure).to.be.true;
      expect(directive.config.dc).to.eq('us-east-1');
      expect(directive.config.consistent).to.be.true;
      expect(directive.config.token).to.eq('abc123');

    });

    it('should configure itself from a configuration object', function(){

      var directive = new ConsulDirective({
        host: 'consul2.the-trbl.com',
        port: 18600,
        secure: false,
        dc: 'us-west-2',
        consistent: false,
        token: '123abc'
      });

      expect(directive.config.host).to.eq('consul2.the-trbl.com');
      expect(directive.config.port).to.eq(18600);
      expect(directive.config.secure).to.be.false;
      expect(directive.config.dc).to.eq('us-west-2');
      expect(directive.config.consistent).to.be.false;
      expect(directive.config.token).to.eq('123abc');

    });

    it('should provide a sensible default configuration', function(){

      var directive = new ConsulDirective();

      expect(directive.config.host).to.eq('localhost');
      expect(directive.config.port).to.eq(8500);
      expect(directive.config.secure).to.be.false;

    });
  });

  describe('Expression Parsing', function(){

    var consulDirective = new ConsulDirective();

    it('should throw an error if the entity/method is invalid', function(){
      expect(function(){ consulDirective.parseExpression('acl.list'); }).to.not.throw(Error);
      expect(function(){ 
        consulDirective.parseExpression('acl.get?id=abc123');
      }).to.not.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah'); }).to.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah.blah'); }).to.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah?foo=bar'); }).to.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah.blah?foo=bar'); }).to.throw(Error);
    });

    it('should return a method and parsed options', function(){
      var context = consulDirective.parseExpression('acl.get?id=abc123');
      expect(context.method).to.eq('acl.get');
      expect(context.options.id).to.eq('abc123');
    });

    it('should allow no options to be passed', function(){
      var context = consulDirective.parseExpression('acl.list');
      expect(context.method).to.eq('acl.list');
      expect(context.options).to.not.be.undefined;
      expect(context.options).to.not.be.null;
    });

    it('should throw an error if method requirements aren\'t satisfied.', function(){
      expect(function(){ consulDirective.parseExpression('acl.get'); }).to.throw(Error);
    });

    it('should return defaults if they are not specified', function(){
      var context = consulDirective.parseExpression('acl.list');
      expect(context.method).to.eq('acl.list');
      expect(context.options.ignoreStartupNodata).to.eq(false);
      expect(context.options.mode).to.eq('once');
    });
  });
});