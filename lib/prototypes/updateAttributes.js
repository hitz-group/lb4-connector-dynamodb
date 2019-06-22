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

// FIXME: function not working
function updateAttributes(model, pk, data, callback) {
  var _this = this;
  var timeStart = startTimer();
  var originalData = {};
  var hashKey = this._models[model].hashKey;
  var rangeKey = this._models[model].rangeKey;
  var pkSeparator = this._models[model].pkSeparator;
  var pKey = this._models[model].pKey;
  var hk, rk, err, key;
  var tableParams = {};
  var attributeSpecs = this._attributeSpecs[model];
  var outerCounter = 0;
  // Copy all attrs from data to originalData
  for (key in data) {
    originalData[key] = data[key];
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

  // Log queryString
  var queryString = 'UPDATE ITEM IN TABLE ';

  // Use updateItem function of DynamoDB

  // Set table name as usual
  tableParams.TableName = this.tables(model);
  tableParams.Key = {};
  tableParams.AttributeUpdates = {};
  tableParams.ReturnConsumedCapacity = 'TOTAL';

  // Add hashKey / rangeKey to tableParams
  if (pKey !== undefined) {
    var temp = pk.split(pkSeparator);
    hk = temp[0];
    rk = temp[1];
    tableParams.Key[this._models[model].hashKey] = hk;
    tableParams.Key[this._models[model].rangeKey] = rk;
  } else {
    tableParams.Key[this._models[model].hashKey] = pk;
    hk = pk;
  }

  if (pKey !== undefined) {
    delete data[pKey];
  }
  // Add attrs to update

  for (var key in data) {
    if (data.hasOwnProperty(key) && data[key] && key !== hashKey && key !== rangeKey) {
      tableParams.AttributeUpdates[key] = {};
      tableParams.AttributeUpdates[key].Action = 'PUT';
      tableParams.AttributeUpdates[key].Value = data[key];
    }
  }

  tableParams.ReturnValues = 'ALL_NEW';
  this.docClient.update(
    tableParams,
    function (err, res) {
      if (err) {
        callback(err, null);
      } else if (!res) {
        callback(null, null);
      } else {
        callback(null, res.data);
      }
    }.bind(this)
  );
  _this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
};

module.exports = updateAttributes;
