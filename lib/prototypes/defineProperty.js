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

function defineProperty(model, prop, params) {
  var _this = this;
  this._models[model].properties[prop] = params;
};

module.exports = defineProperty;
