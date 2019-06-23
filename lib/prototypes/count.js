
/**
 * Get number of records matching a filter
 * @param  {Object}   model
 * @param  {Object}   where    : Filter
 * @param  {Function} callback
 * @return {Number}            : Number of matching records
 */
function count(model, where, callback) {
  const filter = {
    where,
  };
  this.all(model, filter, (err, results) => {
    if (err || !results) {
      callback(err, null);
    } else {
      callback(null, results.length);
    }
  });
}

module.exports = count;
