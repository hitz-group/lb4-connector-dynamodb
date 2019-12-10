// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { startTimer, stopTimer } = require('../helper.js');

function destroy(model, pk, callback) {
  const timeStart = startTimer();
  const { hashKey } = this.allModels[model];
  const { rangeKey } = this.allModels[model];
  const { pKey } = this.allModels[model];
  const { pkSeparator } = this.allModels[model];
  // const queryString = `DELETING ${pk} FROM TABLE: ${this.tables(model)}`;

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

  // Use updateItem function of DynamoDB
  const tableParams = {};
  // Set table name as usual
  tableParams.TableName = this.tables(model);
  tableParams.Key = {};
  // Add hashKey to tableParams
  tableParams.Key[this.allModels[model].hashKey] = hk;

  if (pKey !== undefined) {
    tableParams.Key[this.allModels[model].rangeKey] = rk;
  }

  tableParams.ReturnValues = 'ALL_OLD';

  (this.daxClient || this.docClient).delete(
    tableParams,
    (err, res) => {
      if (err) {
        callback(err, null);
      } else if (!res) {
        callback(null, null);
      } else {
        // Attributes is an object
        const tempString = `DELETE ITEM FROM TABLE ${tableParams.TableName} WHERE ${hashKey} \`EQ\` ${String(hk)}`;
        this._logger.log('info', tempString.blue, stopTimer(timeStart).bold.cyan);
        callback(null, res.Attributes);
      }
    },
  );
}

module.exports = destroy;
