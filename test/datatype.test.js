var should = require('./init.js');

describe('datatypes', function() {
  before(function(done) {
    db = getSchema();
    Model = db.define('Model', {
      str: String,
      date: String,
      num: Number,
      bool: Boolean
    });

    db.adapter.emitter.on('created', function() {
      Model.destroyAll(done);
    });
  });

  after(function(done) {
    db.adapter.client.deleteTable({ TableName: 'Model' }, function() {
      done();
    });
  });

  it('should keep types when get read data from db', function(done) {
    const date = new Date();
    Model.create(
      {
        str: 'hello',
        date: date.toISOString(),
        num: '3',
        bool: 1
      },
      function(err, model) {
        should.not.exist(err);
        should.exist(model && model.id);
        model.str.should.be.a.String;
        model.num.should.be.a.Number;
        model.bool.should.be.a.Boolean;
        id = model.id;
        testFind(model.id, testAll);
      }
    );

    function testFind(id, next) {
      Model.find(id, function(err, model) {
        should.not.exist(err);
        should.exist(model);
        model.str.should.be.a.String;
        model.num.should.be.a.Number;
        model.bool.should.be.a.Boolean;
        model.date.should.equal(date.toISOString(), 'Time must match');
        next();
      });
    }

    function testAll() {
      Model.findOne(function(err, model) {
        should.not.exist(err);
        should.exist(model);
        model.str.should.be.a.String;
        model.num.should.be.a.Number;
        model.bool.should.be.a.Boolean;
        model.date.should.equal(date.toISOString(), 'Time must match');
        done();
      });
    }
  });

  it('should convert "false" to false for boolean', function() {
    var m = new Model({ bool: 'false' });
    m.bool.should.equal(false);
  });
});
