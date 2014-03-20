grappler-hook-github
====================

GitHub plugin for grappler

Usage
-----

```js
var app = grappler();
var github = require('grappler-hook-github');

app.plugin(github({
  token: 'GITHUB OAUTH TOKEN GOES HERE', // required
  secret: '...' // optional - checks the request is actually coming from GitHub
}));
```
