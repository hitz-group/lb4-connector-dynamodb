// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const async = require('async');
const {
  SortByKey,
  query,
  scan,
  startTimer,
} = require('../helper.js');

/**
 *  Uses Amazon DynamoDB query/scan function to fetch all
 *  matching entries in the table.
 *
 */
function all(model, filter, callback) {
  const timeStart = startTimer();
  let queryString = 'GET ALL ITEMS FROM TABLE ';

  // If limit is specified, use it to limit results
  let limitObjects;
  if (filter && filter.limit) {
    if (typeof filter.limit !== 'number') {
      callback(new Error('Limit must be a number in Model.all function'), null);
      return;
    }
    limitObjects = filter.limit;
  }

  // Order, default by hash key or id
  let orderByField;
  const args = {};
  if (this.allModels[model].rangeKey === undefined) {
    orderByField = this.allModels[model].hashKey;
    args[orderByField] = 1;
  } else {
    orderByField = 'id';
    args.id = 1;
  }
  // Custom ordering
  if (filter && filter.order) {
    let keys = filter.order;
    if (typeof keys === 'string') {
      keys = keys.split(',');
    }

    keys.forEach((key) => {
      const match = key.match(/\s+(A|DE)SC$/);
      const keyA = key.replace(/\s+(A|DE)SC$/, '').trim();
      orderByField = keyA;
      if (match && match[1] === 'DE') {
        args[keyA] = -1;
      } else {
        args[keyA] = 1;
      }
    });
  }

  // Skip , Offset
  let offset;
  if (filter && filter.offset) {
    if (typeof filter.offset !== 'number') {
      callback(new Error('Offset must be a number in Model.all function'), null);
      return;
    }
    // eslint-disable-next-line prefer-destructuring
    offset = filter.offset;
  } else if (filter && filter.skip) {
    if (typeof filter.skip !== 'number') {
      callback(new Error('Skip must be a number in Model.all function'), null);
      return;
    }
    offset = filter.skip;
  }

  queryString += String(this.tables(model));
  // If hashKey is present in where filter, use query
  let hashKeyFound = false;
  if (filter && filter.where) {
    const whereKeys = Object.keys(filter.where);
    whereKeys.forEach((whereKey) => {
      if (whereKey === this.allModels[model].hashKey) {
        hashKeyFound = true;
        this._logger.log('debug', 'Hash Key Found, QUERY operation will be used');
      }
    });
  }

  // Check if an array of hash key values are provided. If yes, use scan.
  // Otherwise use query. This is because query does not support array of
  // hash key values
  if (hashKeyFound === true) {
    let condition = filter.where[this.allModels[model].hashKey];
    let insideKey = null;
    if (
      (condition && condition.constructor.name === 'Object')
      || (condition && condition.constructor.name === 'Array')
    ) {
      [insideKey] = Object.keys(condition);
      condition = condition[insideKey];
      if (condition instanceof Array) {
        hashKeyFound = false;
        this._logger.log('debug', 'Hash key value is an array. Using SCAN operation instead');
      }
    }
  }

  // If true use query function
  if (hashKeyFound === true) {
    const tableParams = query.call(this,
      model,
      filter,
      this.allModels[model],
      queryString,
      timeStart);

    // Set table name based on model
    tableParams.TableName = this.tables(model);
    tableParams.ReturnConsumedCapacity = 'TOTAL';

    let lastEvaluatedKey = 'junk';
    let queryResults = [];
    const { docClient } = this;
    // let {
    //   hashKey,
    //   pKey,
    //   pkSeparator,
    //   rangeKey,
    // } = this.allModels[model];
    const modelObj = this.allModels[model];
    tableParams.ExclusiveStartKey = undefined;
    // If KeyConditions exist, then call DynamoDB query function
    if (tableParams.KeyConditionExpression) {
      async.doWhilst(
        (queryCallback) => {
          this._logger.log('debug', 'Query issued');
          docClient.query(
            tableParams,
            (err, res) => {
              if (err || !res) {
                queryCallback(err);
              } else {
                // Returns an array of objects. Pass each one to
                // JSONFromDynamo and push to empty array
                lastEvaluatedKey = res.LastEvaluatedKey;
                if (lastEvaluatedKey !== undefined) {
                  this._logger.log('debug', 'LastEvaluatedKey found. Refetching..');
                  tableParams.ExclusiveStartKey = lastEvaluatedKey;
                }

                queryResults = queryResults.concat(res.Items);
                queryCallback();
              }
            },
          );
        },
        innerCallback => (innerCallback(null, lastEvaluatedKey !== undefined)),
        ((err) => {
          if (err) {
            callback(err, null);
          } else {
            if (offset !== undefined) {
              this._logger.log('debug', 'Offset by', offset);
              queryResults = queryResults.slice(offset, limitObjects + offset);
            }
            if (limitObjects !== undefined) {
              this._logger.log('debug', 'Limit by', limitObjects);
              queryResults = queryResults.slice(0, limitObjects);
            }
            this._logger.log('debug', 'Sort by', orderByField, 'Order:', args[orderByField] > 0 ? 'ASC' : 'DESC');
            queryResults = SortByKey(queryResults, orderByField, args[orderByField]);
            if (filter && filter.include) {
              this._logger.log('debug', 'Model includes', filter.include);
              modelObj.model.include(queryResults, filter.include, callback);
            } else {
              this._logger.log('debug', 'Query results complete');
              callback(null, queryResults);
            }
          }
        }),
      );
    }
  } else {
    // Call scan function
    const tableParams = scan.call(this, model, filter, queryString, timeStart);
    tableParams.TableName = this.tables(model);
    tableParams.ReturnConsumedCapacity = 'TOTAL';
    tableParams.ExclusiveStartKey = undefined;

    // var { hashKey } = this.allModels[model];
    // var { pKey } = this.allModels[model];
    // var { pkSeparator } = this.allModels[model];
    // var { rangeKey } = this.allModels[model];
    let lastEvaluatedKey = 'junk';
    let queryResults = [];
    const { docClient } = this;
    const modelObj = this.allModels[model];
    // Scan DynamoDB table
    async.doWhilst(
      (queryCallback) => {
        docClient.scan(
          tableParams,
          (err, res) => {
            if (err || !res) {
              queryCallback(err);
            } else {
              lastEvaluatedKey = res.LastEvaluatedKey;
              if (lastEvaluatedKey !== undefined) {
                tableParams.ExclusiveStartKey = lastEvaluatedKey;
              }
              queryResults = queryResults.concat(res.Items);
              queryCallback();
            }
          },
        );
      },
      innerCallback => innerCallback(null, lastEvaluatedKey !== undefined),
      (err) => {
        if (err) {
          callback(err, null);
        } else {
          if (offset !== undefined) {
            this._logger.log('debug', 'Offset by', offset);
            queryResults = queryResults.slice(offset, limitObjects + offset);
          }
          if (limitObjects !== undefined) {
            this._logger.log('debug', 'Limit by', limitObjects);
            queryResults = queryResults.slice(0, limitObjects);
          }
          this._logger.log('debug', 'Sort by', orderByField, 'Order:', args[orderByField] > 0 ? 'ASC' : 'DESC');
          queryResults = SortByKey(queryResults, orderByField, args[orderByField]);
          if (filter && filter.include) {
            this._logger.log('debug', 'Model includes', filter.include);
            modelObj.model.include(queryResults, filter.include, callback);
          } else {
            callback(null, queryResults);
            this._logger.log('debug', 'Query complete');
          }
        }
      },
    );
  }
}

module.exports = all;
