'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 * Destroy all deletes all records from table.
 * @param  {[type]}   model    [description]
 * @param  {Function} callback [description]
 */
function destroyAll(model, options, callback) {
  /*
      Note:
      Deleting individual items is extremely expensive. According to
      AWS, a better solution is to destroy the table, and create it back again.
     */
  var _this = this;
  var timeStart = startTimer();
  var queryString = 'DELETE EVERYTHING IN TABLE: ' + this.tables(model);
  var hashKey = this._models[model].hashKey;
  var rangeKey = this._models[model].rangeKey;
  var pkSeparator = this._models[model].pkSeparator;
  var attributeSpecs = this._attributeSpecs[model];
  var hk, rk, pk;
  var docClient = this.docClient;
  var filter;

  if (typeof (options) === 'function') {
    callback = options;
  }
  else {
    filter = { where: options };
  }

  var self = this;
  var tableParams = scan.call(this, model, filter, queryString, timeStart);
  tableParams.TableName = this.tables(model);
  docClient.scan(tableParams, function (err, res) {
    if (err) {
      callback(err);
      return;
    } else if (res === null) {
      callback(null);
      return;
    } else {
      async.mapSeries(
        res.Items,
        function (item, insideCallback) {
          if (rangeKey === undefined) {
            hk = item[hashKey];
            pk = hk;
          } else {
            hk = item[hashKey];
            rk = item[rangeKey];
            pk = String(hk) + pkSeparator + String(rk);
          }
          self.destroy(model, pk, insideCallback);
        },
        function (err, items) {
          if (err) {
            callback(err);
          } else {
            callback(null, {
              count: items.length
            });
          }
        }.bind(this)
      );
    }
  });
  _this._logger.log('warn', queryString.bold.red, stopTimer(timeStart).bold.cyan);
}

module.exports = destroyAll;
