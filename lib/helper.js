var async = require('async');
var colors = require('colors');

/**
 * Creates a DynamoDB compatible representation
 * of arrays, objects and primitives.
 * @param {object} data: Object to be converted
 * @return {object} DynamoDB compatible JSON
 */
function DynamoFromJSON(data) {
  var obj;
  /*
      If data is an array, loop through each member
      of the array, and call objToDB on the element
      e.g ["someword",20] --> [ {'S': 'someword'} , {'N' : '20'}]
     */
  if (data instanceof Array) {
    obj = [];
    data.forEach(function (dataElement) {
      // If string is empty, assign it as
      // "null".
      if (dataElement === '') {
        dataElement = 'empty';
      }
      if (dataElement instanceof Date) {
        dataElement = Number(dataElement);
      }
      obj.push(objToDB(dataElement));
    });
  } else if (data instanceof Object && data instanceof Date !== true) {
    /*
      If data is an object, loop through each member
      of the object, and call objToDB on the element
      e.g { age: 20 } --> { age: {'N' : '20'} }
     */
    obj = {};
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        // If string is empty, assign it as
        // "null".
        if (data[key] === undefined) {
          data[key] = 'undefined';
        }
        if (data[key] === null) {
          data[key] = 'null';
        }
        if (data[key] === '') {
          data[key] = 'empty';
        }
        // If Date convert to number
        if (data[key] instanceof Date) {
          data[key] = Number(data[key]);
        }
        obj[key] = objToDB(data[key]);
      }
    }
    /*
    If data is a number, or string call objToDB on the element
    e.g 20 --> {'N' : '20'}
   */
  } else {
    // If string is empty, assign it as
    // "empty".
    if (data === null) {
      data = 'null';
    }
    if (data === undefined) {
      data = 'undefined';
    }
    if (data === '') {
      data = 'empty';
    }
    // If Date convert to number
    if (data instanceof Date) {
      data = Number(data);
    }
    obj = objToDB(data);
  }
  return obj;
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
  if (operator === 'inq') {
    operator = 'in';
  }
  else if (operator === 'gte') {
    operator = 'ge';
  }
  else if (operator === 'lte') {
    operator = 'le';
  } return operator.toUpperCase();
}

function countProperties(obj) {
  return Object.keys(obj).length;
}

function TypeLookup(typestring) {
  switch (typestring) {
    case "string":
      return 'S';
    case "number":
      return 'N';
    case "boolean":
      return 'S';
    case "date":
      return 'N';
    default:
      break;
  }
}

function ReverseTypeLookup(typestring) {
  switch (typestring) {
    case "date":
      return 'N';
    default:
      break;
  }
  if (typestring === 'S') {
    return "string";
  } else if (typestring === 'N') {
    return "number";
  } else {
    return "string";
  }
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
  var tempObj = {};
  var elementType = this.TypeLookup(typeof (data));
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
  var tempObj;
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      var elementType = this.ReverseTypeLookup(key);
      if (elementType === "string") {
        tempObj = data[key];
      } else if (elementType === "number") {
        tempObj = Number(data[key]);
      } else {
        tempObj = data[key];
      }
    }
  }
  return tempObj;
}

/**
 * Slice a string into N different strings
 * @param  {String} str : The string to be chunked
 * @param  {Number} N   : Number of pieces into which the string must be broken
 * @return {Array}  Array of N strings
 */
function splitSlice(str, N) {
  var ret = [];
  var strLen = str.length;
  if (strLen === 0) {
    return ret;
  } else {
    var len = Math.floor(strLen / N) + 1;
    var residue = strLen % len;
    var offset = 0;
    for (var index = 1; index < N; index++) {
      var subString = str.slice(offset, len + offset);
      ret.push(subString);
      offset = offset + len;
    }
    ret.push(str.slice(offset, residue + offset));
    return ret;
  }
}

/**
 * Chunks data and assigns it to the data object
 * @param {Object} data : Complete data object
 * @param {String} key  : Attribute to be chunked
 * @param {Number} N    : Number of chunks
 */
function ChunkMe(data, key, N) {
  var counter;
  var newData = [];
  //Call splitSlice to chunk the data
  var chunkedData = this.splitSlice(data[key], N);
  //Assign each element in the chunked data
  //to data.
  for (counter = 1; counter <= N; counter++) {
    var tempObj = {};
    var chunkKeyName = key;
    // DynamoDB does not allow empty strings.
    // So filter out empty strings
    if (chunkedData[counter - 1] !== "") {
      tempObj[chunkKeyName] = chunkedData[counter - 1];
      newData.push(tempObj);
    }
  }
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
function BuildMeBack(data, breakKeys) {
  var counter;
  var currentName;
  var finalObject;
  breakKeys.forEach(function (breakKey) {
    counter = 1;
    finalObject = "";
    for (var key in data) {
      currentName = breakKey + "-" + String(counter);
      if (data[currentName]) {
        finalObject = finalObject + data[currentName];
        delete data[currentName];
        counter++;
      }
    }
    data[breakKey] = finalObject;
  });
  return data;
}

/*
See http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 */
function UUID() {
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  return uuid;
}

function GetMyChildrenBack(data, model, pKey, breakables, dynamodb, OuterCallback) {
  // Iterate over breakables. Query using data's hashKey
  var hashKeyAttribute = model.toLowerCase() + "#" + pKey;
  /*
  Use async series to fetch each breakable attribute in series.
   */
  async.mapSeries(breakables, function (breakable, callback) {
    var params = {};
    params.KeyConditions = {};
    params.KeyConditions[hashKeyAttribute] = {};
    params.KeyConditions[hashKeyAttribute].ComparisonOperator = 'EQ';
    params.KeyConditions[hashKeyAttribute].AttributeValueList = [];
    params.KeyConditions[hashKeyAttribute].AttributeValueList.push({
      'S': String(data[pKey])
    });
    params.TableName = model + "_" + breakable;
    dynamodb.query(params, function (err, res) {
      if (err) {
        return callback(err, null);
      } else {
        var callbackData = "";
        res.Items.forEach(function (item) {
          callbackData = callbackData + item[breakable]['S'];
        });
        callback(null, callbackData);
      }
    }.bind(this));
  }, function (err, results) {
    if (err) {
      OuterCallback(err, null);
    } else {
      // results array will contain an array of built back attribute values.
      for (i = 0; i < results.length; i++) {
        data[breakables[i]] = results[i];
      }
      OuterCallback(null, data);
    }
  }.bind(this));
}

function SortByKey(array, key, order) {
  return array.sort(function (a, b) {
    var x = a[key];
    var y = b[key];

    if (typeof x == "string") {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }
    if (order === 1) {
      return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    } else {
      return ((x < y) ? 1 : ((x > y) ? -1 : 0));
    }

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
function query(modelName, filter, model, queryString, timeStart) {
  var _this = this;
  // Table parameters to do the query/scan
  let hashKey = model.hashKey;
  let rangeKey = model.rangeKey;
  let localKeys = model.localIndexes;
  let globalKeys = model.globalIndexes;

  var tableParams = {};
  // Define the filter if it does not exist
  if (!filter) {
    filter = {};
  }
  // Initialize query as an empty object
  var queryObj = {};
  // Construct query for amazon DynamoDB
  // Set queryfileter to empty object
  tableParams.ExpressionAttributeNames = {};
  let ExpressionAttributeNames = {};
  tableParams.ExpressionAttributeValues = {};
  tableParams.KeyConditionExpression = '';

  let KeyConditionExpression = [];
  let FilterExpression = [];
  let ExpressionAttributeValues = {};

  // If a where clause exists in the query, extract
  // the conditions from it.
  if (filter.where) {
    queryString = queryString + ' WHERE ';
    for (var key in filter.where) {
      var condition = filter.where[key];

      let keyName = '#' + key.slice(0, 1).toUpperCase();
      if (tableParams.ExpressionAttributeNames[keyName] == undefined) {
        tableParams.ExpressionAttributeNames[keyName] = key;
      } else {
        let i = 1;
        while (tableParams.ExpressionAttributeNames[keyName] != undefined) {
          keyName = '#' + key.slice(0, i);
          i++;
        }
        keyName = '#' + key.slice(0, i).toUpperCase();
        tableParams.ExpressionAttributeNames[keyName] = key;
      }

      ExpressionAttributeNames[key] = keyName;

      var ValueExpression = ':' + key;
      var insideKey = null;

      if (
        key === hashKey ||
        (globalKeys[key] && globalKeys[key].hash === key) ||
        (localKeys[key] && localKeys[key].hash === key)
      ) {
        if (condition && condition.constructor.name === 'Object') {
        } else if (condition && condition.constructor.name === 'Array') {
        } else {
          KeyConditionExpression[0] = keyName + ' = ' + ValueExpression;
          tableParams.ExpressionAttributeValues[ValueExpression] = condition;
          if (globalKeys[key] && globalKeys[key].hash === key) {
            tableParams.IndexName = globalKeys[key].IndexName;
          } else if (localKeys[key] && localKeys[key].hash === key) {
            tableParams.IndexName = localKeys[key].IndexName;
          }
        }
      } else if (
        key === rangeKey ||
        (globalKeys[key] && globalKeys[key].range === key) ||
        (localKeys[key] && localKeys[key].range === key)
      ) {
        if (condition && condition.constructor.name === 'Object') {
          insideKey = Object.keys(condition)[0];
          condition = condition[insideKey];
          let operator = KeyOperatorLookup(insideKey);
          if (operator === 'BETWEEN') {
            tableParams.ExpressionAttributeValues[ValueExpression + '_start'] = condition[0];
            tableParams.ExpressionAttributeValues[ValueExpression + '_end'] = condition[1];
            KeyConditionExpression[1] =
              keyName + ' ' + operator + ' ' + ValueExpression + '_start' + ' AND ' + ValueExpression + '_end';
          } else {
            tableParams.ExpressionAttributeValues[ValueExpression] = condition;
            KeyConditionExpression[1] = keyName + ' ' + operator + ' ' + ValueExpression;
          }
        } else if (condition && condition.constructor.name === 'Array') {
          tableParams.ExpressionAttributeValues[ValueExpression + '_start'] = condition[0];
          tableParams.ExpressionAttributeValues[ValueExpression + '_end'] = condition[1];
          KeyConditionExpression[1] =
            keyName + ' BETWEEN ' + ValueExpression + '_start' + ' AND ' + ValueExpression + '_end';
        } else {
          tableParams.ExpressionAttributeValues[ValueExpression] = condition;
          KeyConditionExpression[1] = keyName + ' = ' + ValueExpression;
        }

        if (globalKeys[key] && globalKeys[key].range === key) {
          tableParams.IndexName = globalKeys[key].IndexName;
        } else if (localKeys[key] && localKeys[key].range === key) {
          tableParams.IndexName = localKeys[key].IndexName;
        }
      } else {
        if (condition && condition.constructor.name === 'Object') {
          insideKey = Object.keys(condition)[0];
          condition = condition[insideKey];
          let operator = KeyOperatorLookup(insideKey);
          if (operator === 'BETWEEN') {
            tableParams.ExpressionAttributeValues[ValueExpression + '_start'] = condition[0];
            tableParams.ExpressionAttributeValues[ValueExpression + '_end'] = condition[1];
            FilterExpression.push(
              keyName + ' ' + operator + ' ' + ValueExpression + '_start' + ' AND ' + ValueExpression + '_end'
            );
          } else if (operator === 'IN') {
            tableParams.ExpressionAttributeValues[ValueExpression] = '(' + condition.join(',') + ')';
            FilterExpression.push(keyName + ' ' + operator + ' ' + ValueExpression);
          } else {
            tableParams.ExpressionAttributeValues[ValueExpression] = condition;
            FilterExpression.push(keyName + ' ' + operator + ' ' + ValueExpression);
          }
        } else if (condition && condition.constructor.name === 'Array') {
          tableParams.ExpressionAttributeValues[ValueExpression] = '(' + condition.join(',') + ')';
          FilterExpression.push(keyName + ' IN ' + ValueExpression);
        } else {
          tableParams.ExpressionAttributeValues[ValueExpression] = condition;
          FilterExpression.push(keyName + ' = ' + ValueExpression);
        }
      }

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
      /*
              If key is of hash or hash & range type,
              we can use the query function of dynamodb
              to access the table. This saves a lot of time
              since it does not have to look at all records
            */
      // var insideKey = null;
      // if (condition && condition.constructor.name === 'Object') {
      //   insideKey = Object.keys(condition)[0];
      //   condition = condition[insideKey];

      //   _this._logger.log("debug","Condition Type => Object", "Operator", insideKey, "Condition Value:", condition);
      //   // insideKey now holds gt and condition now holds Date.now()
      //   queryObj[key] = {
      //     operator: OperatorLookup(insideKey),
      //     attrs: condition
      //   };
      // } else if (condition && condition.constructor.name === "Array") {
      //   _this._logger.log("debug", "Condition Type => Array", "Opearator", "IN", "Condition Value:", condition);
      //   queryObj[key] = {
      //     operator: 'IN',
      //     attrs: condition
      //   };
      // } else {
      //   _this._logger.log("debug", "Condition Type => Equality", "Condition Value:", condition);
      //   queryObj[key] = {
      //     operator: 'EQ',
      //     attrs: condition
      //   };
      // }

      // if (key === hashKey) {
      //   // Add hashkey eq condition to keyconditions
      //   tableParams.KeyConditions[key] = {};
      //   tableParams.KeyConditions[key].ComparisonOperator = queryObj[key].operator;
      //   // For hashKey only 'EQ' operator is allowed. Issue yellow error. DB will
      //   // throw a red error.
      //   if (queryObj[key].operator !== 'EQ') {
      //     var errString = "Warning: Only equality condition is allowed on HASHKEY";
      //     _this._logger.log("warn", errString.yellow);
      //   }
      //   tableParams.KeyConditions[key].AttributeValueList = [];
      //   tableParams.KeyConditions[key].AttributeValueList.push(queryObj[key].attrs); // incorporated document client
      //   //tableParams.KeyConditions[key].AttributeValueList.push(DynamoFromJSON(queryObj[key].attrs));
      //   queryString = queryString + " HASHKEY: `" + String(key) + "` " + String(queryObj[key].operator) + " `" + String(queryObj[key].attrs) + "`";
      // } else if (key === rangeKey) {
      //   // Add hashkey eq condition to keyconditions
      //   tableParams.KeyConditions[key] = {};
      //   tableParams.KeyConditions[key].ComparisonOperator = queryObj[key].operator;
      //   tableParams.KeyConditions[key].AttributeValueList = [];

      //   var attrResult = queryObj[key].attrs;
      //   //var attrResult = DynamoFromJSON(queryObj[key].attrs);
      //   if (attrResult instanceof Array) {
      //     _this._logger.log("debug", "Attribute Value list is an array");
      //     tableParams.KeyConditions[key].AttributeValueList = queryObj[key].attrs; // incorporated document client
      //     //tableParams.KeyConditions[key].AttributeValueList = DynamoFromJSON(queryObj[key].attrs);
      //   } else {
      //     tableParams.KeyConditions[key].AttributeValueList.push(queryObj[key].attrs); // incorporated document client
      //     //tableParams.KeyConditions[key].AttributeValueList.push(DynamoFromJSON(queryObj[key].attrs));
      //   }

      //   queryString = queryString + "& RANGEKEY: `" + String(key) + "` " + String(queryObj[key].operator) + " `" + String(queryObj[key].attrs) + "`";
      // } else {
      //   tableParams.QueryFilter[key] = {};
      //   tableParams.QueryFilter[key].ComparisonOperator = queryObj[key].operator;
      //   tableParams.QueryFilter[key].AttributeValueList = [];

      //   var attrResult = queryObj[key].attrs;
      //   //var attrResult = DynamoFromJSON(queryObj[key].attrs);
      //   if (attrResult instanceof Array) {
      //     tableParams.QueryFilter[key].AttributeValueList = queryObj[key].attrs; // incorporated document client
      //     //tableParams.QueryFilter[key].AttributeValueList = DynamoFromJSON(queryObj[key].attrs);
      //   } else {
      //     tableParams.QueryFilter[key].AttributeValueList.push(queryObj[key].attrs); // incorporated document client
      //     //tableParams.QueryFilter[key].AttributeValueList.push(DynamoFromJSON(queryObj[key].attrs));
      //   }
      //   queryString = queryString + "& `" + String(key) + "` " + String(queryObj[key].operator) + " `" + String(queryObj[key].attrs) + "`";
      // }
    }
    tableParams.KeyConditionExpression = KeyConditionExpression.join(' AND ');
    if (countProperties(tableParams.ExpressionAttributeNames) > countProperties(KeyConditionExpression)) {
      //tableParams.FilterExpression = "";
      tableParams.FilterExpression = '' + FilterExpression.join(' AND ');
    }
  }
  queryString = queryString + ' WITH QUERY OPERATION ';
  _this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);
  return tableParams;
}

/**
 * Builds table parameters for scan operation
 * @param  {[type]} model       Model object
 * @param  {[type]} filter      Filter
 * @param  {[type]} queryString String that holds query operation actions
 * @param  {[type]} timeStart   start time of operation
 */
function scan(model, filter, queryString, timeStart) {
  var _this = this;
  // Table parameters to do the query/scan
  var tableParams = {};
  // Define the filter if it does not exist
  if (!filter) {
    filter = {};
  }
  // Initialize query as an empty object
  var query = {};
  // Set scanfilter to empty object
  tableParams.ScanFilter = {};
  // If a where clause exists in the query, extract
  // the conditions from it.
  if (filter.where) {
    queryString = queryString + ' WHERE ';
    for (var key in filter.where) {
      var condition = filter.where[key];
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
      var insideKey = null;
      if (condition && condition.constructor.name === 'Object') {
        _this._logger.log('debug', 'Condition Type => Object', 'Operator', insideKey, 'Condition Value:', condition);
        insideKey = Object.keys(condition)[0];
        condition = condition[insideKey];
        // insideKey now holds gt and condition now holds Date.now()
        query[key] = {
          operator: OperatorLookup(insideKey),
          attrs: condition
        };
      } else if (condition && condition.constructor.name === 'Array') {
        _this._logger.log('debug', 'Condition Type => Array', 'Operator', insideKey, 'Condition Value:', condition);
        query[key] = {
          operator: 'IN',
          attrs: condition
        };
      } else {
        _this._logger.log('debug', 'Condition Type => Equality', 'Condition Value:', condition);
        query[key] = {
          operator: 'EQ',
          attrs: condition
        };
      }
      tableParams.ScanFilter[key] = {};
      tableParams.ScanFilter[key].ComparisonOperator = query[key].operator;
      tableParams.ScanFilter[key].AttributeValueList = [];

      var attrResult = query[key].attrs;
      //var attrResult = DynamoFromJSON(query[key].attrs);

      if (attrResult instanceof Array) {
        _this._logger.log('debug', 'Attribute Value list is an array');
        tableParams.ScanFilter[key].AttributeValueList = query[key].attrs;
        //tableParams.ScanFilter[key].AttributeValueList = DynamoFromJSON(query[key].attrs);
      } else {
        tableParams.ScanFilter[key].AttributeValueList.push(query[key].attrs);
        //tableParams.ScanFilter[key].AttributeValueList.push(DynamoFromJSON(query[key].attrs));
      }

      queryString =
        queryString + '`' + String(key) + '` ' + String(query[key].operator) + ' `' + String(query[key].attrs) + '`';
    }
  }
  queryString = queryString + ' WITH SCAN OPERATION ';
  _this._logger.log('info', queryString.blue, stopTimer(timeStart).bold.cyan);

  return tableParams;
}

/*
  Assign Attribute Definitions
  and KeySchema based on the keys
*/
function AssignKeys(name, type, settings) {
  var attr = {};
  var tempString;
  var aType;

  attr.keyType = name.keyType;
  tempString = name.type.toString();
  aType = tempString.match(/\w+(?=\(\))/)[0];
  aType = aType.toLowerCase();
  attr.attributeType = TypeLookup(aType);
  return attr;
}

/**
  Record current time in milliseconds
*/
function startTimer() {
  let timeNow = new Date().getTime();
  return timeNow;
}

/**
  Given start time, return a string containing time difference in ms
*/
function stopTimer(timeStart) {
  return '[' + String(new Date().getTime() - timeStart) + ' ms]';
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
  var _this = this;

  var tableExists = false;
  var tableStatusFlag = false;
  dynamodb.listTables(function (err, data) {
    if (err || !data) {
      _this._logger.log(
        'error',
        '-------Error while fetching tables from server. Please check your connection settings & AWS config--------'
      );
      callback(err, null);
      return;
    } else {
      // Boolean variable to check if table already exists.
      var existingTableNames = data.TableNames;
      existingTableNames.forEach(function (existingTableName) {
        if (tableParams.TableName === existingTableName) {
          tableExists = true;
          _this._logger.log('info', 'TABLE %s FOUND IN DATABASE', existingTableName);
        }
      });
      // If table exists do not create new table
      if (tableExists === false) {
        // DynamoDB will throw error saying table does not exist
        _this._logger.log('info', 'CREATING TABLE: %s IN DYNAMODB', tableParams.TableName);
        dynamodb.createTable(
          tableParams,
          function (err, data) {
            if (err || !data) {
              callback(err, null);
              return;
            } else {
              _this._logger.log('info', 'TABLE CREATED');
              if (tableStatusWait) {
                async.whilst(
                  function (innerCallback) {
                    innerCallback(null, !tableStatusFlag);
                  },
                  function (innerCallback) {
                    _this._logger.log('info', 'Checking Table Status');
                    dynamodb.describeTable(
                      {
                        TableName: tableParams.TableName
                      },
                      function (err, tableData) {
                        if (err) {
                          innerCallback(err);
                        } else if (tableData.Table.TableStatus === 'ACTIVE') {
                          _this._logger.log('info', 'Table Status is `ACTIVE`');
                          tableStatusFlag = true;
                          innerCallback(null);
                        } else {
                          setTimeout(innerCallback, timeInterval);
                        }
                      }
                    );
                  },
                  function (err) {
                    if (err) {
                      callback(err, null);
                    } else {
                      callback(null, 'active');
                    }
                  }.bind(this)
                );
              }
            } // successful response
          }.bind(this)
        );
      } else {
        callback(null, 'done');
      }
    }
  });
}

// Check if object is empty
function isEmpty(obj) {
  var hasOwnProperty = Object.prototype.hasOwnProperty;
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
  for (var key in obj) {
    if (hasOwnProperty.call(obj, key)) return false;
  }

  return true;
}

module.exports = {
  TypeLookup: TypeLookup,
  ReverseTypeLookup: ReverseTypeLookup,
  objToDB: objToDB,
  objFromDB: objFromDB,
  splitSlice: splitSlice,
  ChunkMe: ChunkMe,
  BuildMeBack: BuildMeBack,
  UUID: UUID,
  GetMyChildrenBack: GetMyChildrenBack,
  SortByKey: SortByKey,

  query: query,
  scan: scan,
  AssignKeys: AssignKeys,
  startTimer: startTimer,
  stopTimer: stopTimer,
  createTable: createTable,
  isEmpty: isEmpty,
};
