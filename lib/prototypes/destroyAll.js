// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const async = require('async');
const {
  scan,
  startTimer,
  stopTimer,
} = require('../helper.js');

/**
 * Destroy all deletes all records from table.
 * @param  {[type]}   model    [description]
 * @param  {Function} callback [description]
 */
function destroyAll(model, options, cb) {
  /*
      Note:
      Deleting individual items is extremely expensive. According to
      AWS, a better solution is to destroy the table, and create it back again.
     */
  const timeStart = startTimer();
  const queryString = `DELETE EVERYTHING IN TABLE: ${this.tables(model)}`;
  const {
    hashKey,
    rangeKey,
    pkSeparator,
  } = this.allModels[model];
  const { docClient } = this;
  let callback = cb;
  let hk; let rk; let pk; let filter;

  if (typeof (options) === 'function') {
    callback = options;
  } else {
    filter = { where: options };
  }

  const tableParams = scan.call(this, model, filter, queryString, timeStart);
  tableParams.TableName = this.tables(model);
  docClient.scan(tableParams, (scanError, res) => {
    if (scanError) {
      callback(scanError);
      return;
    }
    if (res === null) {
      callback(null);
      return;
    }

    async.mapSeries(
      res.Items,
      ((item, insideCallback) => {
        if (rangeKey === undefined) {
          hk = item[hashKey];
          pk = hk;
        } else {
          hk = item[hashKey];
          rk = item[rangeKey];
          pk = String(hk) + pkSeparator + String(rk);
        }
        this.destroy(model, pk, insideCallback);
      }),
      (asyncError, items) => {
        if (asyncError) {
          callback(asyncError);
        } else {
          callback(null, {
            count: items.length,
          });
        }
      },
    );
  });

  this._logger.log('warn', queryString.bold.red, stopTimer(timeStart).bold.cyan);
}

module.exports = destroyAll;
