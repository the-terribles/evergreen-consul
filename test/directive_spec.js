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
      var validEntities = ['acl.get', 'acl', 'acl.list', 'acls', 'agent.members', 'members',
        'agent.self', 'self', 'agent.check.list', 'agent.checks', 'agent.service.list',
        'agent.services', 'catalog.datacenters', 'datacenters', 'catalog.node.list', 'node.list', 
        'nodes', 'catalog.node.services', 'node.services', 'catalog.service.list', 'service.list', 
        'services', 'catalog.service.nodes', 'service.nodes', 'event.list', 'events', 'health.node',
        'health.checks', 'health.service', 'health.state', 'kv.get', 'kv', 'kv.keys', 'keys',
        'session.get', 'session','session.node', 'session.list', 'sessions', 'status.leader', 
        'leader', 'status.peers', 'peers'
      ];

      var generateExpression = function(method){
        return util.format('%s?foo=bar', method);
      };

      var expressions = lodash.map(validEntities, generateExpression);

      expressions.forEach(function(e){
        expect(function(){ 
          consulDirective.parseExpression(e);
        }).to.not.throw(Error);
      });

      expect(function(){ consulDirective.parseExpression('blah'); }).to.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah.blah'); }).to.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah?foo=bar'); }).to.throw(Error);
      expect(function(){ consulDirective.parseExpression('blah.blah?foo=bar'); }).to.throw(Error);
    });

    it('should return a method and parsed options', function(){
      var context = consulDirective.parseExpression('acl.get?foo=bar&fooz=ball');
      expect(context.method).to.be.an.instanceOf(Function);
      expect(context.options).to.deep.eq({ foo: 'bar', fooz: 'ball' });
    });

    it('should allow no options to be passed', function(){
      var context = consulDirective.parseExpression('acl.get');
      expect(context.method).to.be.an.instanceOf(Function);
      expect(context.options).to.deep.eq({});
    });
  });
});