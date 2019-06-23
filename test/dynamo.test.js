const should = require('should');
const { getSchema } = require('./init.js');

describe('dynamodb', () => {
  let db;
  let User;
  let Song;

  before(async () => {
    db = await getSchema();
    User = db.define('User',
      {
        id: { type: String, keyType: 'hash' },
        name: { type: String },
        email: { type: String },
        age: { type: Number },
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    Song = db.define('Song',
      {
        id: { type: String, keyType: 'pk', separator: '--oo--' },
        singer: { type: String, keyType: 'hash' },
        title: { type: String, keyType: 'range' },
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    return new Promise((resolve) => {
      let modelCreated = 0;
      db.adapter.emitter.on('created', () => {
        modelCreated += 1;
        if (modelCreated === 2) {
          resolve();
        }
      });
    });
  });

  after((done) => {
    db.adapter.client.deleteTable({ TableName: 'User' }, () => {
      db.adapter.client.deleteTable({ TableName: 'Song' }, () => {
        done();
      });
    });
  });

  describe('creating table', () => {
    it('should create table for User', (done) => {
      db.adapter.client.describeTable({ TableName: 'User' }, (err, data) => {
        should.exist(data);
        done();
      });
    });
  });

  describe('if only have hash keys', () => {
    it('should have hash key', (done) => {
      db.adapter.client.describeTable({ TableName: 'User' }, (err, data) => {
        should.not.exist(err);
        data.Table.KeySchema[0].AttributeName.should.eql('id');
        data.Table.KeySchema[0].KeyType.should.eql('HASH');
        done();
      });
    });

    it('should throw error if uuid is true and attribute name is not id', (done) => {
      (() => {
        db.define('Model', {
          attribute1: { type: String, keyType: 'hash', uuid: true },
        });
      }).should.throw();
      done();
    });

    it('should should fetch based on hash key', (done) => {
      User.create({
        id: '1',
        name: 'John Lennon',
        mail: 'john@b3atl3s.co.uk',
        role: 'lead',
        order: 2,
      }, () => {
        User.find('1', (err, user) => {
          should.not.exist(err);
          should.exist(user);
          done();
        });
      });
    });
  });

  describe('if model has hash and range keys', () => {
    it('should throw error id attribute is missing', (done) => {
      (() => {
        db.define('Model', {
          attribute1: { type: String, keyType: 'hash' },
          attribute2: { type: Number, keyType: 'range' },
        });
      }).should.throw();
      done();
    });

    it('should use separator specified in schema definition', (done) => {
      const song = new Song({
        singer: 'Foo Fighters',
        title: 'The Pretender',
      });
      Song.create(song, (err, _song) => {
        _song.should.have.property('id', 'Foo Fighters--oo--The Pretender');
        done();
      });
    });

    it('should find objects with id attribute', (done) => {
      Song.find('Foo Fighters--oo--The Pretender', (err, fetchedSong) => {
        fetchedSong.title.should.eql('The Pretender');
        fetchedSong.singer.should.eql('Foo Fighters');
        done();
      });
    });

    it('should create two items for same hash but different ranges', (done) => {
      const song1 = new Song({
        title: 'The Pretender',
        singer: 'Foo Fighters',
      });

      const song2 = new Song({
        title: 'All my life',
        singer: 'Foo Fighters',
      });

      Song.create(song1, (err1, _song1) => {
        should.not.exist(err1);
        should.exist(_song1);
        _song1.should.have.property('title', 'The Pretender');
        _song1.should.have.property('singer', 'Foo Fighters');

        Song.create(song2, (err2, _song2) => {
          should.not.exist(err2);
          should.exist(_song2);
          _song2.should.have.property('title', 'All my life');
          _song2.should.have.property('singer', 'Foo Fighters');
          done();
        });
      });
    });
  });
});
