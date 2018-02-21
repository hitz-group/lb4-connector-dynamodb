module.exports = require('should');

const Schema = require('jugglingdb').Schema;

global.getSchema = function() {
  const db = new Schema(require('../'), {
    host: 'localhost',
    port: '8000',
    logLevel: 'info'
  });
  db.log = function(a) {
    console.log(a);
  };

  return db;
};
