"use strict";

const util = require('util');
const path = require('path');
const child_process = require('child_process');

const R = require('ramda');

const worker = path.resolve(__dirname, 'worker.js');

module.exports = function(db, layout) {

  var reqObject = {
    uri: util.format('http://%s:%s/fmi/xml/fmresultset.xml', db.host || '127.0.0.1', db.port || '80'),
    method: 'POST'
  };
  if (db.username && db.password && db.username.toString && db.password.toString) {
    reqObject.headers = {
      'Authorization': 'Basic ' + new Buffer(util.format('%s:%s', db.username.toString(), db.password.toString())).toString('base64')
    }
  }
  var reqParams = {
    '-db': db.database,
    '-lay': layout
  }

  return(function(args, cb) {
    let req = child_process.fork(worker);
    var re = {
      err: null,
      res: null
    };
    req.on('close', function() {});
    req.on('disconnect', function() {});
    req.on('error', function() {console.log(new Date(), 'error', arguments);});
    req.on('exit', function(code, signal) {
      if (code === 0) {
        return(cb(re.err, re.res));
      }
      return(cb(signal, null));
    });
    req.on('message', function(reply) {
      if (reply.ok && reply.data) {
        re.res = reply.data;
        return;
      }
      if (reply.error && reply.description) {
        re.err = reply.description;
        return;
      }
    });
    let p = (val, key) => encodeURIComponent(key.toString()) + '=' + encodeURIComponent(val.toString());
    req.send(R.merge(reqObject, {
      body: R.join('&',R.values(R.mapObjIndexed(p, R.merge(args, reqParams))))
    }));
  });
};
