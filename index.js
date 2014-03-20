/**
 * Module dependencies
 */

var git = require('git-node');
var parseurl = require('url').parse;
var formaturl = require('url').format;

/**
 * Create a GitHub hook
 *
 * @param {Object} config
 * @return {Server}
 */

module.exports = function(config) {
  config = config || {};

  var secret = config.secret;
  var key = config.token;

  if (!key) throw new Error('missing github token')

  return function(app) {
    app.hook('github', '/github', hook);
  };

  function hook(task, log, fn) {
    // TODO verify secret matches

    var body = task.body;
    var headers = task.headers;

    var url = body.repository.url;
    var name = body.repository.name;
    var ref = body.ref;
    var branch = ref.replace('refs/heads/', '');
    var sha = body.after;
    var event = headers['x-github-event'];

    var dir = task.dir;

    log('cloning ' + url + ' to ' + dir);
    clone(url, dir, ref, key, log, function(err) {
      log('ready to deploy');
      fn(err, name, branch, sha, event);
    });
  };
};

/**
 * Clone a repo
 *
 * @param {String} url
 * @param {String} target
 * @param {String} ref
 * @param {String} key
 * @param {Function} log
 * @param {Function} fn
 */

function clone(url, target, ref, key, log, fn) {
  var urlObj = parseurl(url);
  urlObj.auth = key + ':x-oauth-basic';
  var authurl = formaturl(urlObj) + '.git';

  var remote = git.remote(authurl);
  var repo = git.repo(target + '.git');
  var opts = {};
  opts.want = ref;
  log('fetching ' + url);
  repo.fetch(remote, opts, function(err) {
    if (err) return fn(err);
    log('checking out ' + ref);
    repo.resolveHashish(ref, function(err, hash) {
      if (err) return fn(err);
      log('updating head to ' + hash);
      repo.updateHead(hash, fn);
    });
  });
}
