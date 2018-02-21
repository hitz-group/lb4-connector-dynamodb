var should = require('./init.js');

describe('relations', function() {
  before(function(done) {
    db = getSchema();
    Book = db.define(`Book`, { name: String });
    Chapter = db.define('Chapter', { name: { type: String, index: true, limit: 20 } });
    Author = db.define('Author', { name: String });
    Reader = db.define('Reader', { name: String });
    var modelCount = 0;

    db.adapter.emitter.on('created', function() {
      modelCount++;
      if (modelCount === 4) {
        done();
      }
    });
  });

  after(function(done) {
    db.adapter.client.deleteTable({ TableName: 'Book' }, function() {
      db.adapter.client.deleteTable({ TableName: 'Chapter' }, function() {
        db.adapter.client.deleteTable({ TableName: 'Author' }, function() {
          db.adapter.client.deleteTable({ TableName: 'Reader' }, function() {
            db.adapter.client.deleteTable({ TableName: 'List' }, function() {
              db.adapter.client.deleteTable({ TableName: 'Item' }, function() {
                db.adapter.client.deleteTable({ TableName: 'Fear' }, function() {
                  db.adapter.client.deleteTable({ TableName: 'Mind' }, function() {
                    db.adapter.client.deleteTable({ TableName: 'Article' }, function() {
                      db.adapter.client.deleteTable({ TableName: 'Tag' }, function() {
                        db.adapter.client.deleteTable({ TableName: 'ArticleTag' }, function() {
                          done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('hasMany', function() {
    it('can be declared in different ways', function(done) {
      Book.hasMany(Chapter);
      Book.hasMany(Reader, { as: 'users' });
      Book.hasMany(Author, { foreignKey: 'projectId' });

      const book = new Book();
      book.chapters.should.be.an.instanceOf(Function);
      book.users.should.be.an.instanceOf(Function);
      book.authors.should.be.an.instanceOf(Function);

      new Chapter().toObject().should.have.property('bookId');
      new Author().toObject().should.have.property('projectId');
      db.automigrate(done);
    });

    it('can be declared in short form', function(done) {
      Author.hasMany('readers');
      new Author().readers.should.be.an.instanceOf(Function);
      new Reader().toObject().should.have.property('authorId');
      db.autoupdate(done);
    });

    it('should build record on scope', function(done) {
      Book.create(function(err, book) {
        const chapter = book.chapters.build();
        chapter.bookId.should.equal(book.id);
        chapter.save(done);
      });
    });

    it('should create record on scope', function(done) {
      Book.create(function(err, book) {
        book.chapters.create(function(err, chapter) {
          should.not.exist(err);
          should.exist(chapter);
          chapter.bookId.should.equal(book.id);
          done();
        });
      });
    });

    it('should find scoped record', function(done) {
      let id;
      Book.create(function(err, book) {
        book.chapters.create({ name: 'a' }, function(err, ch) {
          id = ch.id;
          book.chapters.create({ name: 'z' }, function() {
            book.chapters.create({ name: 'c' }, function() {
              fetch(book);
            });
          });
        });
      });

      function fetch(book) {
        book.chapters.find(id, function(err, chapter) {
          should.not.exist(err);
          should.exist(chapter);
          chapter.id.should.equal(id);
          done();
        });
      }
    });

    it('should destroy scoped record', function(done) {
      Book.create(function(err, book) {
        book.chapters.create({ name: 'a' }, function(err, ch) {
          book.chapters.destroy(ch.id, function(err) {
            should.not.exist(err);
            book.chapters.find(ch.id, function(err, ch) {
              should.exist(err);
              err.message.should.equal('Not found');
              should.not.exist(ch);
              done();
            });
          });
        });
      });
    });

    it('should not allow destroy not scoped records', function(done) {
      Book.create(function(err, book1) {
        book1.chapters.create({ name: 'a' }, function(err, chapter) {
          const id = chapter.id;
          Book.create(function(err, book2) {
            book2.chapters.destroy(chapter.id, function(err) {
              should.exist(err);
              err.message.should.equal('Permission denied');
              book1.chapters.find(chapter.id, function(err, ch) {
                should.not.exist(err);
                should.exist(ch);
                ch.id.should.equal(id);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('belongsTo', function() {
    before(function(done) {
      let modelCount = 0;
      List = db.define('List', { name: String });
      Item = db.define('Item', { name: String });
      Fear = db.define('Fear');
      Mind = db.define('Mind');

      db.adapter.emitter.on('created', function() {
        modelCount++;
        if (modelCount === 4) {
          done();
        }
      });
    });

    it('can be declared in long form', function(done) {
      Item.belongsTo(List);
      new Item().toObject().should.have.property('listId');
      new Item().list.should.be.an.instanceOf(Function);
      db.autoupdate(done);
    });

    it('can be declared in short form', function(done) {
      Fear.belongsTo('mind');
      new Fear().toObject().should.have.property('mindId');
      new Fear().mind.should.be.an.instanceOf(Function);
      db.autoupdate(done);
    });

    it('can be used to query data', function(done) {
      List.hasMany('all', { model: Item });

      db.automigrate(function() {
        List.create(function(err, list) {
          should.not.exist(err);
          should.exist(list);

          list.all.create(function(err, all) {
            all.list(function(e, list) {
              should.not.exist(e);
              should.exist(list);
              list.should.be.an.instanceOf(List);
              all.list().should.equal(list.id);
              done();
            });
          });
        });
      });
    });

    it('could accept objects when creating on scope', function(done) {
      List.create(function(err, list) {
        should.not.exist(err);
        should.exist(list);

        Item.create({ list: list }, function(err, item) {
          should.not.exist(err);
          should.exist(item);
          should.exist(item.listId);
          item.listId.should.equal(list.id);
          item.__cachedRelations.list.should.equal(list);
          done();
        });
      });
    });
  });

  describe('hasAndBelongsToMany', function() {
    before(function(done) {
      var modelCount = 0;
      Article = db.define('Article', { title: String });
      Tag = db.define('Tag', { name: String });

      Article.hasAndBelongsToMany('tags');
      ArticleTag = db.models.ArticleTag;

      db.adapter.emitter.on('created', function() {
        modelCount++;

        if (modelCount === 3) {
          done();
        }
      });
    });

    it('should allow to create instances on scope', function(done) {
      Article.create(function(e, article) {
        article.tags.create({ name: 'popular' }, function(err, tag) {
          tag.should.be.an.instanceOf(Tag);

          ArticleTag.findOne(function(err, articleTag) {
            should.exist(articleTag);
            articleTag.tagId.toString().should.equal(tag.id.toString());
            articleTag.articleId.toString().should.equal(article.id.toString());
            done();
          });
        });
      });
    });

    it('should allow to fetch scoped instances', function(done) {
      Article.findOne(function(err, article) {
        article.tags(function(err, tags) {
          should.not.exist(err);
          should.exist(tags);
          done();
        });
      });
    });

    it('should allow to add connection with instance', function(done) {
      Article.findOne(function(err, article) {
        Tag.create({ name: 'awesome' }, function(err, tag) {
          article.tags.add(tag, function(err, at) {
            should.not.exist(err);
            should.exist(at);

            at.should.be.an.instanceOf(ArticleTag);
            at.tagId.should.equal(tag.id);
            at.articleId.should.equal(article.id);
            done();
          });
        });
      });
    });

    it('should allow to remove connection with instance', function(done) {
      Article.findOne(function(err, article) {
        article.tags(function(err, tags) {
          const len = tags.length;
          tags.should.not.be.empty;
          should.exist(tags[0]);

          article.tags.remove(tags[0], function(err) {
            should.not.exist(err);
            article.tags(true, function(err, tags) {
              tags.should.have.lengthOf(len - 1);
              done();
            });
          });
        });
      });
    });

    it('should remove the correct connection', function(done) {
      Article.create({ title: 'Article 1' }, function(err, article1) {
        Article.create({ title: 'Article 2' }, function(err, article2) {
          Tag.create({ name: 'correct' }, function(err, tag) {
            article1.tags.add(tag, function(err, at) {
              article2.tags.add(tag, function(err, at) {
                article2.tags.remove(tag, function(err) {
                  article2.tags(true, function(err, tags) {
                    tags.should.have.lengthOf(0);
                    article1.tags(true, function(err, tags) {
                      tags.should.have.lengthOf(1);
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
