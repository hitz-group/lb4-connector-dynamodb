// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { isEmpty } = require('../helper.js');

/**
 * Check if a given record exists
 * @param  {[type]}   model    [description]
 * @param  {[type]}   id       [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function exists(model, id, callback) {
  this.find(model, id, (err, record) => {
    if (err) {
      callback(err, null);
    } else if (isEmpty(record)) {
      callback(null, false);
    } else {
      callback(null, true);
    }
  });
}

module.exports = exists;
