var grappler = require('grappler');

var app = module.exports = grappler();

app.plugin(require('./')({
  token: process.env.GITHUB_SECRET
}));
