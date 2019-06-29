/* eslint-disable no-unused-expressions */
const should = require('should');
const { getSchema, closeDynaliteServer } = require('./init.js');

describe('basic-querying', () => {
  let db;
  let User;
  let Film;
  let Book;

  before(async () => {
    db = await getSchema();

    User = db.define('User',
      {
        id: {
          type: String,
          keyType: 'hash',
        },
        name: {
          type: String,
          sort: true,
          limit: 100,
        },
        email: {
          type: String,
          index: true,
          limit: 100,
        },
        role: {
          type: String,
          index: true,
          limit: 100,
        },
        order: {
          type: Number,
          index: true,
          sort: true,
          limit: 100,
        },
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    Film = db.define('Film',
      {
        title: {
          type: String,
        },
        year: {
          type: Number,
        },
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    Book = db.define('Book',
      {
        title: {
          type: String,
        },
        iban: {
          type: String,
          keyType: 'hash',
        },
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    return new Promise((resolve) => {
      let modelCreated = 0;
      db.adapter.emitter.on('created', () => {
        modelCreated += 1;
        if (modelCreated === 3) {
          resolve();
        }
      });
    });
  });

  after((done) => {
    db.adapter.dropTable('Film', () => {
      db.adapter.dropTable('User', () => {
        db.adapter.dropTable('Book', () => {
          closeDynaliteServer().then(done);
        });
      });
    });
  });

  function seed(done) {
    const beatles = [
      {
        id: '1',
        name: 'John Lennon',
        mail: 'john@b3atl3s.co.uk',
        role: 'lead',
        order: 2,
      },
      {
        id: '2',
        name: 'Paul McCartney',
        mail: 'paul@b3atl3s.co.uk',
        role: 'lead',
        order: 1,
      },
      { id: '3', name: 'George Harrison', order: 5 },
      { id: '4', name: 'Ringo Starr', order: 6 },
      { id: '5', name: 'Pete Best', order: 4 },
      { id: '6', name: 'Stuart Sutcliffe', order: 3 },
    ];

    let index = 0;
    function insertUser() {
      if (index >= beatles.length) {
        done();
        return;
      }
      User.create(beatles[index], insertUser);
      index += 1;
    }

    User.destroyAll(insertUser);
  }

  describe('create items', () => {
    it('should create a new item', (done) => {
      User.create({ id: '1', name: 'John', email: 'john@doe.foo' }, (err, user) => {
        should.not.exist(err);
        should.exist(user);
        user.should.have.property('id', '1');
        user.should.have.property('name', 'John');
        done();
      });
    });

    it('should assign a hash key if not specified', (done) => {
      Film.create({ title: 'Star Wars', year: 1977 }, (err, cookie) => {
        should.not.exist(err);
        cookie.should.have.property('id');
        db.adapter.allModels.Film.hashKey.should.eql('id');
        db.adapter.allModels.Film.hashKeyUUID.should.be.true;
        done();
      });
    });

    it('should assign same value as hash key to id attribute', (done) => {
      Book.create({ title: 'The Lord of the Rings', iban: '123456' }, (err, book) => {
        should.not.exist(err);
        should.exist(book);
        book.should.have.property('id', '123456');
        done();
      });
    });

    it('should replace original record if same hash key is provided', (done) => {
      User.create({ id: '1', name: 'Johnny Doey', email: 'johnny@doey.com' }, (err, user) => {
        should.not.exist(err);
        user.should.have.property('id', '1');
        user.should.have.property('name', 'Johnny Doey');
        user.should.have.property('email', 'johnny@doey.com');
        done();
      });
    });

    it('should handle undefined and null attributes and return the same from database', (done) => {
      User.create({ id: '2', name: 'Anne', email: null }, (err, user) => {
        should.not.exist(err);
        (user.foo === undefined).should.be.true;
        (user.name === 'Anne').should.be.true;
        (user.email === null).should.be.true;
        done();
      });
    });

    it('should return error saying hash key cannot be null', (done) => {
      User.create({ id: null }, (err) => {
        should.exist(err);
        done();
      });
    });
  });

  describe('find', () => {
    it('should query by id: not found', (done) => {
      User.find('foo_id', (err, user) => {
        should.not.exist(user);
        should.not.exist(err);
        done();
      });
    });

    it('should query by id: found', (done) => {
      User.create({ id: '123' }, (createError, createUser) => {
        User.find(createUser.id, (foundError, foundUser) => {
          should.exist(foundUser);
          should.not.exist(foundError);
          foundUser.should.be.an.instanceOf(User);
          done();
        });
      });
    });
  });

  describe('all', () => {
    before(seed);

    it('should query collection', (done) => {
      User.all((err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(6);
        done();
      });
    });

    it('should query limited collection', (done) => {
      User.all({ limit: 3 }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(3);
        done();
      });
    });

    it.skip('should query offset collection with limit', (done) => {
      User.all({ skip: 1, limit: 4 }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(4);

        // fails in dynalite; since order of list items changes
        users[0].should.have.property('id', '2');

        done();
      });
    });

    it('should query filtered collection', (done) => {
      User.all({ where: { role: 'lead' } }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.should.have.lengthOf(2);
        done();
      });
    });

    it('should query collection sorted by numeric field', (done) => {
      User.all({ order: 'order' }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.forEach((u, i) => {
          u.order.should.eql(i + 1);
        });
        done();
      });
    });

    it('should query collection desc sorted by numeric field', (done) => {
      User.all({ order: 'order DESC' }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.forEach((u, i) => {
          u.order.should.eql(users.length - i);
        });
        done();
      });
    });

    it('should query collection sorted by string field', (done) => {
      User.all({ order: 'name' }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.shift().name.should.equal('George Harrison');
        users.shift().name.should.equal('John Lennon');
        users.pop().name.should.equal('Stuart Sutcliffe');
        done();
      });
    });

    it('should query collection desc sorted by string field', (done) => {
      User.all({ order: 'name DESC' }, (err, users) => {
        should.exists(users);
        should.not.exists(err);
        users.pop().name.should.equal('George Harrison');
        users.pop().name.should.equal('John Lennon');
        users.shift().name.should.equal('Stuart Sutcliffe');
        done();
      });
    });
  });

  describe('count', () => {
    before(seed);

    it('should query total count', (done) => {
      User.count((err, n) => {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(6);
        done();
      });
    });

    it('should query filtered count', (done) => {
      User.count({ role: 'lead' }, (err, n) => {
        should.not.exist(err);
        should.exist(n);
        n.should.equal(2);
        done();
      });
    });
  });

  describe('findOne', () => {
    before(seed);

    it('should work even when findOne by id', (done) => {
      User.findOne((e, u) => {
        User.findOne({ where: { id: u.id } }, (err, user) => {
          should.not.exist(err);
          should.exist(user);
          done();
        });
      });
    });
  });

  describe('exists', () => {
    before(seed);

    it('should check whether record exist', (done) => {
      User.findOne((e, u) => {
        User.exists(u.id, (err, exists) => {
          should.not.exist(err);
          should.exist(exists);
          exists.should.be.ok;
          done();
        });
      });
    });

    it('should check whether record not exist', (done) => {
      User.destroyAll(() => {
        User.exists('asdasd', (err, exists) => {
          should.not.exist(err);
          exists.should.not.be.ok;
          done();
        });
      });
    });
  });
});
