// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { startTimer, stopTimer, UUID } = require('../helper.js');

/**
 * Create a new item or replace/update it if it exists
 * @param  {object}   model
 * @param  {object}   d   : key,value pairs of new model object
 * @param  {Function} callback
 */
function create(model, d, callback) {
  const data = d;
  const timerStart = startTimer();
  const {
    hashKey,
    rangeKey,
    pkSeparator,
    pKey,
  } = this.allModels[model];
  let err;
  // If jugglingdb defined id is undefined, and it is not a
  // hashKey or a primary key , then delete it.
  if (data.id === undefined && hashKey !== 'id') {
    delete data.id;
  }
  // If some key is a hashKey, check if uuid is set to true. If yes, call the
  // UUID() function and generate a unique id.
  if (this.allModels[model].hashKeyUUID === true) {
    data[hashKey] = UUID();
  }
  // Copy all attrs from data to originalData
  const originalData = Object.assign({}, data);

  if (data[hashKey] === undefined) {
    err = new Error(`Hash Key \`${hashKey}\` is undefined.`);
    callback(err, null);
    return;
  }
  if (data[hashKey] === null) {
    err = new Error(`Hash Key \`${hashKey}\` cannot be NULL.`);
    callback(err, null);
    return;
  }
  // If pKey is defined, range key is also present.
  if (pKey !== undefined) {
    if (data[rangeKey] === null || data[rangeKey] === undefined) {
      err = new Error(`Range Key \`${rangeKey}\` cannot be null or undefined.`);
      callback(err, null);
      return;
    }

    data[pKey] = String(data[hashKey]) + pkSeparator + String(data[rangeKey]);
    originalData[pKey] = data[pKey];
  }

  const queryString = `CREATE ITEM IN TABLE ${this.tables(model)}`;
  const tableParams = {};
  tableParams.TableName = this.tables(model);
  tableParams.ReturnConsumedCapacity = 'TOTAL';

  const tempString = `INSERT ITEM INTO TABLE: ${tableParams.TableName}`;
  this._logger.log('debug', tempString);

  tableParams.Item = data;
  this.docClient.put(
    tableParams,
    (putError, res) => {
      if (putError || !res) {
        callback(putError, null);
        return;
      }
      this._logger.log('info', queryString.blue, stopTimer(timerStart).bold.cyan);
      if (pKey !== undefined) {
        originalData.id = originalData[pKey];
        callback(null, originalData.id);
        return;
      }

      originalData.id = originalData[hashKey];
      callback(null, originalData.id);
    },
  );
}

module.exports = create;
