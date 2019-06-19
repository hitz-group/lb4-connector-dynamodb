module.exports = require('should');

const Schema = require('jugglingdb').Schema;

global.getSchema = function() {
  const db = new Schema(require('../'), {
    host: 'localhost',
    port: '8000',
    logLevel: 'info',
    region: 'ap-southeast-1'
  });
  db.log = function(a) {
    console.log(a);
  };

  return db;
};
