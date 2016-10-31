# trbl-evergreen-consul
Consul-based Evergreen Branch Source Directive

![Build Status](https://circleci.com/gh/the-terribles/evergreen-consul.svg?style=shield&circle-token=:circle-token)

### What does that even mean?

Simply, that the content of a branch (e.g. `foo.bar` in `{ foo: { bar: '...' }}` will be replaced with content from Consul).  This directive is a thin wrapper for the `node-consul` library (https://github.com/silas/node-consul), and supports all of the non-mutative routes:

Method | aliases

 - acl.get | acl
 - acl.list | acls
 - agent.members | members
 - agent.self | self
 - agent.check.list | agent.checks
 - agent.service.list | agent.services
 - catalog.datacenters | datacenters
 - catalog.node.list | node.list | nodes
 - catalog.node.services | node.services
 - catalog.service.list | service.list | services
 - catalog.service.nodes | service.nodes
 - event.list | events
 - health.node
 - health.checks
 - health.service
 - health.state
 - kv.get | kv
 - kv.keys | keys
 - session.get | session
 - session.node
 - session.list | sessions
 - status.leader | leader
 - status.peers | peers

The signature of the directive is:

```$consul:<entity-type>?<url-encodeed-options>```

For example:

```javascript
{
  foo: {
    bar: '$consul:acl.list',
  }
}
```

Would get replaced with the first record matching that query:

```javascript
{
  foo: {
    bar: {
      // This is an instance of StateManager,
      // which offers a nice API for refreshing
      // the values or watching for changes.
      // Current state is set under the "value"
      // property.
      value: [
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
      ]
    }
  }
}
```

Each one of the methods (in this case `acl.list` and `kv.get`) have their own set of parameters, which are described in the `node-consul` repository and enforced by the Evergreen Consul Directive (see `./lib/base-options.js` and `./lib/directive.js` for the Joi schemas).

You can specify parameters by supplying them as URL-encoded values after the Consul method:

```javascript
{
  fooz: {
    ball: '$consul:kv?key=/foo/bar&mode=watch'
  }
}
```

Would get replaced with the first record matching that query:

```javascript
{
  fooz: {
    ball: {
      // ...StateManager instance
      value: 'value of fooz ball key'
    }
  }
}
```

In addition to the Consul method parameters, there are a couple of Evergreen Consul specific options:

- `mode` (String, default: 'once'): How should the value be returned?
   - `once`: Look up the value once and return that value as the value of the expression.
   - `watch`: Continuously watch for changes and update the configuration.
- `ignoreStartupNodata` (Boolean, default: false): If the directive is unable to pull data from Consul, should the failure be ignored? (TRUE) Or should it cause startup to fail (FALSE)?

Also, remember that like everything else in Evergreen, Directives are not processed until variable substitution is satisfied.  This means you can still do things like this:

```javascript
{
  fooz: {
    ball: '$consul:kv?key=/databases/{{environment}}/mysql'
  }
}
```

### State Manager

Whenever Evergreen Consul is used, an instance of `StateManager` is returned.  This service can be used to get the lastest value of a configuration item in Consul by either actively requesting the value, or allowing the StateManager to watch for changes and notify clients.  If you want to use the **watch** functionality, you need to enable it using the `mode=watch` directive parameter:

```javascript
{
  fooz: {
    ball: '$consul:kv?key=/databases/{{environment}}/mysql&watch=true'
  }
}
```

You can observe these changes using the API:

```javascript
// Actively
var config = require('evergreen').config;
config.foo.bar.refresh(function(err, value){
  // Do something with the err/value.
});

// Passively
var config = require('evergreen').config;

config.foo.bar.on('change', function(value){
  // Swap out values
});

config.foo.bar.on('error', function(err){
  // Log the error
});
```

**WARNING**:  Updates to the Consul nodes will not caused dependent branches to update.  This is a feature planned for a later release of Evergreen (sorry).

## Installation and Configuration

To use the module, simply register it with Evergreen.

```
npm i --save trbl-evergreen-consul
```

```
require('trbl-evergreen')
  .addModule(require('trbl-evergreen-consul'))
  .render(tree)
  .and()
  .then(function(config){
    // do something with the config.
});
```

### Wait!  How did the plugin know which Consul node to use?

By default, the library assumes you are using `http://localhost:8500` (standard practice for a Consul Agent), but you can also set an environment variable to change the location:

```
EV_CONSUL_URI=http://my-consul-node:8500
```

### That's it.

Nothing else to see here.  Issues and PR's are welcome.

## License

The MIT License (MIT)

Copyright (c) 2016 The Terribles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.