module.exports = require('should');

const Schema = require('jugglingdb').Schema;

global.getSchema = function () {
  const db = new Schema(require('../'), {
    host: 'localhost',
    port: '9800',
    region: 'ap-southeast-1',
    loggers: ['console'],
    logLevel: 'error',
  });
  db.log = function (a) {
    console.log(a);
  };

  return db;
};
