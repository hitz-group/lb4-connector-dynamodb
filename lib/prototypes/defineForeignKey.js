'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var createTable = helper.createTable;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;
var AssignKeys = helper.AssignKeys;

function defineForeignKey(model, key, cb) {
  var _this = this;
  var hashKey = this._models[model].hashKey;
  var attributeSpec = this._attributeSpecs[model].id || this._attributeSpecs[model][hashKey];
  if (attributeSpec === 'string') {
    cb(null, String);
  } else if (attributeSpec === 'number') {
    cb(null, Number);
  } else if (attributeSpec === 'date') {
    cb(null, Date);
  }
};

module.exports = defineForeignKey;
