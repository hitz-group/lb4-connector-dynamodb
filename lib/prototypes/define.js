'use strict';
var async = require('async');
var helper = require('../helper.js');

var query = helper.query;
var scan = helper.scan;
var createTable = helper.createTable;
var startTimer = helper.startTimer;
var stopTimer = helper.stopTimer;
var isEmpty = helper.isEmpty;
var AssignKeys = helper.AssignKeys;

/**
 * Define schema and create table with hash and range keys
 * @param  {object} descr : description specified in the schema
 */
function define(descr) {
  var _this = this;
  var timeStart = startTimer();
  if (!descr.settings) descr.settings = {};
  var modelName = descr.model.modelName;
  var emitter = this.emitter;
  this._models[modelName] = descr;
  // Set Read & Write Capacity Units
  this._models[modelName].ReadCapacityUnits = descr.settings.ReadCapacityUnits || 5;
  this._models[modelName].WriteCapacityUnits = descr.settings.WriteCapacityUnits || 10;

  this._models[modelName].localIndexes = {};
  this._models[modelName].globalIndexes = {};

  var timeInterval, tableStatusWait;
  // Wait for table to become active?
  if (descr.settings.tableStatus) {
    tableStatusWait = descr.settings.tableStatus.waitTillActive;
    if (tableStatusWait === undefined) {
      tableStatusWait = true;
    }
    timeInterval = descr.settings.tableStatus.timeInterval || 5000;
  } else {
    tableStatusWait = true;
    timeInterval = 5000;
  }

  // Create table now with the hash and range index.
  var properties = descr.properties;
  // Iterate through properties and find index
  var tableParams = {};
  tableParams.AttributeDefinitions = [];
  tableParams.KeySchema = [];
  let LocalSecondaryIndexes = [];
  let GlobalSecondaryIndexes = [];
  this._attributeSpecs[modelName] = {};
  // Temporary object to store read and write capacity units for breakable attrs
  var rcus = {};
  var wcus = {};

  /*
      Build KeySchema for the table based on schema definitions.
     */
  for (var key in properties) {
    // Assign breakers, limits or whatever other properties
    // are specified first
    // Store the type of attributes in _attributeSpecs. This is
    // quite helpful to do Date & Boolean conversions later
    // on.
    var tempString = properties[key].type.toString();
    var aType = tempString.match(/\w+(?=\(\))/)[0];
    aType = aType.toLowerCase();
    this._attributeSpecs[modelName][key] = aType;

    // Check if UUID is set to be true for HASH KEY attribute
    if (properties[key].keyType === 'hash') {
      if (properties[key].uuid === true) {
        if (key !== 'id') {
          throw new Error('UUID generation is only allowed for attribute name id');
        } else {
          this._models[modelName].hashKeyUUID = true;
          _this._logger.log('debug', 'Hash key UUID generation: TRUE');
        }
      } else {
        this._models[modelName].hashKeyUUID = false;
      }
    }
    // Following code is applicable only for keys
    if (properties[key].keyType !== undefined) {
      var attrs = AssignKeys(properties[key]);
      // The keys have come! Add to tableParams
      // Add Attribute Definitions
      // HASH primary key?
      if (attrs.keyType === 'hash') {
        this._models[modelName].hashKey = key;
        _this._logger.log('debug', 'HASH KEY:', key);
        tableParams.KeySchema.push({
          AttributeName: key,
          KeyType: 'HASH'
        });
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType
        });
      }
      // Range primary key?
      if (attrs.keyType === 'range') {
        this._models[modelName].rangeKey = key;
        _this._logger.log('debug', 'RANGE KEY:', key);
        tableParams.KeySchema.push({
          AttributeName: key,
          KeyType: 'RANGE'
        });
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType
        });
      }
      // Composite virtual primary key?
      if (attrs.keyType === 'pk') {
        this._models[modelName].pKey = key;
        this._models[modelName].pkSeparator = properties[key].separator || '--x--';
      }
    }

    if (properties[key].index !== undefined) {
      if (properties[key].index.local !== undefined) {
        var attrs = AssignKeys(properties[key]);
        let index = properties[key].index.local;
        let keyName = key + 'LocalIndex';
        let localIndex = {
          IndexName: keyName,
          KeySchema: [
            {
              AttributeName: this._models[modelName].hashKey,
              KeyType: 'HASH'
            },
            {
              AttributeName: key,
              KeyType: 'RANGE'
            }
          ],
          Projection: {}
        };

        if (index.project) {
          if (util.isArray(index.project)) {
            localIndex.Projection = {
              ProjectionType: 'INCLUDE',
              NonKeyAttributes: index.project
            };
          } else {
            localIndex.Projection = {
              ProjectionType: 'ALL'
            };
          }
        } else {
          localIndex.Projection = {
            ProjectionType: 'KEYS_ONLY'
          };
        }
        LocalSecondaryIndexes.push(localIndex);
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType
        });
        this._models[modelName].localIndexes[key] = {
          hash: this._models[modelName].hashKey,
          range: key,
          IndexName: keyName
        };
      }
      if (properties[key].index.global !== undefined) {
        var attrs = AssignKeys(properties[key]);
        let index = properties[key].index.global;
        let keyName = key + 'GlobalIndex';
        var globalIndex = {
          IndexName: keyName,
          KeySchema: [
            {
              AttributeName: key,
              KeyType: 'HASH'
            },
            {
              AttributeName: index.rangeKey,
              KeyType: 'RANGE'
            }
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: index.throughput.read || 5,
            WriteCapacityUnits: index.throughput.write || 10
          }
        };

        if (index.project) {
          if (util.isArray(index.project)) {
            globalIndex.Projection = {
              ProjectionType: 'INCLUDE',
              NonKeyAttributes: index.project
            };
          } else {
            globalIndex.Projection = {
              ProjectionType: 'ALL'
            };
          }
        } else {
          globalIndex.Projection = {
            ProjectionType: 'KEYS_ONLY'
          };
        }
        GlobalSecondaryIndexes.push(localIndex);
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType
        });
        this._models[modelName].globalIndexes[key] = {
          hash: key,
          range: index.rangeKey,
          IndexName: keyName
        };
      }
    }
  }
  if (LocalSecondaryIndexes.length) {
    tableParams.LocalSecondaryIndexes = LocalSecondaryIndexes;
  }
  if (GlobalSecondaryIndexes.length) {
    tableParams.GlobalSecondaryIndexes = GlobalSecondaryIndexes;
  }

  tableParams.ProvisionedThroughput = {
    ReadCapacityUnits: this._models[modelName].ReadCapacityUnits,
    WriteCapacityUnits: this._models[modelName].WriteCapacityUnits
  };
  _this._logger.log('info', 'Read Capacity Units:', tableParams.ProvisionedThroughput.ReadCapacityUnits);
  _this._logger.log('info', 'Write Capacity Units:', tableParams.ProvisionedThroughput.WriteCapacityUnits);

  if (this._models[modelName].rangeKey !== undefined && this._models[modelName].pKey !== undefined) {
    if (this._models[modelName].pKey !== 'id') {
      throw new Error('Primary Key must be named `id`');
    }
  }
  if (this._models[modelName].rangeKey !== undefined && this._models[modelName].pKey === undefined) {
    throw new Error('Range key is present, but primary key not specified in schema');
  }

  /*
      JugglingDB expects an id attribute in return even if a hash key is not specified. Hence
      if hash key is not defined in the schema, create an attribute called id, set it as hashkey.
     */
  if (this._models[modelName].hashKey === undefined && properties.id === undefined) {
    this._models[modelName].hashKey = 'id';
    this._models[modelName].hashKeyUUID = true;
    this._attributeSpecs[modelName][this._models[modelName].hashKey] = 'string';
    tableParams.KeySchema.push({
      AttributeName: 'id',
      KeyType: 'HASH'
    });
    tableParams.AttributeDefinitions.push({
      AttributeName: 'id',
      AttributeType: 'S'
    });
  }

  // If there are breakable attrs with sharding set to true, create the
  // extra tables now
  var _dynamodb = this.client;
  var attributeSpecs = this._attributeSpecs[modelName];
  var ReadCapacityUnits = this._models[modelName].ReadCapacityUnits;
  var WriteCapacityUnits = this._models[modelName].WriteCapacityUnits;
  var hashKey = this._models[modelName].hashKey;
  var pKey = this._models[modelName].pKey;

  // Assign table name
  tableParams.TableName = descr.settings.table || modelName;
  _this._logger.log('debug', 'Table Name:', tableParams.TableName);
  // Add this to _tables so that instance methods can use it.
  this._tables[modelName] = tableParams.TableName;
  // Create main table function
  createTable.call(this, _dynamodb, tableParams, tableStatusWait, timeInterval, function (err, data) {
    if (err || !data) {
      var tempString = 'while creating table: ' + tableParams.TableName + ' => ' + err.message.toString();
      throw new Error(tempString);
    } else {
    }
    _this._logger.log('info', 'Defining model: ', modelName, stopTimer(timeStart).bold.cyan);
    emitter.emit('created', { tableParams });
  }.bind(this));
};

module.exports = define;
