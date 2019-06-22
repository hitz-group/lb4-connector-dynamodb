'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;


function destroy(model, pk, callback) {
  var _this = this;
  var timeStart = startTimer();
  var hashKey = this._models[model].hashKey;
  var rangeKey = this._models[model].rangeKey;
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

  // Use updateItem function of DynamoDB
  var tableParams = {};
  // Set table name as usual
  tableParams.TableName = this.tables(model);
  tableParams.Key = {};
  // Add hashKey to tableParams
  tableParams.Key[this._models[model].hashKey] = hk;

  if (pKey !== undefined) {
    tableParams.Key[this._models[model].rangeKey] = rk;
  }

  tableParams.ReturnValues = 'ALL_OLD';
  var attributeSpecs = this._attributeSpecs[model];
  var outerCounter = 0;
  var chunkedData = {};

  this.docClient.delete(
    tableParams,
    function (err, res) {
      if (err) {
        callback(err, null);
      } else if (!res) {
        callback(null, null);
      } else {
        // Attributes is an object
        var tempString =
          'DELETE ITEM FROM TABLE ' + tableParams.TableName + ' WHERE ' + hashKey + ' `EQ` ' + String(hk);
        _this._logger.log('info', tempString.blue, stopTimer(timeStart).bold.cyan);
        callback(null, res.Attributes);
      }
    }.bind(this)
  );
}

module.exports = destroy;
