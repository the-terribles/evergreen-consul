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
  describe('when retrieving a value once', function(){
    var fooValue = 'test-testy-test';
    var directive = new ConsulDirective();
    beforeEach(function(done){
      this.timeout(5000);
      consul.kv.set('foo', fooValue, function(err){
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
        expect(kv.Value).to.eq(fooValue);
        next();
      });
    });
  });

  describe('when watching a value', function(){
    var barValue = '1';
    var barChangedValue = '2';
    var directive = new ConsulDirective();
    beforeEach(function(done){
      this.timeout(2000);
      consul.kv.set('bar', barValue, function(err){
        done(err);
      });
    });

    it('should notify listeners of updates', function(next){
      this.timeout(2000);
      var context = new DirectiveContext(
        'consul', 
        'kv.get?key=bar&mode=watch&wait=1s', 
        [{ field: 'bar' }]
      );
      var callback = sinon.spy();
      directive.handle(context, {}, {}, function(err, directiveContext){
        expect(err).to.be.null;
        expect(directiveContext).to.be.an.instanceOf(DirectiveContext);
        var manager = directiveContext.value;
        expect(manager.value.Value).to.eq(barValue);
        var changeListener = sinon.spy();
        manager.on('change', changeListener);
        consul.kv.set('bar', barChangedValue, function(err){
          expect(err).to.be.undefined;
          setTimeout(function(){
            expect(changeListener).to.be.called;
            expect(manager.value.Value).to.eq(barChangedValue);
            next();
          }, 1500);
        });
      });
    });
  });
});