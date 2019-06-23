const { Connector } = require('loopback-connector');
const AWS = require('aws-sdk');
const { EventEmitter } = require('events');
const {
  createLogger, format, config, transports,
} = require('winston');
const util = require('util');

const DocClient = AWS.DynamoDB.DocumentClient;

// NOTE: It doesn't include sharding or auto partitioning of items above 400kb


/**
 * The constructor for MongoDB connector
 * @param {Object} settings The settings object
 * @constructor
 */
function DynamoDB(s) {
  if (!AWS) {
    throw new Error('AWS SDK not installed. Please run npm install aws-sdk');
  }
  this.name = 'dynamodb';
  this.allModels = {};
  this.allTables = {};
  this._attributeSpecs = [];
  const logger = createLogger({
    levels: config.npm.levels,
    // transports: []
  });

  if (s.loggers) {
    const logLevel = s.logLevel || 'debug';

    if (s.loggers.indexOf('console') >= 0) {
      logger.add(new transports.Console({
        level: logLevel,
        format: format.combine(
          format.colorize(),
          format.simple(),
        ),
      }));
    }

    if (s.loggers.indexOf('file') >= 0) {
      logger.add(new transports.File({
        filename: 'logs/dynamodb.log',
        maxSize: 1024 * 1024 * 5,
        level: logLevel,
      }));
    }
  }

  logger.info('Initializing dynamodb adapter');

  // Connect to dynamodb server
  let dynamodb;

  // Try to read accessKeyId and secretAccessKey from environment variables
  if (
    process.env.AWS_ACCESS_KEY_ID !== undefined
    && process.env.AWS_SECRET_ACCESS_KEY !== undefined
  ) {
    logger.log('debug', 'Credentials selected from environment variables');
    const awsRegion = s.region || process.env.AWS_REGION;
    AWS.config.update({
      region: awsRegion,
      maxRetries: s.maxRetries,
    });
    dynamodb = new AWS.DynamoDB();
  } else {
    logger.log('warn', 'Credentials not found in environment variables');
    try {
      AWS.config.loadFromPath('credentials.json');
      logger.log('info', 'Loading credentials from file');
      dynamodb = new AWS.DynamoDB();
    } catch (e) {
      logger.log('warn', 'Cannot find credentials file');
      logger.log('info', 'Using settings from schema');
      AWS.config.update({
        accessKeyId: s.accessKeyId,
        secretAccessKey: s.secretAccessKey,
        region: s.region,
        maxRetries: s.maxRetries,
      });
      dynamodb = new AWS.DynamoDB({
        endpoint: new AWS.Endpoint(`http://${s.host}:${s.port}`),
      });
      logger.log('info', `DynamoDB Connecting to ${dynamodb.endpoint.href}`);
    }
  }

  this.client = dynamodb; // Used by instance methods
  this.docClient = new DocClient({
    service: dynamodb,
  });

  this.emitter = new EventEmitter();
  this._logger = logger;
}

util.inherits(DynamoDB, Connector);

/**
 * Initialize the DynamoDB connector for the given data source
 *
 * @param {DataSource} ds The data source instance
 * @param {Function} [cb] The cb function
 */
exports.initialize = function initializeSchema(ds, cb) {
  // s stores the ds settings
  const s = ds.settings;
  const dataSource = ds;

  if (ds.settings) {
    s.host = ds.settings.host;
    s.port = ds.settings.port;
    s.maxRetries = ds.settings.maxRetries;
    s.region = ds.settings.region;
    s.accessKeyId = ds.settings.accessKeyId;
    s.secretAccessKey = ds.settings.secretAccessKey;
  }

  // if any of them are not configured properly in ds.settings
  s.host = s.host || 'localhost';
  s.port = s.port || 8000;
  s.maxRetries = s.maxRetries || 0;

  // prioritizing the AWS_ configuration from ENV VARS before setting default values
  s.region = s.region || process.env.AWS_REGION;
  s.accessKeyId = s.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  s.secretAccessKey = s.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

  dataSource.adapter = new DynamoDB(s, ds);
  dataSource.adapter.dataSource = ds;

  if (cb) {
    cb();
  }
};

DynamoDB.prototype.define = require('./prototypes/define.js');
DynamoDB.prototype.defineProperty = require('./prototypes/defineProperty.js');
DynamoDB.prototype.tables = require('./prototypes/tables.js');
DynamoDB.prototype.updateAttributes = require('./prototypes/updateAttributes.js');
DynamoDB.prototype.defineForeignKey = require('./prototypes/defineForeignKey.js');

DynamoDB.prototype.all = require('./prototypes/all.js');
DynamoDB.prototype.find = require('./prototypes/find.js');
DynamoDB.prototype.count = require('./prototypes/count.js');
DynamoDB.prototype.exists = require('./prototypes/exists.js');

DynamoDB.prototype.create = require('./prototypes/create.js');
DynamoDB.prototype.save = require('./prototypes/save.js');

DynamoDB.prototype.destroy = require('./prototypes/destroy.js');
DynamoDB.prototype.destroyAll = require('./prototypes/destroyAll.js');
