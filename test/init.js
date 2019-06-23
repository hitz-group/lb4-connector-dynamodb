module.exports = require('should');

const { Schema } = require('jugglingdb');

global.getSchema = () => {
  const db = new Schema(require('../'), {
    host: 'localhost',
    port: '9800',
    region: 'ap-southeast-1',
    loggers: ['console'],
    logLevel: 'debug',
  });
  db.log = (a) => {
    console.log(a);
  };

  return db;
};
