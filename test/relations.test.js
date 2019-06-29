/* eslint-disable no-unused-expressions */
/* eslint-disable no-use-before-define */
const should = require('should');
const { getSchema, closeDynaliteServer } = require('./init.js');

describe('relations', () => {
  let db;
  let Book;
  let Chapter;
  let Author;
  let Reader;
  let List;
  let Item;
  let Fear;
  let Article;
  let Tag;
  let ArticleTag;
  // eslint-disable-next-line no-unused-vars
  let Mind;

  before(async () => {
    db = await getSchema();

    Book = db.define('Book', { name: String }, {
      tableStatus: {
        timeInterval: 50,
      },
    });
    Chapter = db.define('Chapter',
      {
        name: {
          type: String,
          index: true,
          limit: 20,
        },
      }, {
        tableStatus: {
          timeInterval: 50,
        },
      });
    Author = db.define('Author', { name: String }, {
      tableStatus: {
        timeInterval: 50,
      },
    });
    Reader = db.define('Reader', { name: String }, {
      tableStatus: {
        timeInterval: 50,
      },
    });

    return new Promise((resolve) => {
      let modelCreated = 0;
      db.adapter.emitter.on('created', () => {
        modelCreated += 1;
        if (modelCreated === 4) {
          resolve();
        }
      });
    });
  });

  after((done) => {
    const tables = [
      'Book',
      'Chapter',
      'Author',
      'Reader',
      'List',
      'Item',
      'Fear',
      'Mind',
      'Article',
      'Tag',
      'ArticleTag',
    ];
    let index = 0;

    function deleteTable() {
      if (index >= tables.length) {
        closeDynaliteServer().then(done);
        return;
      }

      db.adapter.dropTable(tables[index], deleteTable);
      index += 1;
    }

    deleteTable();
  });

  describe('hasMany', () => {
    it('can be declared in different ways', (done) => {
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

    it('can be declared in short form', (done) => {
      Author.hasMany('readers');
      new Author().readers.should.be.an.instanceOf(Function);
      new Reader().toObject().should.have.property('authorId');
      db.autoupdate(done);
    });

    it('should build record on scope', (done) => {
      Book.create((err, book) => {
        const chapter = book.chapters.build();
        chapter.bookId.should.equal(book.id);
        chapter.save(done);
      });
    });

    it('should create record on scope', (done) => {
      Book.create((errBookCreate, book) => {
        book.chapters.create((errChapter, chapter) => {
          should.not.exist(errChapter);
          should.exist(chapter);
          chapter.bookId.should.equal(book.id);
          done();
        });
      });
    });

    it('should find scoped record', (done) => {
      let id;
      Book.create((errBookCreate, book) => {
        book.chapters.create({ name: 'a' }, (err, ch) => {
          // eslint-disable-next-line prefer-destructuring
          id = ch.id;
          book.chapters.create({ name: 'z' }, () => {
            book.chapters.create({ name: 'c' }, () => {
              fetch(book);
            });
          });
        });
      });

      function fetch(book) {
        book.chapters.find(id, (err, chapter) => {
          should.not.exist(err);
          should.exist(chapter);
          chapter.id.should.equal(id);
          done();
        });
      }
    });

    it('should destroy scoped record', (done) => {
      Book.create((errBookCreate, book) => {
        book.chapters.create({ name: 'a' }, (errChapterCreate, chCreated) => {
          book.chapters.destroy(chCreated.id, (errChapterDestroy) => {
            should.not.exist(errChapterDestroy);
            book.chapters.find(chCreated.id, (errChapterFind, chFound) => {
              should.exist(errChapterFind);
              errChapterFind.message.should.equal('Not found');
              should.not.exist(chFound);
              done();
            });
          });
        });
      });
    });

    it('should not allow destroy not scoped records', (done) => {
      Book.create((err, book1) => {
        book1.chapters.create({ name: 'a' }, (errChapterCreate, chapterCreated) => {
          const { id } = chapterCreated;
          Book.create((errBookCreate, book2) => {
            book2.chapters.destroy(chapterCreated.id, (errChapterDestroy) => {
              should.exist(errChapterDestroy);
              errChapterDestroy.message.should.equal('Permission denied');
              book1.chapters.find(chapterCreated.id, (errChapterFind, chapterFound) => {
                should.not.exist(errChapterFind);
                should.exist(chapterFound);
                chapterFound.id.should.equal(id);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('belongsTo', () => {
    before((done) => {
      let modelCount = 0;
      List = db.define('List', { name: String }, {
        tableStatus: {
          timeInterval: 50,
        },
      });
      Item = db.define('Item', { name: String }, {
        tableStatus: {
          timeInterval: 50,
        },
      });
      Fear = db.define('Fear', {}, {
        tableStatus: {
          timeInterval: 50,
        },
      });
      Mind = db.define('Mind', {}, {
        tableStatus: {
          timeInterval: 50,
        },
      });

      db.adapter.emitter.on('created', () => {
        modelCount += 1;
        if (modelCount === 4) {
          done();
        }
      });
    });

    it('can be declared in long form', (done) => {
      Item.belongsTo(List);
      new Item().toObject().should.have.property('listId');
      new Item().list.should.be.an.instanceOf(Function);
      db.autoupdate(done);
    });

    it('can be declared in short form', (done) => {
      Fear.belongsTo('mind');
      new Fear().toObject().should.have.property('mindId');
      new Fear().mind.should.be.an.instanceOf(Function);
      db.autoupdate(done);
    });

    it('can be used to query data', (done) => {
      List.hasMany('all', { model: Item });

      db.automigrate(() => {
        List.create((err, list) => {
          should.not.exist(err);
          should.exist(list);

          list.all.create((errListCreate, all) => {
            all.list((e, listFetched) => {
              should.not.exist(e);
              should.exist(listFetched);
              listFetched.should.be.an.instanceOf(List);
              all.list().then((item) => {
                item.id.should.equal(listFetched.id);
                done();
              });
            });
          });
        });
      });
    });

    it('could accept objects when creating on scope', (done) => {
      List.create((errListCreate, list) => {
        should.not.exist(errListCreate);
        should.exist(list);

        Item.create({ list }, (errItemCreate, item) => {
          should.not.exist(errItemCreate);
          should.exist(item);
          should.exist(item.listId);
          item.listId.should.equal(list.id);
          item.__cachedRelations.list.should.equal(list);
          done();
        });
      });
    });
  });

  describe('hasAndBelongsToMany', () => {
    before((done) => {
      let modelCount = 0;

      Article = db.define('Article', { title: String }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

      Tag = db.define('Tag', { name: String }, {
        tableStatus: {
          timeInterval: 50,
        },
      });

      Article.hasAndBelongsToMany('tags');
      // eslint-disable-next-line prefer-destructuring
      ArticleTag = db.models.ArticleTag;

      db.adapter.emitter.on('created', () => {
        modelCount += 1;

        if (modelCount === 2) {
          done();
        }
      });
    });

    it('should allow to create instances on scope', (done) => {
      Article.create((e, article) => {
        article.tags.create({ name: 'popular' }, (err, tag) => {
          tag.should.be.an.instanceOf(Tag);

          ArticleTag.findOne((errArticleTagFindOne, articleTag) => {
            should.exist(articleTag);
            articleTag.tagId.toString().should.equal(tag.id.toString());
            articleTag.articleId.toString().should.equal(article.id.toString());
            done();
          });
        });
      });
    });

    it('should allow to fetch scoped instances', (done) => {
      Article.findOne((err1, article) => {
        article.tags((err2, tags) => {
          should.not.exist(err2);
          should.exist(tags);
          done();
        });
      });
    });

    it('should allow to add connection with instance', (done) => {
      Article.findOne((err1, article) => {
        Tag.create({ name: 'awesome' }, (err2, tag) => {
          article.tags.add(tag, (err3, at) => {
            should.not.exist(err3);
            should.exist(at);

            at.should.be.an.instanceOf(ArticleTag);
            at.tagId.should.equal(tag.id);
            at.articleId.should.equal(article.id);
            done();
          });
        });
      });
    });

    it('should allow to remove connection with instance', (done) => {
      Article.findOne((err, article) => {
        article.tags((err1, tags1) => {
          const len = tags1.length;
          tags1.should.not.be.empty;
          should.exist(tags1[0]);

          article.tags.remove(tags1[0], (errArticleTagRemove) => {
            should.not.exist(errArticleTagRemove);
            article.tags(true, (errArticleTags, tags2) => {
              tags2.should.have.lengthOf(len - 1);
              done();
            });
          });
        });
      });
    });

    it('should remove the correct connection', (done) => {
      Article.create({ title: 'Article 1' }, (err1, article1) => {
        Article.create({ title: 'Article 2' }, (err2, article2) => {
          Tag.create({ name: 'correct' }, (err3, tag) => {
            article1.tags.add(tag, (/* err4, at */) => {
              article2.tags.add(tag, (/* err5, at */) => {
                article2.tags.remove(tag, (/* err6 */) => {
                  article2.tags(true, (err7, tags2) => {
                    tags2.should.have.lengthOf(0);
                    article1.tags(true, (err8, tags1) => {
                      tags1.should.have.lengthOf(1);
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
