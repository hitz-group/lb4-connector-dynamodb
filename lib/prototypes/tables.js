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

function tables(name) {
  var _this = this;
  if (!this._tables[name]) {
    this._tables[name] = name;
  }
  return this._tables[name];
};

module.exports = tables;
