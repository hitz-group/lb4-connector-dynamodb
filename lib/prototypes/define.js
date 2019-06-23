// eslint-disable-next-line no-unused-vars
const colors = require('colors');
const { isArray } = require('util');
const {
  createTable,
  startTimer,
  stopTimer,
  AssignKeys,
} = require('../helper.js');

/**
 * Define schema and create table with hash and range keys
 * @param  {object} desc : description specified in the schema
 */
function define(desc) {
  // const _this = this;
  const descr = desc;
  const timeStart = startTimer();

  if (!descr.settings) descr.settings = {};

  const { modelName } = descr.model;
  const { emitter } = this;

  this.allModels[modelName] = descr;
  // Set Read & Write Capacity Units
  this.allModels[modelName].ReadCapacityUnits = descr.settings.ReadCapacityUnits || 5;
  this.allModels[modelName].WriteCapacityUnits = descr.settings.WriteCapacityUnits || 10;

  this.allModels[modelName].localIndexes = {};
  this.allModels[modelName].globalIndexes = {};

  let timeInterval; let
    tableStatusWait;
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
  const { properties } = descr;
  const LocalSecondaryIndexes = [];
  const GlobalSecondaryIndexes = [];

  // Iterate through properties and find index
  const tableParams = {
    AttributeDefinitions: [],
    KeySchema: [],
  };

  this._attributeSpecs[modelName] = {};

  /*
      Build KeySchema for the table based on schema definitions.
     */
  const propKeys = Object.keys(properties);
  propKeys.forEach((key) => {
    // Assign breakers, limits or whatever other properties
    // are specified first
    // Store the type of attributes in _attributeSpecs. This is
    // quite helpful to do Date & Boolean conversions later
    // on.
    const tempString = properties[key].type.toString();
    const aType = tempString.match(/\w+(?=\(\))/)[0].toLowerCase();

    this._attributeSpecs[modelName][key] = aType;

    // Check if UUID is set to be true for HASH KEY attribute
    if (properties[key].keyType === 'hash') {
      if (properties[key].uuid === true) {
        if (key !== 'id') {
          throw new Error('UUID generation is only allowed for attribute name id');
        } else {
          this.allModels[modelName].hashKeyUUID = true;
          this._logger.log('debug', 'Hash key UUID generation: TRUE');
        }
      } else {
        this.allModels[modelName].hashKeyUUID = false;
      }
    }
    // Following code is applicable only for keys
    if (properties[key].keyType !== undefined) {
      const attrs = AssignKeys(properties[key]);
      // The keys have come! Add to tableParams
      // Add Attribute Definitions
      // HASH primary key?
      if (attrs.keyType === 'hash') {
        this.allModels[modelName].hashKey = key;
        this._logger.log('debug', 'HASH KEY:', key);
        tableParams.KeySchema.push({
          AttributeName: key,
          KeyType: 'HASH',
        });
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType,
        });
      }
      // Range primary key?
      if (attrs.keyType === 'range') {
        this.allModels[modelName].rangeKey = key;
        this._logger.log('debug', 'RANGE KEY:', key);
        tableParams.KeySchema.push({
          AttributeName: key,
          KeyType: 'RANGE',
        });
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType,
        });
      }
      // Composite virtual primary key?
      if (attrs.keyType === 'pk') {
        this.allModels[modelName].pKey = key;
        this.allModels[modelName].pkSeparator = properties[key].separator || '--x--';
      }
    }

    if (properties[key].index !== undefined) {
      if (properties[key].index.local !== undefined) {
        const attrs = AssignKeys(properties[key]);
        const index = properties[key].index.local;
        const keyName = `${key}LocalIndex`;
        const localIndex = {
          IndexName: keyName,
          KeySchema: [
            {
              AttributeName: this.allModels[modelName].hashKey,
              KeyType: 'HASH',
            },
            {
              AttributeName: key,
              KeyType: 'RANGE',
            },
          ],
          Projection: {},
        };

        if (index.project) {
          if (isArray(index.project)) {
            localIndex.Projection = {
              ProjectionType: 'INCLUDE',
              NonKeyAttributes: index.project,
            };
          } else {
            localIndex.Projection = {
              ProjectionType: 'ALL',
            };
          }
        } else {
          localIndex.Projection = {
            ProjectionType: 'KEYS_ONLY',
          };
        }
        LocalSecondaryIndexes.push(localIndex);
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType,
        });
        this.allModels[modelName].localIndexes[key] = {
          hash: this.allModels[modelName].hashKey,
          range: key,
          IndexName: keyName,
        };
      }
      if (properties[key].index.global !== undefined) {
        const attrs = AssignKeys(properties[key]);
        const index = properties[key].index.global;
        const keyName = `${key}GlobalIndex`;
        const globalIndex = {
          IndexName: keyName,
          KeySchema: [
            {
              AttributeName: key,
              KeyType: 'HASH',
            },
            {
              AttributeName: index.rangeKey,
              KeyType: 'RANGE',
            },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: index.throughput.read || 5,
            WriteCapacityUnits: index.throughput.write || 10,
          },
        };

        if (index.project) {
          if (isArray(index.project)) {
            globalIndex.Projection = {
              ProjectionType: 'INCLUDE',
              NonKeyAttributes: index.project,
            };
          } else {
            globalIndex.Projection = {
              ProjectionType: 'ALL',
            };
          }
        } else {
          globalIndex.Projection = {
            ProjectionType: 'KEYS_ONLY',
          };
        }
        GlobalSecondaryIndexes.push(globalIndex);
        tableParams.AttributeDefinitions.push({
          AttributeName: key,
          AttributeType: attrs.attributeType,
        });
        this.allModels[modelName].globalIndexes[key] = {
          hash: key,
          range: index.rangeKey,
          IndexName: keyName,
        };
      }
    }
  });
  if (LocalSecondaryIndexes.length) {
    tableParams.LocalSecondaryIndexes = LocalSecondaryIndexes;
  }
  if (GlobalSecondaryIndexes.length) {
    tableParams.GlobalSecondaryIndexes = GlobalSecondaryIndexes;
  }

  tableParams.ProvisionedThroughput = {
    ReadCapacityUnits: this.allModels[modelName].ReadCapacityUnits,
    WriteCapacityUnits: this.allModels[modelName].WriteCapacityUnits,
  };
  this._logger.log('info', 'Read Capacity Units:', tableParams.ProvisionedThroughput.ReadCapacityUnits);
  this._logger.log('info', 'Write Capacity Units:', tableParams.ProvisionedThroughput.WriteCapacityUnits);

  if (this.allModels[modelName].rangeKey !== undefined
    && this.allModels[modelName].pKey !== undefined) {
    if (this.allModels[modelName].pKey !== 'id') {
      throw new Error('Primary Key must be named `id`');
    }
  }
  if (this.allModels[modelName].rangeKey !== undefined
    && this.allModels[modelName].pKey === undefined) {
    throw new Error('Range key is present, but primary key not specified in schema');
  }

  /*
      JugglingDB expects an id attribute in return even if a hash key is not specified. Hence
      if hash key is not defined in the schema, create an attribute called id, set it as hashkey.
     */
  if (this.allModels[modelName].hashKey === undefined && properties.id === undefined) {
    this.allModels[modelName].hashKey = 'id';
    this.allModels[modelName].hashKeyUUID = true;
    this._attributeSpecs[modelName][this.allModels[modelName].hashKey] = 'string';
    tableParams.KeySchema.push({
      AttributeName: 'id',
      KeyType: 'HASH',
    });
    tableParams.AttributeDefinitions.push({
      AttributeName: 'id',
      AttributeType: 'S',
    });
  }

  // If there are breakable attrs with sharding set to true, create the
  // extra tables now
  const _dynamodb = this.client;

  // Assign table name
  tableParams.TableName = descr.settings.table || modelName;
  this._logger.log('debug', 'Table Name:', tableParams.TableName);
  // Add this to _tables so that instance methods can use it.
  this.allTables[modelName] = tableParams.TableName;
  // Create main table function
  createTable.call(this, _dynamodb, tableParams, tableStatusWait, timeInterval, (err, data) => {
    if (err || !data) {
      const tempString = `while creating table: ${tableParams.TableName} => ${err.message.toString()}`;
      throw new Error(tempString);
    }

    this._logger.log('info', 'Defining model: ', modelName, stopTimer(timeStart).bold.cyan);
    emitter.emit('created', { tableParams });
  });
}

module.exports = define;
