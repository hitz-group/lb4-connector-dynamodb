// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { startTimer, stopTimer } = require('../helper.js');

/**
 * Save an object to the database
 * @param  {[type]}   model    [description]
 * @param  {[type]}   data     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function save(model, object, callback) {
  const data = object;
  const timeStart = startTimer();
  const originalData = {};
  const {
    hashKey,
    rangeKey,
    pkSeparator,
    pKey,
  } = this.allModels[model];

  /*
      Checks for hash and range keys
     */
  if (data[hashKey] === null || data[hashKey] === undefined) {
    const err = new Error(`Hash Key \`${hashKey}\` cannot be null or undefined.`);
    callback(err, null);
    return;
  }

  // If pKey is defined, range key is also present.
  if (pKey !== undefined) {
    if (data[rangeKey] === null || data[rangeKey] === undefined) {
      const err = new Error(`Range Key \`${rangeKey}\` cannot be null or undefined.`);
      callback(err, null);
      return;
    }

    data[pKey] = String(data[hashKey]) + pkSeparator + String(data[rangeKey]);
    originalData[pKey] = data[pKey];
  }

  // Copy all attrs from data to originalData
  Object.keys(data).forEach((key) => {
    originalData[key] = data[key];
  });

  const tableParams = {};
  tableParams.TableName = this.tables(model);
  tableParams.ReturnConsumedCapacity = 'TOTAL';

  const queryString = `PUT ITEM IN TABLE ${tableParams.TableName}`;

  if (pKey !== undefined) {
    delete data[pKey];
  }
  tableParams.Item = data;
  (this.daxClient || this.docClient).put(
    tableParams,
    (err) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, originalData);
      }
    },
  );

  this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
}

module.exports = save;
