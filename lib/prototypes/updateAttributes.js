// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { startTimer, stopTimer } = require('../helper.js');

// FIXME: function not working
function updateAttributes(model, pk, d, callback) {
  const data = d;
  const timeStart = startTimer();
  const originalData = {};
  const {
    pKey,
    hashKey,
    rangeKey,
    pkSeparator,
  } = this.allModels[model];
  const tableParams = {};
  let tempHashKey;
  let tempRangeKey;

  // Copy all attrs from data to originalData
  let dataKeys = Object.keys(data);
  dataKeys.forEach((dataKey) => {
    originalData[dataKey] = data[dataKey];
  });

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

  // Log queryString
  let queryString = 'UPDATE ITEM IN TABLE ';

  // Use updateItem function of DynamoDB

  // Set table name as usual
  tableParams.TableName = this.tables(model);
  tableParams.Key = {};
  tableParams.AttributeUpdates = {};
  tableParams.ReturnConsumedCapacity = 'TOTAL';

  queryString += tableParams.TableName;

  // Add hashKey / rangeKey to tableParams
  if (pKey !== undefined) {
    const temp = pk.split(pkSeparator);
    [tempHashKey, tempRangeKey] = temp;
    tableParams.Key[this.allModels[model].hashKey] = tempHashKey;
    tableParams.Key[this.allModels[model].rangeKey] = tempRangeKey;
  } else {
    tableParams.Key[this.allModels[model].hashKey] = pk;
    tempHashKey = pk;
  }

  if (pKey !== undefined) {
    delete data[pKey];
  }
  // Add attrs to update

  dataKeys = Object.keys(data);
  dataKeys.forEach((dataKey) => {
    if (data[dataKey]
      && dataKey !== hashKey
      && dataKey !== rangeKey) {
      tableParams.AttributeUpdates[dataKey] = {};
      tableParams.AttributeUpdates[dataKey].Action = 'PUT';
      tableParams.AttributeUpdates[dataKey].Value = data[dataKey];
    }
  });

  tableParams.ReturnValues = 'ALL_NEW';
  this.docClient.update(
    tableParams,
    (updateError, res) => {
      if (updateError) {
        callback(updateError, null);
      } else if (!res) {
        callback(null, null);
      } else {
        callback(null, res.data);
      }
    },
  );

  this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
}

module.exports = updateAttributes;
