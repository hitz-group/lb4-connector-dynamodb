/* eslint-disable no-use-before-define */
/* eslint-disable no-unused-expressions */
const should = require('should');
const { getSchema, closeDynaliteServer } = require('./init.js');

describe('hooks', () => {
  let db;
  let User;
  let FooModel;

  before(async () => {
    db = await getSchema();
    User = db.define('User',
      {
        email: { type: String, index: true, limit: 100 },
        name: String,
        password: String,
        state: String,
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

    FooModel = db.define('FooModel', {}, {
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
      db.adapter.client.deleteTable({ TableName: 'FooModel' }, () => {
        closeDynaliteServer().then(done);
      });
    });
  });

  describe('behavior', () => {
    it('should allow to break flow in case of error', (done) => {
      FooModel.beforeCreate = (next) => {
        next(new Error('Fail'));
      };
      FooModel.create((err, fooModel) => {
        should.not.exist(fooModel);
        should.exist(err);
        done();
      });
    });
  });

  describe('initialize', () => {
    afterEach(() => {
      User.afterInitialize = null;
    });

    it('should be triggered on new', (done) => {
      User.afterInitialize = () => {
        done();
      };
      // eslint-disable-next-line no-new
      new User();
    });

    it('should be triggered on create', (done) => {
      User.afterInitialize = function () {
        if (this.name === 'Nickolay') {
          this.name += ' Rozental';
        }
      };
      User.create({ name: 'Nickolay' }, (err, user) => {
        user.id.should.be.ok;
        user.name.should.equal('Nickolay Rozental');
        done();
      });
    });
  });

  describe('create', () => {
    afterEach(removeHooks('Create'));

    it('should be triggered on create', (done) => {
      addHooks('Create', done);
      User.create();
    });

    it('should not be triggered on new', () => {
      User.beforeCreate = (next) => {
        should.fail('This should not be called');
        next();
      };
      // eslint-disable-next-line no-new
      new User();
    });

    it('should be triggered on new+save', (done) => {
      addHooks('Create', done);
      new User().save();
    });

    it('afterCreate should not be triggered on failed create', (done) => {
      const old = User.schema.adapter.create;
      User.schema.adapter.create = (modelName, id, cb) => {
        cb(new Error('error'));
      };
      User.afterCreate = () => {
        throw new Error("shouldn't be called");
      };
      User.create(() => {
        User.schema.adapter.create = old;
        done();
      });
    });
  });

  describe('save', () => {
    afterEach(removeHooks('Save'));

    it('should be triggered on create', (done) => {
      addHooks('Save', done);
      User.create();
    });

    it('should be triggered on new+save', (done) => {
      addHooks('Save', done);
      new User().save();
    });

    it('should be triggered on updateAttributes', (done) => {
      User.create((err, user) => {
        addHooks('Save', done);
        user.updateAttributes({ name: 'Anatoliy' });
      });
    });

    it('should be triggered on save', (done) => {
      User.create((err, u) => {
        const user = u;
        addHooks('Save', done);
        user.name = 'Hamburger';
        user.save();
      });
    });

    it('should save full object', (done) => {
      User.create((err, user) => {
        User.beforeSave = (next, data) => {
          data.should.have.keys('id', 'name', 'email', 'password', 'state');
          done();
        };
        user.save();
      });
    });

    it('should save actual modifications to database', (done) => {
      User.beforeSave = (next, d) => {
        const data = d;
        data.password = 'hash';
        next();
      };

      User.create(
        {
          email: 'james.bond@example1.com',
          password: '53cr3t',
        },
        () => {
          User.findOne(
            {
              where: {
                email: 'james.bond@example1.com',
              },
            },
            (err, jb) => {
              jb.password.should.equal('hash');
              done();
            },
          );
        },
      );
    });

    it('should save actual modifications on updateAttributes', (done) => {
      User.beforeSave = (next, d) => {
        const data = d;
        data.password = 'before save hash';
        next();
      };

      User.create(
        {
          email: 'james.bond@example2.com',
        },
        (errUserCreate, user) => {
          user.updateAttribute('password', 'new password', (e, updatedUser) => {
            should.not.exist(e);
            should.exist(updatedUser);
            updatedUser.password.should.equal('before save hash');
            User.findOne(
              {
                where: {
                  email: 'james.bond@example2.com',
                },
              },
              (errUserFind, jb) => {
                jb.password.should.equal('before save hash');
                done();
              },
            );
          });
        },
      );
    });
  });

  describe('update', () => {
    afterEach(removeHooks('Update'));
    it('should not be triggered on create', () => {
      User.beforeUpdate = (next) => {
        should.fail('This should not be called');
        next();
      };
      User.create();
    });

    it('should not be triggered on new+save', () => {
      User.beforeUpdate = (next) => {
        should.fail('This should not be called');
        next();
      };
      new User().save();
    });

    it('should be triggered on updateAttributes', (done) => {
      User.create((err, user) => {
        addHooks('Update', done);
        user.updateAttributes({ name: 'Anatoliy' });
      });
    });

    it('should be triggered on save', (done) => {
      User.create((err, u) => {
        addHooks('Update', done);
        const user = u;
        user.name = 'Hamburger';
        user.save();
      });
    });

    it('should update limited set of fields', (done) => {
      User.create((err, user) => {
        User.beforeUpdate = (next, data) => {
          data.should.have.keys('name', 'email');
          done();
        };

        user.updateAttributes({ name: 1, email: 2 });
      });
    });

    it('should not trigger after-hook on failed save', (done) => {
      User.afterUpdate = () => {
        should.fail("afterUpdate shouldn't be called");
      };

      User.create((err, user) => {
        const { save } = User.schema.adapter;
        User.schema.adapter.save = (modelName, id, cb) => {
          User.schema.adapter.save = save;
          cb(new Error('Error'));
        };

        user.save(() => {
          done();
        });
      });
    });
  });

  describe('destroy', () => {
    afterEach(removeHooks('Destroy'));
    it('should be triggered on destroy', (done) => {
      let hook = 'not called';
      User.beforeDestroy = (next) => {
        hook = 'called';
        next();
      };

      User.afterDestroy = (next) => {
        hook.should.eql('called');
        next();
      };

      User.create((err, user) => {
        user.destroy(done);
      });
    });

    it('should not trigger after-hook on failed destroy', (done) => {
      const { destroy } = User.schema.adapter;
      User.schema.adapter.destroy = (modelName, id, cb) => {
        cb(new Error('error'));
      };

      User.afterDestroy = () => {
        should.fail("afterDestroy shouldn't be called");
      };

      User.create((err, user) => {
        user.destroy(() => {
          User.schema.adapter.destroy = destroy;
          done();
        });
      });
    });
  });

  describe('lifecycle', () => {
    let life = [];
    let _user;

    before((done) => {
      User.beforeSave = (d) => {
        life.push('beforeSave');
        d();
      };

      User.beforeCreate = (d) => {
        life.push('beforeCreate');
        d();
      };
      User.beforeUpdate = (d) => {
        life.push('beforeUpdate');
        d();
      };
      User.beforeDestroy = (d) => {
        life.push('beforeDestroy');
        d();
      };
      User.beforeValidate = (d) => {
        life.push('beforeValidate');
        d();
      };
      User.afterInitialize = () => {
        life.push('afterInitialize');
      };
      User.afterSave = (d) => {
        life.push('afterSave');
        d();
      };
      User.afterCreate = (d) => {
        life.push('afterCreate');
        d();
      };
      User.afterUpdate = (d) => {
        life.push('afterUpdate');
        d();
      };
      User.afterDestroy = (d) => {
        life.push('afterDestroy');
        d();
      };
      User.afterValidate = (d) => {
        life.push('afterValidate');
        d();
      };
      User.create((e, u) => {
        _user = u;
        life = [];
        done();
      });
    });

    beforeEach(() => {
      life = [];
    });

    it('should describe create sequence', (done) => {
      User.create(() => {
        life.should.eql([
          'afterInitialize',
          'beforeValidate',
          'afterValidate',
          'beforeCreate',
          'beforeSave',
          'afterSave',
          'afterCreate',
        ]);
        done();
      });
    });

    it('should describe new+save sequence', (done) => {
      const user = new User();
      user.save(() => {
        life.should.eql([
          'afterInitialize',
          'beforeValidate',
          'afterValidate',
          'beforeCreate',
          'beforeSave',
          'afterSave',
          'afterCreate',
        ]);
        done();
      });
    });

    it('should describe updateAttributes sequence', (done) => {
      _user.updateAttributes({ name: 'Antony' }, (e, updateUser) => {
        life.should.eql(['beforeValidate', 'afterValidate', 'beforeSave', 'beforeUpdate', 'afterUpdate', 'afterSave']);
        updateUser.name.should.eql('Antony');
        done();
      });
    });

    it('should describe isValid sequence', (done) => {
      should.not.exist(_user.constructor._validations, 'Expected user to have no validations, but she have');
      _user.isValid((valid) => {
        valid.should.be.true;
        life.should.eql(['beforeValidate', 'afterValidate']);
        done();
      });
    });

    it('should describe destroy sequence', (done) => {
      _user.destroy(() => {
        life.should.eql(['beforeDestroy', 'afterDestroy']);
        done();
      });
    });
  });

  function addHooks(name, done) {
    const random = String(Math.floor(Math.random() * 1000));
    let called = false;

    User[`before${name}`] = (next, d) => {
      const data = d;
      called = true;
      data.email = random;
      next();
    };

    User[`after${name}`] = function () {
      (!!called).should.equal(true);
      should.exists(this.email);
      this.email.should.equal(random);
      done();
    };
  }

  function removeHooks(name) {
    return () => {
      User[`after${name}`] = null;
      User[`before${name}`] = null;
    };
  }
});
