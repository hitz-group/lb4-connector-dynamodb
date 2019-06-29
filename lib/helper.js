const async = require('async');

/**
  Record current time in milliseconds
*/
function startTimer() {
  return new Date().getTime();
}

/**
  Given start time, return a string containing time difference in ms
*/
function stopTimer(timeStart) {
  return `[${String(new Date().getTime() - timeStart)} ms]`;
}

function KeyOperatorLookup(operator) {
  let value;
  switch (operator) {
    case '=':
      value = '=';
      break;
    case 'lt':
      value = '<';
      break;
    case 'lte':
      value = '<=';
      break;
    case 'gt':
      value = '>';
      break;
    case 'gte':
      value = '>=';
      break;
    case 'between':
      value = 'BETWEEN';
      break;
    default:
      value = '=';
      break;
  }
  return value;
}

/**
 * Converts jugglingdb operators like 'gt' to DynamoDB form 'GT'
 * @param {string} DynamoDB comparison operator
 */
function OperatorLookup(operator) {
  let dynOperator = operator;

  if (operator === 'inq') {
    dynOperator = 'in';
  } else if (operator === 'gte') {
    dynOperator = 'ge';
  } else if (operator === 'lte') {
    dynOperator = 'le';
  }

  return dynOperator.toUpperCase();
}

function countProperties(obj) {
  return Object.keys(obj).length;
}

function TypeLookup(typestring) {
  switch (typestring) {
    case 'string':
      return 'S';
    case 'number':
      return 'N';
    case 'boolean':
      return 'S';
    case 'date':
      return 'N';
    default:
      break;
  }
}

function ReverseTypeLookup(typestring) {
  switch (typestring) {
    case 'date':
      return 'N';
    default:
      break;
  }

  if (typestring === 'S') {
    return 'string';
  }

  if (typestring === 'N') {
    return 'number';
  }

  return 'string';
}

/**
 * Helper function to convert a regular model
 * object to DynamoDB JSON notation.
 *
 * e.g 20 will be returned as { 'N': '20' }
 * & `foobar` will be returned as { 'S' : 'foobar' }
 *
 * Usage
 * - objToDB(20);
 * - objToDB("foobar");
 * ----------------------------------------------
 *
 * @param  {object} data to be converted
 * @return {object} DynamoDB compatible JSON object
 */
function objToDB(data) {
  const tempObj = {};
  const elementType = this.TypeLookup(typeof (data));
  tempObj[elementType] = data.toString();
  return tempObj;
}

/**
 * Helper function to convert a DynamoDB type
 * object into regular model object.
 *
 * e.g { 'N': '20' } will be returned as 20
 * & { 'S' : 'foobar' }  will be returned as `foobar`
 *
 * @param  {object} data
 * @return {object}
 */
function objFromDB(data) {
  const { hasOwnProperty } = Object.prototype;
  let tempObj;

  Object.keys(data).forEach((key) => {
    if (hasOwnProperty(data, key)) {
      const elementType = this.ReverseTypeLookup(key);
      if (elementType === 'string') {
        tempObj = data[key];
      } else if (elementType === 'number') {
        tempObj = Number(data[key]);
      } else {
        tempObj = data[key];
      }
    }
  });

  return tempObj;
}

/**
 * Slice a string into N different strings
 * @param  {String} str : The string to be chunked
 * @param  {Number} N   : Number of pieces into which the string must be broken
 * @return {Array}  Array of N strings
 */
function splitSlice(str, N) {
  const ret = [];
  const strLen = str.length;
  if (strLen === 0) {
    return ret;
  }

  const len = Math.floor(strLen / N) + 1;
  const residue = strLen % len;
  let offset = 0;
  for (let index = 1; index < N; index += 1) {
    const subString = str.slice(offset, len + offset);
    ret.push(subString);
    offset += len;
  }
  ret.push(str.slice(offset, residue + offset));

  return ret;
}

/**
 * Chunks data and assigns it to the data object
 * @param {Object} data : Complete data object
 * @param {String} key  : Attribute to be chunked
 * @param {Number} N    : Number of chunks
 */
function ChunkMe(data, key, N) {
  const newData = [];

  // Call splitSlice to chunk the data
  const chunkedData = splitSlice(data[key], N);

  // Assign each element in the chunked data to data.
  for (let counter = 1; counter <= N; counter += 1) {
    const tempObj = {};
    const chunkKeyName = key;
    // DynamoDB does not allow empty strings.
    // So filter out empty strings
    if (chunkedData[counter - 1] !== '') {
      tempObj[chunkKeyName] = chunkedData[counter - 1];
      newData.push(tempObj);
    }
  }

  // eslint-disable-next-line no-param-reassign
  delete data[key];

  // Finally delete data[key]
  return newData;
}

/**
 * Builds back a chunked object stored in the
 * database to its normal form
 * @param {Object} data : Object to be rebuilt
 * @param {String} key  : Name of the field in the object
 */
function BuildMeBack(obj, breakKeys) {
  const data = obj;
  let counter;
  let currentName;
  let finalObject;

  breakKeys.forEach((breakKey) => {
    counter = 1;
    finalObject = '';

    Object.keys(data).forEach(() => {
      currentName = `${breakKey}-${String(counter)}`;
      if (data[currentName]) {
        finalObject += data[currentName];
        delete data[currentName];
        counter += 1;
      }
    });

    data[breakKey] = finalObject;
  });

  return data;
}

/*
See http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 */
function UUID() {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // eslint-disable-next-line no-bitwise
    const r = Math.random() * 16 | 0;

    // eslint-disable-next-line no-mixed-operators, no-bitwise
    const v = c === 'x' ? r : (r & 0x3 | 0x8);

    return v.toString(16);
  });

  return uuid;
}

function GetMyChildrenBack(obj, model, pKey, breakables, dynamodb, OuterCallback) {
  const data = obj;
  // Iterate over breakables. Query using data's hashKey
  const hashKeyAttribute = `${model.toLowerCase()}#${pKey}`;
  /*
  Use async series to fetch each breakable attribute in series.
   */
  async.mapSeries(breakables, (breakable, callback) => {
    const params = {
      TableName: `${model}_${breakable}`,
      KeyConditions: {
        [hashKeyAttribute]: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{
            S: String(data[pKey]),
          }],
        },
      },
    };

    dynamodb.query(params, (err, res) => {
      if (err) {
        callback(err, null);
        return;
      }

      let callbackData = '';
      res.Items.forEach((item) => {
        callbackData += item[breakable].S;
      });

      callback(null, callbackData);
    });
  }, (err, results) => {
    if (err) {
      OuterCallback(err, null);
    } else {
      // results array will contain an array of built back attribute values.
      for (let i = 0; i < results.length; i += 1) {
        data[breakables[i]] = results[i];
      }
      OuterCallback(null, data);
    }
  });
}

function SortByKey(array, key, order) {
  return array.sort((a, b) => {
    let x = a[key];
    let y = b[key];

    if (typeof x === 'string') {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }

    if (order === 1) {
      if (x < y) {
        return -1;
      }
      return ((x > y) ? 1 : 0);
    }

    if (x < y) {
      return 1;
    }

    return ((x > y) ? -1 : 0);
  });
}

/**
 * Function that performs query operation on dynamodb
 * @param  {object} model
 * @param  {object} filter             : Query filter
 * @param  {Number/String} hashKey     : Hash Key
 * @param  {object} rangeKey           : Range Key
 * @param  {String} queryString        : The query string (used for console logs)
 * @param  {Number} timeStart          : Start time of query operation in milliseconds
 * @return {object}                    : Final query object to be sent to dynamodb
 */
function getQueryTableParams(modelName, reqFilter, model, qs, timeStart) {
  const filter = reqFilter || {};
  let queryString = qs;
  // Table parameters to do the query/scan
  const {
    hashKey,
    rangeKey,
    localIndexes: localKeys,
    globalIndexes: globalKeys,
  } = model;
  const tableParams = {};

  // Construct query for amazon DynamoDB
  // Set queryFilter to empty object
  tableParams.ExpressionAttributeNames = {};
  tableParams.ExpressionAttributeValues = {};
  tableParams.KeyConditionExpression = '';

  const ExpressionAttributeNames = {};
  const KeyConditionExpression = [];
  const FilterExpression = [];
  // const ExpressionAttributeValues = {};

  // If a where clause exists in the query, extract
  // the conditions from it.
  if (filter.where) {
    queryString += ' WHERE ';
    const keys = Object.keys(filter.where);
    keys.forEach((key) => {
      let condition = filter.where[key];

      let keyName = `#${key.slice(0, 1).toUpperCase()}`;
      if (tableParams.ExpressionAttributeNames[keyName] === undefined) {
        tableParams.ExpressionAttributeNames[keyName] = key;
      } else {
        let i = 1;
        while (tableParams.ExpressionAttributeNames[keyName] !== undefined) {
          keyName = `#${key.slice(0, i)}`;
          i += 1;
        }
        keyName = `#${key.slice(0, i).toUpperCase()}`;
        tableParams.ExpressionAttributeNames[keyName] = key;
      }

      ExpressionAttributeNames[key] = keyName;

      const valueExpression = `:${key}`;

      if (
        key === hashKey
        || (globalKeys[key] && globalKeys[key].hash === key)
        || (localKeys[key] && localKeys[key].hash === key)
      ) {
        // eslint-disable-next-line no-empty
        if (condition && condition.constructor.name === 'Object') {
          // eslint-disable-next-line no-empty
        } else if (condition && condition.constructor.name === 'Array') {
        } else {
          KeyConditionExpression[0] = `${keyName} = ${valueExpression}`;
          tableParams.ExpressionAttributeValues[valueExpression] = condition;
          if (globalKeys[key] && globalKeys[key].hash === key) {
            tableParams.IndexName = globalKeys[key].IndexName;
          } else if (localKeys[key] && localKeys[key].hash === key) {
            tableParams.IndexName = localKeys[key].IndexName;
          }
        }
      } else if (
        key === rangeKey
        || (globalKeys[key] && globalKeys[key].range === key)
        || (localKeys[key] && localKeys[key].range === key)
      ) {
        if (condition && condition.constructor.name === 'Object') {
          const insideKey = Object.keys(condition)[0];
          condition = condition[insideKey];
          const operator = KeyOperatorLookup(insideKey);
          if (operator === 'BETWEEN') {
            // eslint-disable-next-line prefer-destructuring
            tableParams.ExpressionAttributeValues[`${valueExpression}_start`] = condition[0];
            // eslint-disable-next-line prefer-destructuring
            tableParams.ExpressionAttributeValues[`${valueExpression}_end`] = condition[1];
            KeyConditionExpression[1] = `${keyName} ${operator} ${valueExpression}_start`
              + ` AND ${valueExpression}_end`;
          } else {
            tableParams.ExpressionAttributeValues[valueExpression] = condition;
            KeyConditionExpression[1] = `${keyName} ${operator} ${valueExpression}`;
          }
        } else if (condition && condition.constructor.name === 'Array') {
          // eslint-disable-next-line prefer-destructuring
          tableParams.ExpressionAttributeValues[`${valueExpression}_start`] = condition[0];
          // eslint-disable-next-line prefer-destructuring
          tableParams.ExpressionAttributeValues[`${valueExpression}_end`] = condition[1];
          KeyConditionExpression[1] = `${keyName} BETWEEN ${valueExpression}_start`
            + ` AND ${valueExpression}_end`;
        } else {
          tableParams.ExpressionAttributeValues[valueExpression] = condition;
          KeyConditionExpression[1] = `${keyName} = ${valueExpression}`;
        }

        if (globalKeys[key] && globalKeys[key].range === key) {
          tableParams.IndexName = globalKeys[key].IndexName;
        } else if (localKeys[key] && localKeys[key].range === key) {
          tableParams.IndexName = localKeys[key].IndexName;
        }
      } else if (condition && condition.constructor.name === 'Object') {
        const insideKey = Object.keys(condition)[0];
        condition = condition[insideKey];
        const operator = KeyOperatorLookup(insideKey);
        if (operator === 'BETWEEN') {
          // eslint-disable-next-line prefer-destructuring
          tableParams.ExpressionAttributeValues[`${valueExpression}_start`] = condition[0];
          // eslint-disable-next-line prefer-destructuring
          tableParams.ExpressionAttributeValues[`${valueExpression}_end`] = condition[1];
          FilterExpression.push(`${keyName} ${operator} ${valueExpression}_start`
            + ` AND ${valueExpression}_end`);
        } else if (operator === 'IN') {
          tableParams.ExpressionAttributeValues[valueExpression] = `(${condition.join(',')})`;
          FilterExpression.push(`${keyName} ${operator} ${valueExpression}`);
        } else {
          tableParams.ExpressionAttributeValues[valueExpression] = condition;
          FilterExpression.push(`${keyName} ${operator} ${valueExpression}`);
        }
      } else if (condition && condition.constructor.name === 'Array') {
        tableParams.ExpressionAttributeValues[valueExpression] = `(${condition.join(',')})`;
        FilterExpression.push(`${keyName} IN ${valueExpression}`);
      } else {
        tableParams.ExpressionAttributeValues[valueExpression] = condition;
        FilterExpression.push(`${keyName} = ${valueExpression}`);
      }
    });

    tableParams.KeyConditionExpression = KeyConditionExpression.join(' AND ');
    if (countProperties(tableParams.ExpressionAttributeNames)
      > countProperties(KeyConditionExpression)) {
      tableParams.FilterExpression = `${FilterExpression.join(' AND ')}`;
    }
  }
  queryString = `${queryString} WITH QUERY OPERATION `;
  this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
  return tableParams;
}

/**
 * Builds table parameters for scan operation
 * @param  {[type]} model       Model object
 * @param  {[type]} filter      Filter
 * @param  {[type]} queryString String that holds query operation actions
 * @param  {[type]} timeStart   start time of operation
 */
function getScanTableParams(model, reqFilter, qs, timeStart) {
  // Table parameters to do the query/scan
  const tableParams = {
    ScanFilter: {}, // Set scanFilter to empty object
  };
  // Define the filter if it does not exist
  const filter = reqFilter || {};
  // Initialize query as an empty object
  const query = {};
  let queryString = qs;
  // If a where clause exists in the query, extract
  // the conditions from it.
  if (filter.where) {
    queryString = `${queryString} WHERE `;
    Object.keys(filter.where).forEach((key) => {
      let condition = filter.where[key];
      // If condition is of type object, obtain key
      // and the actual condition on the key
      // In jugglingdb, `where` can have the following
      // forms.
      // 1) where : { key: value }
      // 2) where : { startTime : { gt : Date.now() } }
      // 3) where : { someKey : ["something","nothing"] }
      // condition now holds value in case 1),
      //  { gt: Date.now() } in case 2)
      // ["something, "nothing"] in case 3)
      let insideKey = null;
      if (condition && condition.constructor.name === 'Object') {
        this._logger.log('debug', 'Condition Type => Object', 'Operator', insideKey, 'Condition Value:', condition);
        [insideKey] = Object.keys(condition);
        condition = condition[insideKey];
        // insideKey now holds gt and condition now holds Date.now()
        query[key] = {
          operator: OperatorLookup(insideKey),
          attrs: condition,
        };
      } else if (condition && condition.constructor.name === 'Array') {
        this._logger.log('debug', 'Condition Type => Array', 'Operator', insideKey, 'Condition Value:', condition);
        query[key] = {
          operator: 'IN',
          attrs: condition,
        };
      } else {
        this._logger.log('debug', 'Condition Type => Equality', 'Condition Value:', condition);
        query[key] = {
          operator: 'EQ',
          attrs: condition,
        };
      }
      tableParams.ScanFilter[key] = {};
      tableParams.ScanFilter[key].ComparisonOperator = query[key].operator;
      tableParams.ScanFilter[key].AttributeValueList = [];

      const attrResult = query[key].attrs;

      if (attrResult instanceof Array) {
        this._logger.log('debug', 'Attribute Value list is an array');
        tableParams.ScanFilter[key].AttributeValueList = query[key].attrs;
      } else {
        tableParams.ScanFilter[key].AttributeValueList.push(query[key].attrs);
      }

      queryString = `${queryString}\`${String(key)}\` ${String(query[key].operator)} \`${String(query[key].attrs)}\``;
    });
  }
  queryString = `${queryString} WITH SCAN OPERATION `;
  this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);

  return tableParams;
}

/*
  Assign Attribute Definitions
  and KeySchema based on the keys
*/
function AssignKeys(name) {
  const tempString = name.type.toString();
  const aType = tempString.match(/\w+(?=\(\))/)[0].toLowerCase();

  const attr = {
    keyType: name.keyType,
    attributeType: TypeLookup(aType),
  };

  return attr;
}

/**
 * Create a table based on hashkey, rangekey specifications
 * @param  {object} dynamodb        : adapter
 * @param  {object} tableParams     : KeySchema & other attrs
 * @param {Boolean} tableStatusWait : If true, wait for table to become active
 * @param {Number} timeInterval     : Check table status after `timeInterval` milliseconds
 * @param {function} callback       : Callback function
 */
function createTable(dynamodb, tableParams, tableStatusWait, timeInterval, callback) {
  let tableExists = false;
  let tableStatusFlag = false;
  dynamodb.listTables((errListTables, data) => {
    if (errListTables || !data) {
      this._logger.log(
        'error',
        '-------Error while fetching tables from server. Please check your connection settings & AWS config--------',
      );
      callback(errListTables, null);
      return;
    }

    // Boolean variable to check if table already exists.
    const existingTableNames = data.TableNames;
    existingTableNames.forEach((existingTableName) => {
      if (tableParams.TableName === existingTableName) {
        tableExists = true;
        this._logger.log('info', `TABLE ${existingTableName} FOUND IN DATABASE`);
      }
    });

    // if table exists, do not create new table
    if (tableExists !== false) {
      callback(null, 'done');
      return;
    }

    const tableName = tableParams.TableName;
    // DynamoDB will throw error saying table does not exist
    this._logger.log('info', `CREATING TABLE: ${tableName} IN DYNAMODB`);

    dynamodb.createTable(
      tableParams,
      (errCreateTable, dataCreateTable) => {
        if (errCreateTable || !dataCreateTable) {
          callback(errCreateTable, null);
          return;
        }

        this._logger.log('info', `TABLE CREATED: ${tableName}`);

        if (!tableStatusWait) {
          return;
        }

        async.whilst(
          (innerCallback) => {
            innerCallback(null, !tableStatusFlag);
          },
          (innerCallback) => {
            this._logger.log('info', `Checking Table Status: ${tableName}`);
            dynamodb.describeTable(
              {
                TableName: tableParams.TableName,
              },
              (err, tableData) => {
                if (err) {
                  innerCallback(err);
                } else if (tableData.Table.TableStatus === 'ACTIVE') {
                  this._logger.log('info', `Table Status ${tableName} is 'ACTIVE'`);
                  tableStatusFlag = true;
                  innerCallback(null);
                } else {
                  setTimeout(innerCallback, timeInterval);
                }
              },
            );
          },
          (err) => {
            if (err) {
              callback(err, null);
            } else {
              callback(null, 'active');
            }
          },
        );
      },
    );
  });
}

// Check if object is empty
function isEmpty(obj) {
  const { hasOwnProperty } = Object.prototype;
  // null and undefined are "empty"
  if (obj === null) return true;
  if (typeof (obj) === 'undefined') return true;

  // Assume if it has a length property with a non-zero value
  // that that property is correct.
  if (obj.length > 0) return false;
  if (obj.length === 0) return true;

  // Otherwise, does it have any properties of its own?
  // Note that this doesn't handle
  // toString and valueOf enumeration bugs in IE < 9
  return Object.keys(obj).some((key) => {
    if (hasOwnProperty.call(obj, key)) {
      return false;
    }

    return true;
  });
}

module.exports = {
  TypeLookup,
  ReverseTypeLookup,
  objToDB,
  objFromDB,
  splitSlice,
  ChunkMe,
  BuildMeBack,
  UUID,
  GetMyChildrenBack,
  SortByKey,
  query: getQueryTableParams,
  scan: getScanTableParams,
  AssignKeys,
  startTimer,
  stopTimer,
  createTable,
  isEmpty,
};
