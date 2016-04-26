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

  var tpl = {};

  var obj = false;
  var currentField = false;
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

    if (node.name === 'field' && tpl[node.attributes.name]) {
      currentField = {
        fieldName: node.attributes.name,
        fieldType: tpl[node.attributes.name]
      };
    }

    if (node.name === 'data') {
      dataBuffer = '';
    }

    if (node.name === 'record') {
      obj = {
        'record-id': parseInt(node.attributes['record-id'], 10),
        'mod-id': parseInt(node.attributes['mod-id'], 10)
      }
    }

    if (node.name === 'field-definition' && !(/::/).test(node.attributes.name)) {
      tpl[node.attributes.name] = node.attributes.result;
    }

    if (node.name === 'metadata') {
      tpl = {};
    }

    if (node.name === 'error') {
  		// console.error('### FileMaker error', node.attributes.code);
      fmError = parseInt(node.attributes.code, 10);
    }
  };
  parser.ontext = function(text) {
    dataBuffer += text;
  };
  parser.onclosetag = function (tagname) {

    if (tagname === 'record' && obj) {
      data.push(obj);
      obj = false;
    }

    if (tagname === 'field') {
      currentField = false;
    }

    if (tagname === 'data' && currentField) {
      // console.log('bleep', obj, currentField);
      if (currentField.fieldType === 'text') {
        obj[currentField.fieldName] = dataBuffer;
      }
      if (currentField.fieldType === 'number') {
        obj[currentField.fieldName] = parseFloat(dataBuffer);
      }
      if (currentField.fieldType === 'timestamp') {
        obj[currentField.fieldName] = new Date(dataBuffer);
      }
      if (currentField.fieldType === 'date') {
        obj[currentField.fieldName] = new Date(dataBuffer);
      }
      dataBuffer = '';
    }

    if (tagname === 'resultset') {
      // we're actually done parsing, but will use the onend handler to finish things off
    }
  };
  parser.onend = function () {
    if (fmError) {
      return(cb(new Error('filemaker error code ' + fmError), null));
    }
    // console.log(tpl, data);
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
