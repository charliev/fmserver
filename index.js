"use strict";
/*

*/

const child_process = require('child_process');
const path = require('path');

const R = require('ramda');
const uuid = require('uuid').v1;

const fmrequestPath = path.resolve(__dirname, 'fmrequest');

module.exports = function(db) {
  let dbParamString = JSON.stringify(db.service);
  var supervisor = {};
  var workMap = new Map();
  var exportInterface = {};

  function start(src, name, collections) {
    let worker = child_process.fork(src, [dbParamString, fmrequestPath]);
    worker.on('disconnect', function() {});
    worker.on('close', function() {});
    worker.on('error', function() {});
    worker.on('exit', function(code, signal) {
      // log & restart it
      console.error(name + ' exited with code ' + code + ' and signal ' + signal + ', restarting...');
      start(src, name, collections);
    });
    worker.on('message', function(message) {
      workMap.get(message.ticketID)(message.result);
      workMap.delete(message.ticketID);
    });
    supervisor[name] = worker;
    exportInterface[name] = R.curry(dispatch)(name);
  }

  function dispatch(worker, args, cb) {
    args.ticketID = uuid();
    workMap.set(args.ticketID, cb);
    supervisor[worker].send(args);
  }

  R.mapObjIndexed(start, db.interfaces);
  return(exportInterface);
};
