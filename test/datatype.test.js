/* eslint-disable no-unused-expressions */
const should = require('should');
const { getSchema, closeDynaliteServer } = require('./init.js');

describe('datatypes', () => {
  let db;
  let Model;

  before(async () => {
    db = await getSchema();
    Model = db.define('Model',
      {
        str: String,
        date: String,
        num: Number,
        bool: Boolean,
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    return new Promise((resolve) => {
      db.adapter.emitter.on('created', resolve);
    });
  });

  after((done) => {
    db.adapter.dropTable('Model', () => {
      closeDynaliteServer().then(done);
    });
  });

  it('should keep types when get read data from db', (done) => {
    const date = new Date();

    function testAll() {
      Model.findOne((err, model) => {
        should.not.exist(err);
        should.exist(model);
        model.str.should.be.a.String;
        model.num.should.be.a.Number;
        model.bool.should.be.a.Boolean;
        model.date.should.equal(date.toISOString(), 'Time must match');
        done();
      });
    }

    function testFind(id, next) {
      Model.find(id, (err, model) => {
        should.not.exist(err);
        should.exist(model);
        model.str.should.be.a.String;
        model.num.should.be.a.Number;
        model.bool.should.be.a.Boolean;
        model.date.should.equal(date.toISOString(), 'Time must match');
        next();
      });
    }

    Model.create(
      {
        str: 'hello',
        date: date.toISOString(),
        num: '3',
        bool: 1,
      },
      (err, model) => {
        should.not.exist(err);
        should.exist(model && model.id);
        model.str.should.be.a.String;
        model.num.should.be.a.Number;
        model.bool.should.be.a.Boolean;
        testFind(model.id, testAll);
      },
    );
  });

  it('should convert "false" to false for boolean', () => {
    const model = new Model({ bool: 'false' });
    model.bool.should.equal(false);
  });
});
