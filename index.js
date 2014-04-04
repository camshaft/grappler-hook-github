/**
 * Module dependencies
 */

var git = require('git-node');
var parseurl = require('url').parse;
var formaturl = require('url').format;
var mkdirp = require('mkdirp');
var exec = require('child_process').exec;

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

    var event = headers['x-github-event'];

    if (event === 'ping') return fn();

    var url = body.repository.url;
    var name = body.repository.name;
    var ref = body.ref;
    var branch = ref.replace('refs/heads/', '');
    var sha = body.after;

    var dir = task.dir;

    if (event === 'delete') return fn(null, name, branch, sha, event);

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

  var dir = target + '/.git';

  log('creating dir ' + dir);
  mkdirp(dir, function(err) {
    if (err) return fn(err);

    var remote = git.remote(authurl);
    var repo = git.repo(dir);
    var opts = {};
    opts.want = ref;
    log('fetching ' + url);
    repo.fetch(remote, opts, function(err) {
      if (err) return fn(err);
      log('checking out ' + ref);
      repo.resolveHashish(ref, function(err, hash) {
        if (err) return fn(err);
        log('updating head to ' + hash);
        repo.updateHead(hash, function(err) {
          if (err) return fn(err);
          exec('git checkout ' + hash, {cwd: target}, function(err, stdout, stderr) {
            fn(err);
          });
        });
      });
    });
  });
}
