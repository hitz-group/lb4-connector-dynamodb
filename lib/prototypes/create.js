'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 * Create a new item or replace/update it if it exists
 * @param  {object}   model
 * @param  {object}   data   : key,value pairs of new model object
 * @param  {Function} callback
 */
function create(model, data, callback) {
  var _this = this;
  var timerStart = startTimer();
  var hashKey = this._models[model].hashKey;
  var rangeKey = this._models[model].rangeKey;
  var pkSeparator = this._models[model].pkSeparator;
  var pKey = this._models[model].pKey;
  var err;
  // If jugglingdb defined id is undefined, and it is not a
  // hashKey or a primary key , then delete it.
  if (data.id === undefined && hashKey !== 'id') {
    delete data.id;
  }
  // If some key is a hashKey, check if uuid is set to true. If yes, call the
  // UUID() function and generate a unique id.
  if (this._models[model].hashKeyUUID === true) {
    data[hashKey] = helper.UUID();
  }
  var originalData = {};
  // Copy all attrs from data to originalData
  for (var key in data) {
    originalData[key] = data[key];
  }

  if (data[hashKey] === undefined) {
    err = new Error('Hash Key `' + hashKey + '` is undefined.');
    callback(err, null);
    return;
  }
  if (data[hashKey] === null) {
    err = new Error('Hash Key `' + hashKey + '` cannot be NULL.');
    callback(err, null);
    return;
  }
  // If pKey is defined, range key is also present.
  if (pKey !== undefined) {
    if (data[rangeKey] === null || data[rangeKey] === undefined) {
      err = new Error('Range Key `' + rangeKey + '` cannot be null or undefined.');
      callback(err, null);
      return;
    } else {
      data[pKey] = String(data[hashKey]) + pkSeparator + String(data[rangeKey]);
      originalData[pKey] = data[pKey];
    }
  }

  var queryString = 'CREATE ITEM IN TABLE ' + this.tables(model);
  var tableParams = {};
  tableParams.TableName = this.tables(model);
  tableParams.ReturnConsumedCapacity = 'TOTAL';

  var attributeSpecs = this._attributeSpecs[model];
  var outerCounter = 0;
  var chunkedData = {};

  var tempString = 'INSERT ITEM INTO TABLE: ' + tableParams.TableName;
  _this._logger.log('debug', tempString);
  // if (pKey !== undefined) {
  //   delete data[pKey];
  // }
  tableParams.Item = data;
  this.docClient.put(
    tableParams,
    function (err, res) {
      if (err || !res) {
        callback(err, null);
        return;
      } else {
        _this._logger.log('info', queryString.blue, stopTimer(timerStart).bold.cyan);
        if (pKey !== undefined) {
          originalData.id = originalData[pKey];
          callback(null, originalData.id);
          return;
        } else {
          originalData.id = originalData[hashKey];
          callback(null, originalData.id);
          return;
        }
      }
    }.bind(this)
  );
}

module.exports = create;
