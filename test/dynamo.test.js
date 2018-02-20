var should = require('./init.js');

var db, User, Book, Cookie, Car;

describe('dynamodb', function() {
  before(function(done) {
    db = getSchema();
    User = db.define('User', {
      id: { type: String, keyType: 'hash' },
      name: { type: String },
      email: { type: String },
      age: { type: Number }
    });

    db.adapter.emitter.on('created', function(event) {
      if (event.tableParams.TableName === 'User') {
        Film = db.define('Film', {
          title: { type: String },
          year: { type: Number }
        });
      } else if (event.tableParams.TableName === 'Film') {
        Book = db.define('Book', {
          title: { type: String },
          iban: { type: String, keyType: 'hash' }
        });
      } else if (event.tableParams.TableName === 'Book') {
        Song = db.define('Song', {
          id: { type: String, keyType: 'pk', separator: '--oo--' },
          singer: { type: String, keyType: 'hash' },
          title: { type: String, keyType: 'range' }
        });
      } else {
        done();
      }
    });
  });

  after(function(done) {
    db.adapter.client.deleteTable({ TableName: 'Film' }, function() {
      db.adapter.client.deleteTable({ TableName: 'User' }, function() {
        db.adapter.client.deleteTable({ TableName: 'Book' }, function() {
          db.adapter.client.deleteTable({ TableName: 'Song' }, function() {
            done();
          });
        });
      });
    });
  });

  describe('creating table', function() {
    it('should create table for User', function(done) {
      db.adapter.client.describeTable({ TableName: 'User' }, function(err, data) {
        (data === null).should.be.false;
        done();
      });
    });
  });

  describe('create items', function() {
    it('should create a new item', function(done) {
      User.create({ id: '1', name: 'Jonh', email: 'jonh@doe.foo' }, function(err, user) {
        should.not.exist(err);
        should.exist(user);
        user.should.have.property('id', '1');
        user.should.have.property('name', 'Jonh');
        done();
      });
    });

    it('should assign a hash key if not specified', function(done) {
      Film.create({ title: 'Star Wars', year: 1977 }, function(err, cookie) {
        should.not.exist(err);
        cookie.should.have.property('id');
        db.adapter._models['Film'].hashKey.should.eql('id');
        db.adapter._models['Film'].hashKeyUUID.should.be.true;
        done();
      });
    });

    it('should assign same value as hash key to id attribute', function(done) {
      Book.create({ title: 'The Lord of the Rings', iban: '123456' }, function(err, book) {
        should.not.exist(err);
        should.exist(book);
        book.should.have.property('id', '123456');
        done();
      });
    });

    it('should replace original record if same hash key is provided', function(done) {
      var tempUser = new User({
        id: '1',
        name: 'Johnny Doey',
        email: 'johnny@doey.com'
      });
      User.create(tempUser, function(err, user) {
        should.not.exist(err);
        user.should.have.property('id', '1');
        user.should.have.property('name', 'Johnny Doey');
        user.should.have.property('email', 'johnny@doey.com');
        done();
      });
    });

    it('should handle undefined and null attributes and return the same from database', function(done) {
      var tempUser = new User({
        id: '2',
        name: 'Anne',
        email: null
      });
      User.create(tempUser, function(err, user) {
        should.not.exist(err);
        (user.foo === undefined).should.be.true;
        (user.name === 'Anne').should.be.true;
        (user.email === null).should.be.true;
        done();
      });
    });

    it('should return error saying hash key cannot be null', function(done) {
      var tempUser = new User({
        id: null
      });
      User.create(tempUser, function(err, user) {
        should.exist(err);
        done();
      });
    });
  });

  describe('if only have hash keys', function() {
    it('should have hash key', function(done) {
      db.adapter.client.describeTable({ TableName: 'User' }, function(err, data) {
        should.not.exist(err);
        data.Table.KeySchema[0].AttributeName.should.eql('id');
        data.Table.KeySchema[0].KeyType.should.eql('HASH');
        done();
      });
    });

    it('should throw error if uuid is true and attribute name is not id', function(done) {
      (function() {
        db.define('Model', {
          attribute1: { type: String, keyType: 'hash', uuid: true }
        });
      }.should.throw());
      done();
    });

    it('should should fetch based on hash key', function(done) {
      User.find('1', function(err, user) {
        should.not.exist(err);
        should.exist.user;
        done();
      });
    });
  });

  describe('if model has hash and range keys', function() {
    it('should throw error id attribute is missing', function(done) {
      (function() {
        db.define('Model', {
          attribute1: { type: String, keyType: 'hash' },
          attribute2: { type: Number, keyType: 'range' }
        });
      }.should.throw());
      done();
    });

    it('should use separator specified in schema definition', function(done) {
      var song = new Song({
        singer: 'Foo Fighters',
        title: 'The Pretender'
      });
      Song.create(song, function(err, _song) {
        _song.should.have.property('id', 'Foo Fighters--oo--The Pretender');
        done();
      });
    });

    it('should find objects with id attribute', function(done) {
      Song.find('Foo Fighters--oo--The Pretender', function(err, fetchedSong) {
        fetchedSong.title.should.eql('The Pretender');
        fetchedSong.singer.should.eql('Foo Fighters');
        done();
      });
    });

    it('should create two items for same hash but different ranges', function(done) {
      var song1 = new Song({
        title: 'The Pretender',
        singer: 'Foo Fighters'
      });

      var song2 = new Song({
        title: 'All my life',
        singer: 'Foo Fighters'
      });

      Song.create(song1, function(err, _song1) {
        should.not.exist(err);
        should.exist(_song1);
        _song1.should.have.property('title', 'The Pretender');
        _song1.should.have.property('singer', 'Foo Fighters');

        Song.create(song2, function(err, _song2) {
          should.not.exist(err);
          should.exist(_song2);
          _song2.should.have.property('title', 'All my life');
          _song2.should.have.property('singer', 'Foo Fighters');
          done();
        });
      });
    });
  });
});
