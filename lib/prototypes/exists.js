'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 * Check if a given record exists
 * @param  {[type]}   model    [description]
 * @param  {[type]}   id       [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function exists(model, id, callback) {
  var _this = this;
  this.find(model, id, function (err, record) {
    if (err) {
      callback(err, null);
    } else if (isEmpty(record)) {
      callback(null, false);
    } else {
      callback(null, true);
    }
  });
}

module.exports = exists;
