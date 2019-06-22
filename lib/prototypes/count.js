'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 * Get number of records matching a filter
 * @param  {Object}   model
 * @param  {Object}   where    : Filter
 * @param  {Function} callback
 * @return {Number}            : Number of matching records
 */
function count(model, where, callback) {
  var _this = this;
  var filter = {};
  filter.where = where;
  this.all(model, filter, function (err, results) {
    if (err || !results) {
      callback(err, null);
    } else {
      callback(null, results.length);
    }
  });
}

module.exports = count;
