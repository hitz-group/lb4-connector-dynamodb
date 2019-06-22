'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 * Find an item based on hashKey alone
 * @param  {object}   model    [description]
 * @param  {object/primitive}   pKey   : If range key is undefined,
 *                                       this is the same as hash key. If range key is defined,
 *                                       then pKey is hashKey + (Separator) + rangeKey
 * @param  {Function} callback
 */
function find(model, pk, callback) {
  var _this = this;
  var timeStart = startTimer();
  var queryString = 'GET AN ITEM FROM TABLE ';
  var hashKey = this._models[model].hashKey;
  var rangeKey = this._models[model].rangeKey;
  var attributeSpecs = this._attributeSpecs[model];
  var hk, rk;
  var pKey = this._models[model].pKey;
  var pkSeparator = this._models[model].pkSeparator;
  if (pKey !== undefined) {
    var temp = pk.split(pkSeparator);
    hk = temp[0];
    rk = temp[1];
    if (this._attributeSpecs[model][rangeKey] === 'number') {
      rk = parseInt(rk);
    } else if (this._attributeSpecs[model][rangeKey] === 'date') {
      rk = Number(rk);
    }
  } else {
    hk = pk;
  }

  // If hashKey is of type Number use parseInt
  if (this._attributeSpecs[model][hashKey] === 'number') {
    hk = parseInt(hk);
  } else if (this._attributeSpecs[model][hashKey] === 'date') {
    hk = Number(hk);
  }

  var tableParams = {};
  tableParams.Key = {};
  tableParams.Key[hashKey] = hk;
  if (pKey !== undefined) {
    tableParams.Key[rangeKey] = rk;
  }

  tableParams.TableName = this.tables(model);

  tableParams.ReturnConsumedCapacity = 'TOTAL';

  if (tableParams.Key) {
    this.docClient.get(
      tableParams,
      function (err, res) {
        if (err || !res) {
          callback(err, null);
        } else if (isEmpty(res)) {
          callback(null, null);
        } else {
          var finalResult = [];
          var pKey = this._models[model].pKey;
          var pkSeparator = this._models[model].pkSeparator;
          // Single object - > Array
          callback(null, res.Item);
          _this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
        }
      }.bind(_this)
    );
  }
}

module.exports = find;
