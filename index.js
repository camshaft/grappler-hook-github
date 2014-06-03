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
    app.on('task', function(task) {
      task.on('gh:parsed', function() {
        fetch(key, task);
      });

      task.on('ready', handleStatus('pending', task));
      task.on('error', handleStatus('error', task));
      task.on('success', handleStatus('success', task));
      task.on('success', handleSuccess(task));
    });
  };

  function hook(req, log, fn) {
    // TODO verify secret matches
    var event = req.headers['x-github-event'];
    if (event === 'push') return handlePush(key, req, log, fn);
    if (event === 'pull_request') return handlePullRequest(key, req, log, fn);
    if (event === 'deployment') return handleDeployment(key, req, log, fn);
    return fn('pass');
  };
};

/**
 * Handle a pull request event
 *
 * steps:
 *   * check mergability (https://developer.github.com/v3/pulls/#mergability)
 *   * merge the commit (https://developer.github.com/v3/repos/merging/)
 *
 * @doc https://developer.github.com/v3/activity/events/types/#pullrequestevent
 */

function handlePullRequest(key, task, log, fn) {
  var body = task.body;

}

/**
 * Handle a push event
 *
 * steps:
 *   * git clone sha
 *   * deploy the sha
 *   * listen for success/failure and update the repo status (https://developer.github.com/v3/repos/statuses/)
 *   * create a deployment (https://developer.github.com/v3/repos/deployments/#create-a-deployment)
 */

function handlePush(key, req, log, fn) {
  var body = req.body;
  var repo = body.repository;
  if (!body || !repo) return fn(new Error('missing body'));

  var url = repo.url;
  var name = repo.name;
  var ref = body.ref;
  var branch = ref.replace('refs/heads/', '');
  var sha = body.after;

  var info = {
    repo: repo.organization + '/' + repo.name,
    url: repo.url,
    name: repo.name,
    ref: ref,
    branch: branch,
    sha: sha,
    body: body
  };

  var event = body.deleted ? 'branch-deleted' : 'gh:parsed';
  fn(null, info, event);
}

/**
 * Handle a deployment event
 *
 * @doc https://developer.github.com/v3/activity/events/types/#deploymentevent
 */

function handleDeployment() {

}

function handleStatus(event, task) {
  return function() {};
}

/**
 * Create a deployment
 */

function handleSuccess(task) {
  return function() {};
}

function fetch(key, task) {
  task.clone('github', function(dir, log) {
    var url = task.info.url;
    var ref = task.info.ref;
    log('cloning ' + url + ' to ' + dir);
    clone(url, dir, ref, key, log, function(err) {
      if (err) {
        log('' + err);
        return task.emit('error', err);
      }
      log('ready to deploy');
      task.ready();
    });
  });
}

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
