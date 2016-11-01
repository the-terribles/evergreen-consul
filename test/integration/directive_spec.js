'use strict';

var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  sinonChai = require("sinon-chai"),
  expectSinonChai = chai.use(sinonChai),
  consul = require('consul')({}),
  util = require('util'),
  lodash = require('lodash'),
  errors = require('../../lib/errors'),
  DirectiveContext = require('trbl-evergreen/lib/directive-context.js'),
  TestUtils = require('trbl-evergreen/test/utils.js'),
  StateManager = require('../../lib/state-manager'),
  ConsulDirective = require('../../lib/directive');

describe('Consul Directive', function() {
  describe('Once', function(){
    var fooBarValue = 'test-testy-test';
    var directive = new ConsulDirective();
    beforeEach(function(done){
      this.timeout(15000);
      consul.kv.set('foo', fooBarValue, function(err){
        done(err);
      });
    });

    it('should return the value of "foo"', function(next){
      var context = new DirectiveContext(
        'consul', 
        'kv.get?key=foo', 
        [{ field: 'foo' }]
      );
      var callback = sinon.spy();
      directive.handle(context, {}, {}, function(err, directiveContext){
        expect(err).to.be.null;
        expect(directiveContext).to.be.an.instanceOf(DirectiveContext);
        var manager = directiveContext.value;
        var kv = manager.value;
        expect(kv.Value).to.eq(fooBarValue);
        next();
      });
    });
  });
});