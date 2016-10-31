'use strict';

var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  sinonChai = require("sinon-chai"),
  expectSinonChai = chai.use(sinonChai),
  util = require('util'),
  lodash = require('lodash'),
  errors = require('../../lib/errors'),
  EventEmitter = require('events').EventEmitter,
  TestUtils = require('trbl-evergreen/test/utils.js'),
  StateManager = require('../../lib/state-manager');

describe('StateManager', function(){
  describe('when configuring', function(){
    var expectedResponse, consul, context, manager;
    beforeEach(function(){
      expectedResponse = '715025A3-66F4-4B0E-B3F9-6B492BC3ED7D';
      consul = {
        test: {
          method: function(){
            return expectedResponse;
          },
        },
      };
      context = {
        method: 'test.method',
        options: { 
          mode: 'once',
          id: 'blahblah',
          sprockets: 10,
        },
      };
      manager = new StateManager(consul, context);
    });

    it('should bind to the correct method in the Consul object', function(){
      expect(manager.method).to.be.instanceOf(Function);
      // Unfortunately we can't compare the equality of functions,
      // particularly with a .bind() called on them.  So instead,
      // I'm just doing something simple by comparing the response.
      expect(manager.method()).to.eq(expectedResponse);
    });

    it('should remove non-Consul options from the method context', function(){
      expect(manager.methodContext.mode).to.be.undefined;
      expect(manager.methodContext.ignoreStartupNodata).to.be.undefined;
    });
  });

  describe('when refreshing configuration', function(){
    var methodMock, consul, context, manager; 
    // This is a real response (from the node-consul documentation);
    var aclResponse = [
      {
        "CreateIndex": 2,
        "ModifyIndex": 2,
        "ID": "anonymous",
        "Name": "Anonymous Token",
        "Type": "client",
        "Rules": ""
      },
      {
        "CreateIndex": 3,
        "ModifyIndex": 3,
        "ID": "root",
        "Name": "Master Token",
        "Type": "management",
        "Rules": ""
      }
    ];
    beforeEach(function(){
      methodMock = sinon.stub();
      consul = {
        acl: {
          list: methodMock,
        },
      };
      context = {
        method: 'acl.list',
        options: { 
          mode: 'once',
        },
      };
      manager = new StateManager(consul, context);
    });

    it('should cache the previously returned configuration', function(){
      methodMock.callsArgWith(1, null, aclResponse);
      manager.refresh();
      expect(manager.value).to.deep.eq(aclResponse);
      expect(manager.hasConfig()).to.be.true;
    });

    it('should notify subscribers', function(){
      var successListener = sinon.mock();
      var errorListener = sinon.mock();
      manager.on('change', successListener);
      manager.on('error', errorListener);
      methodMock.callsArgWith(1, null, aclResponse);
      manager.refresh();
      expect(successListener).to.have.been.calledWith(aclResponse);
      expect(errorListener).to.not.have.been.called;
    });

    it('should notify subscribers on error', function(){
      var successListener = sinon.mock();
      var errorListener = sinon.mock();
      var error = new Error('Oops!');
      manager.on('change', successListener);
      manager.on('error', errorListener);
      methodMock.callsArgWith(1, error);
      manager.refresh();
      expect(successListener).to.not.have.been.called;
      expect(errorListener).to.have.been.calledWith(error);
    });

    it('should invoke the callback when present', function(){
      var callback = sinon.mock();
      methodMock.callsArgWith(1, null, aclResponse);
      manager.refresh(callback);
      expect(callback).to.have.been.calledWith(null, aclResponse);
    });
  });

  describe('when watching configuration', function(){
    var methodMock, watchMock, ee, consul, context, manager; 
    // This is a real response (from the node-consul documentation);
    var aclResponse = [
      {
        "CreateIndex": 2,
        "ModifyIndex": 2,
        "ID": "anonymous",
        "Name": "Anonymous Token",
        "Type": "client",
        "Rules": ""
      },
      {
        "CreateIndex": 3,
        "ModifyIndex": 3,
        "ID": "root",
        "Name": "Master Token",
        "Type": "management",
        "Rules": ""
      }
    ];
    var aclResponseUpdate = [
      {
        "CreateIndex": 4,
        "ModifyIndex": 4,
        "ID": "anonymous",
        "Name": "Pseudo Anonymous Token",
        "Type": "client",
        "Rules": ""
      },
      {
        "CreateIndex": 5,
        "ModifyIndex": 5,
        "ID": "root",
        "Name": "Updated Master Token",
        "Type": "management",
        "Rules": ""
      }
    ];
    beforeEach(function(){
      ee = new EventEmitter();
      methodMock = sinon.stub();
      watchMock = sinon.stub();
      watchMock.returns(ee);
      consul = {
        acl: {
          list: methodMock,
        },
        watch: watchMock,
      };
      context = {
        method: 'acl.list',
        options: { 
          mode: 'watch',
        },
      };
      manager = new StateManager(consul, context);
    });

    it('should update the cached state when new values are recieved', function(){
      methodMock.callsArgWith(1, null, aclResponse);
      manager.refresh();
      expect(manager.value).to.deep.eq(aclResponse);
      manager.startWatch();
      ee.emit('change', aclResponseUpdate);
      expect(manager.value).to.deep.eq(aclResponseUpdate);
    });

    it('should notify subscribers on change', function(){
      manager.startWatch();
      var successListener = sinon.mock();
      var errorListener = sinon.mock();
      manager.on('change', successListener);
      manager.on('error', errorListener);
      ee.emit('change', aclResponseUpdate);
      expect(successListener).to.have.been.calledWith(aclResponseUpdate);
      expect(errorListener).to.not.have.been.called;
    });

    it('should notify subscribers on error', function(){
      manager.startWatch();
      var successListener = sinon.mock();
      var errorListener = sinon.mock();
      var error = new Error();
      manager.on('change', successListener);
      manager.on('error', errorListener);
      ee.emit('error', error);
      expect(successListener).to.not.have.been.called;
      expect(errorListener).to.have.been.calledWith(error);
    });
  });  
});
