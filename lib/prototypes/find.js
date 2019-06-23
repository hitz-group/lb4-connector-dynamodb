// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const {
  startTimer,
  stopTimer,
  isEmpty,
} = require('../helper.js');

/**
 * Find an item based on hashKey alone
 * @param  {object}   model    [description]
 * @param  {object/primitive}   pKey   : If range key is undefined,
 *                                       this is the same as hash key. If range key is defined,
 *                                       then pKey is hashKey + (Separator) + rangeKey
 * @param  {Function} callback
 */
function find(model, pk, callback) {
  const timeStart = startTimer();
  const queryString = 'GET AN ITEM FROM TABLE ';
  const {
    hashKey,
    rangeKey,
    pKey,
    pkSeparator,
  } = this.allModels[model];

  let hk; let rk;
  if (pKey !== undefined) {
    const temp = pk.split(pkSeparator);
    [hk, rk] = temp;
    if (this._attributeSpecs[model][rangeKey] === 'number') {
      rk = parseInt(rk, 10);
    } else if (this._attributeSpecs[model][rangeKey] === 'date') {
      rk = Number(rk);
    }
  } else {
    hk = pk;
  }

  // If hashKey is of type Number use parseInt
  if (this._attributeSpecs[model][hashKey] === 'number') {
    hk = parseInt(hk, 10);
  } else if (this._attributeSpecs[model][hashKey] === 'date') {
    hk = Number(hk);
  }

  const tableParams = {};
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
      (err, res) => {
        if (err || !res) {
          callback(err, null);
        } else if (isEmpty(res)) {
          callback(null, null);
        } else {
          // Single object - > Array
          callback(null, res.Item);
          this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
        }
      },
    );
  }
}

module.exports = find;
