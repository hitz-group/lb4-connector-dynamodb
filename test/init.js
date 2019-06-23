const { Schema } = require('jugglingdb');
const dynalite = require('dynalite');
const DynamoDB = require('../');

const PORT = 4567;
let dynaliteServer;

const initDynaliteServer = () => {
  if (dynaliteServer) {
    return Promise.resolve();
  }

  dynaliteServer = dynalite({
    createTableMs: 50,
  });

  return new Promise((resolve, reject) => {
    dynaliteServer.listen(PORT, (err) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(`Dynalite started on port ${PORT}`);
      resolve();
    });
  });
};

const getSchema = async () => {
  await initDynaliteServer();

  const db = new Schema(DynamoDB, {
    host: 'localhost',
    port: PORT,
    // port: 9800,
    region: 'ap-southeast-1',
    loggers: ['console'],
    logLevel: 'error',
  });

  db.log = (a) => {
    console.log(a);
  };

  return db;
};

const closeDynaliteServer = async () => {
  if (!dynaliteServer) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    dynaliteServer.close((err) => {
      dynaliteServer = null;
      if (err) {
        reject(err);
      } else {
        console.log('Closed Dynalite server');
        resolve();
      }
    });
  });
};

module.exports = {
  getSchema,
  closeDynaliteServer,
};
