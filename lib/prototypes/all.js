'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;

/**
 *  Uses Amazon DynamoDB query/scan function to fetch all
 *  matching entries in the table.
 *
 */
function all(model, filter, callback) {
  var _this = this;
  var timeStart = startTimer();
  var queryString = 'GET ALL ITEMS FROM TABLE ';

  // If limit is specified, use it to limit results
  var limitObjects;
  if (filter && filter.limit) {
    if (typeof filter.limit !== 'number') {
      callback(new Error('Limit must be a number in Model.all function'), null);
      return;
    }
    limitObjects = filter.limit;
  }

  // Order, default by hash key or id
  var orderByField;
  var args = {};
  if (this._models[model].rangeKey === undefined) {
    orderByField = this._models[model].hashKey;
    args[orderByField] = 1;
  } else {
    orderByField = 'id';
    args['id'] = 1;
  }
  // Custom ordering
  if (filter && filter.order) {
    var keys = filter.order;
    if (typeof keys === 'string') {
      keys = keys.split(',');
    }

    for (var index in keys) {
      var m = keys[index].match(/\s+(A|DE)SC$/);
      var keyA = keys[index];
      keyA = keyA.replace(/\s+(A|DE)SC$/, '').trim();
      orderByField = keyA;
      if (m && m[1] === 'DE') {
        args[keyA] = -1;
      } else {
        args[keyA] = 1;
      }
    }
  }

  // Skip , Offset
  var offset;
  if (filter && filter.offset) {
    if (typeof filter.offset !== 'number') {
      callback(new Error('Offset must be a number in Model.all function'), null);
      return;
    }
    offset = filter.offset;
  } else if (filter && filter.skip) {
    if (typeof filter.skip !== 'number') {
      callback(new Error('Skip must be a number in Model.all function'), null);
      return;
    }
    offset = filter.skip;
  }

  queryString = queryString + String(this.tables(model));
  // If hashKey is present in where filter, use query
  var hashKeyFound = false;
  if (filter && filter.where) {
    for (var key in filter.where) {
      if (key === this._models[model].hashKey) {
        hashKeyFound = true;
        _this._logger.log('debug', 'Hash Key Found, QUERY operation will be used');
      }
    }
  }

  // Check if an array of hash key values are provided. If yes, use scan.
  // Otherwise use query. This is because query does not support array of
  // hash key values
  if (hashKeyFound === true) {
    var condition = filter.where[this._models[model].hashKey];
    var insideKey = null;
    if (
      (condition && condition.constructor.name === 'Object') ||
      (condition && condition.constructor.name === 'Array')
    ) {
      insideKey = Object.keys(condition)[0];
      condition = condition[insideKey];
      if (condition instanceof Array) {
        hashKeyFound = false;
        _this._logger.log('debug', 'Hash key value is an array. Using SCAN operation instead');
      }
    }
  }

  // If true use query function
  if (hashKeyFound === true) {
    var tableParams = query.call(this, model, filter, this._models[model], queryString, timeStart);
    // Set table name based on model
    tableParams.TableName = this.tables(model);
    tableParams.ReturnConsumedCapacity = 'TOTAL';

    var attributeSpecs = this._attributeSpecs[model];
    var LastEvaluatedKey = 'junk';
    var queryResults = [];
    var finalResult = [];
    var hashKey = this._models[model].hashKey;
    var docClient = this.docClient;
    var pKey = this._models[model].pKey;
    var pkSeparator = this._models[model].pkSeparator;
    var rangeKey = this._models[model].rangeKey;
    tableParams.ExclusiveStartKey = undefined;
    var modelObj = this._models[model];
    // If KeyConditions exist, then call DynamoDB query function
    if (tableParams.KeyConditionExpression) {
      async.doWhilst(
        function (queryCallback) {
          _this._logger.log('debug', 'Query issued');
          docClient.query(
            tableParams,
            function (err, res) {
              if (err || !res) {
                queryCallback(err);
              } else {
                // Returns an array of objects. Pass each one to
                // JSONFromDynamo and push to empty array
                LastEvaluatedKey = res.LastEvaluatedKey;
                if (LastEvaluatedKey !== undefined) {
                  _this._logger.log('debug', 'LastEvaluatedKey found. Refetching..');
                  tableParams.ExclusiveStartKey = LastEvaluatedKey;
                }

                queryResults = queryResults.concat(res.Items);
                queryCallback();
              }
            }.bind(_this)
          );
        },
        function (innerCallback) {
          return innerCallback(null, LastEvaluatedKey !== undefined);
        },
        function (err) {
          if (err) {
            callback(err, null);
          } else {
            if (offset !== undefined) {
              _this._logger.log('debug', 'Offset by', offset);
              queryResults = queryResults.slice(offset, limitObjects + offset);
            }
            if (limitObjects !== undefined) {
              _this._logger.log('debug', 'Limit by', limitObjects);
              queryResults = queryResults.slice(0, limitObjects);
            }
            _this._logger.log('debug', 'Sort by', orderByField, 'Order:', args[orderByField] > 0 ? 'ASC' : 'DESC');
            queryResults = helper.SortByKey(queryResults, orderByField, args[orderByField]);
            if (filter && filter.include) {
              _this._logger.log('debug', 'Model includes', filter.include);
              modelObj.model.include(queryResults, filter.include, callback);
            } else {
              _this._logger.log('debug', 'Query results complete');
              callback(null, queryResults);
            }
          }
        }.bind(_this)
      );
    }
  } else {
    // Call scan function
    var tableParams = scan.call(this, model, filter, queryString, timeStart);
    tableParams.TableName = this.tables(model);
    tableParams.ReturnConsumedCapacity = 'TOTAL';
    var attributeSpecs = this._attributeSpecs[model];
    var finalResult = [];
    var hashKey = this._models[model].hashKey;
    var pKey = this._models[model].pKey;
    var pkSeparator = this._models[model].pkSeparator;
    var rangeKey = this._models[model].rangeKey;
    var LastEvaluatedKey = 'junk';
    var queryResults = [];
    var docClient = this.docClient;
    tableParams.ExclusiveStartKey = undefined;
    var modelObj = this._models[model];
    // Scan DynamoDB table
    async.doWhilst(
      function (queryCallback) {
        docClient.scan(
          tableParams,
          function (err, res) {
            if (err || !res) {
              queryCallback(err);
            } else {
              LastEvaluatedKey = res.LastEvaluatedKey;
              if (LastEvaluatedKey !== undefined) {
                tableParams.ExclusiveStartKey = LastEvaluatedKey;
              }
              queryResults = queryResults.concat(res.Items);
              queryCallback();
            }
          }.bind(this)
        );
      },
      function (innerCallback) {
        return innerCallback(null, LastEvaluatedKey !== undefined);
      },
      function (err) {
        if (err) {
          callback(err, null);
        } else {
          if (offset !== undefined) {
            _this._logger.log('debug', 'Offset by', offset);
            queryResults = queryResults.slice(offset, limitObjects + offset);
          }
          if (limitObjects !== undefined) {
            _this._logger.log('debug', 'Limit by', limitObjects);
            queryResults = queryResults.slice(0, limitObjects);
          }
          _this._logger.log('debug', 'Sort by', orderByField, 'Order:', args[orderByField] > 0 ? 'ASC' : 'DESC');
          queryResults = helper.SortByKey(queryResults, orderByField, args[orderByField]);
          if (filter && filter.include) {
            _this._logger.log('debug', 'Model includes', filter.include);
            modelObj.model.include(queryResults, filter.include, callback);
          } else {
            callback(null, queryResults);
            _this._logger.log('debug', 'Query complete');
          }
        }
      }
    );
  }
}

module.exports = all;
