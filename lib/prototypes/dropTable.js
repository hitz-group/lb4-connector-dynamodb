// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { startTimer, stopTimer } = require('../helper.js');

function dropTable(model, callback) {
  const timerStart = startTimer();
  const tbName = `TABLE ${model}`;

  const params = {
    TableName: model,
  };

  this._logger.log('info', `DELETING ${tbName} : in-progress`);

  this.client.deleteTable(params, (err, data) => {
    if (err) {
      this._logger.log('error', `Error occurred while DELETING ${tbName.red} ${stopTimer(timerStart).bold.cyan}\n${err}`);
      callback(err);
    } else {
      this._logger.log('info', `Successfully deleted ${tbName.blue} ${stopTimer(timerStart).bold.cyan}`);
      callback(null, data);
    }
  });
}

module.exports = dropTable;
