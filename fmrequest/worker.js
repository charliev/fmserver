"use strict";

const util = require('util');

const request = require('request');
const sax = require('sax');
const R = require('ramda');

process.on('message', function(query) {
  try {
    fm(query, function(err, res) {
      if (err) {
        process.send({
          error: true,
          description: err.toString()
        });
      } else {
        process.send({
          ok: true,
          data: res
        });
      }
      process.exit(0);
    });
  } catch(e) {
    process.send({
      error: true,
      description: e.toString()
    });
    process.exit(0);
  }
});

function fm(query, cb) {

  var obj = false;
  var thisField = false;
  var dataBuffer = '';
  var data =[];

  var inSet = false;
  var set = [];
  var setName = '';
  var sub = {};

  var fmError = null;

  var parser = sax.parser(true);
  parser.onerror = function (e) {
    return(cb(new Error('parser error ' + e.message), null));
  };
  parser.onopentag = function (node) {
    if (node.name === 'relatedset') {
      inSet = true;
      setName = node.attributes.table;//.replace(/\s/g, '_').toLowerCase();
  	} else if (node.name === 'error') {
  		// console.error('### FileMaker error', node.attributes.code);
      fmError = parseInt(node.attributes.code, 10);
    } else if (node.name === 'record') {
      if (!inSet) {
        obj = {};
      } else {
        sub = {};
      }
    } else if (node.name === 'field') {
      thisField = node.attributes.name;//.replace(/\s/g, '_').toLowerCase();
      if (inSet) {
        thisField = thisField.replace(setName + '::', '');
      }
    } else if (node.name === 'data') {
      dataBuffer = '';
    }
  };
  parser.ontext = function(text) {
    dataBuffer += text;
  };
  parser.onclosetag = function (tagname) {
    if (tagname === 'relatedset') {
      inSet = false;
      obj[setName] = set;
      set = [];
    } else if (tagname === 'record') {
      if (inSet) {
        set.push(sub);
      } else {
        data.push(obj);
      }
    } else if (tagname === 'field') {
      thisField = false;
    } else if (tagname === 'data' && thisField) {
      if (inSet) {
        sub[thisField] = dataBuffer;
      } else {
        obj[thisField] = dataBuffer;
      }
      dataBuffer = '';
    }  else if (tagname === 'resultset') {
      // we're actually done parsing, but will use the onend handler to finish things off
    }
  };
  parser.onend = function () {
    if (fmError) {
      return(cb(new Error('filemaker error code ' + fmError), null));
    }
    return(cb(null, data));
  };

  request(query, function(e, r, b) {
    if (e) {
      return(cb(new Error('request error ' + e.message), null));
    }
    if (r.statusCode !== 200 && r.statusCode !== 201) {
      return(cb(new Error('http error code ' + r.statusCode), null));
    }
    parser.write(b).close();
	});
}
