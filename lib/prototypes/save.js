'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 * Save an object to the database
 * @param  {[type]}   model    [description]
 * @param  {[type]}   data     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function save(model, data, callback) {
  var _this = this;
  var timeStart = startTimer();
  var originalData = {};
  var hashKey = this._models[model].hashKey;
  var rangeKey = this._models[model].rangeKey;
  var pkSeparator = this._models[model].pkSeparator;
  var pKey = this._models[model].pKey;

  /* Data is the original object coming in the body. In the body
       if the data has a key which is breakable, it must be chunked
       into N different attrs. N is specified by the breakValue[key]
    */
  var attributeSpecs = this._attributeSpecs[model];
  var outerCounter = 0;

  /*
      Checks for hash and range keys
     */
  if (data[hashKey] === null || data[hashKey] === undefined) {
    var err = new Error('Hash Key `' + hashKey + '` cannot be null or undefined.');
    callback(err, null);
    return;
  }
  // If pKey is defined, range key is also present.
  if (pKey !== undefined) {
    if (data[rangeKey] === null || data[rangeKey] === undefined) {
      var err = new Error('Range Key `' + rangeKey + '` cannot be null or undefined.');
      callback(err, null);
      return;
    } else {
      data[pKey] = String(data[hashKey]) + pkSeparator + String(data[rangeKey]);
      originalData[pKey] = data[pKey];
    }
  }

  // Copy all attrs from data to originalData
  for (var key in data) {
    originalData[key] = data[key];
  }

  var queryString = 'PUT ITEM IN TABLE ';
  var tableParams = {};
  tableParams.TableName = this.tables(model);
  tableParams.ReturnConsumedCapacity = 'TOTAL';

  if (pKey !== undefined) {
    delete data[pKey];
  }
  tableParams.Item = data;
  this.docClient.put(
    tableParams,
    function (err, res) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, originalData);
      }
    }.bind(this)
  );

  _this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
}

module.exports = save;
