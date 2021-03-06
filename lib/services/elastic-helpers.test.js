'use strict';
/* eslint max-nested-callbacks:[2,5] */

const sinon = require('sinon'),
  _ = require('lodash'),
  expect = require('chai').expect,
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  setup = require('../setup');

describe(_.startCase(filename), function () {
  describe(filename, function () {
    var sandbox, db = { get: _.noop, put: _.noop };

    beforeEach(function () {
      sandbox = sinon.sandbox.create();
      sandbox.stub(db, 'get');
      sandbox.stub(db, 'put');
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('convertRedisBatchtoElasticBatch', function () {
      var fn = lib[this.title];

      it('returns an array of ops if type property equals "put" with a JSON string', function () {
        var ops = [{ value: '{}', type: 'put' }];

        expect(fn({index: 'index', type: 'type', ops: ops})).to.deep.equal([{ index: { _index: 'index', _type: 'type' } }, {}]);
      });

      it('returns an array of ops if type property equals "put" with a JS object', function () {
        var ops = [{ value: {}, type: 'put' }];

        expect(fn({index: 'index', type: 'type', ops: ops})).to.deep.equal([{ index: { _index: 'index', _type: 'type' } }, {}]);
      });

      it('assigns a "key" property if one is defined in the op', function () {
        var ops = [{ value: '{}', type: 'put', key: 'key' }];

        expect(fn({index: 'index', type: 'type', ops: ops})).to.deep.equal([{ index: { _id: 'key', _index: 'index', _type: 'type' } }, {}]);
      });

      it('assigns a "key" property if one is defined in the op', function () {
        var ops = [{ value: '{}', type: 'get', key: 'key' }];

        expect(fn({index: 'index', type: 'type', ops: ops})).to.deep.equal([]);
      });

      it('allows for update', function () {
        var ops = [{ value: '{}', type: 'put', key: 'key' }];

        expect(fn({index: 'index', type: 'type', ops: ops, action: 'update'})).to.deep.equal([{ update: { _id: 'key', _index: 'index', _type: 'type', _retry_on_conflict: 3 } }, {doc: {}, doc_as_upsert: false}]);
      });

      it('allows for update with upsert', function () {
        var ops = [{ value: '{}', type: 'put', key: 'key' }];

        expect(fn({index: 'index', type: 'type', ops: ops, action: 'update', docAsUpsert: true})).to.deep.equal([{ update: { _id: 'key', _index: 'index', _type: 'type', _retry_on_conflict: 3 } }, {doc: {}, doc_as_upsert: true}]);
      });

      it('allows for delete', function () {
        var ops = [{ value: '{}', type: 'put', key: 'key' }];

        expect(fn({index: 'index', type: 'type', ops: ops, action: 'delete'})).to.deep.equal([{ delete: { _id: 'key', _index: 'index', _type: 'type' } }]);
      });

      it('allows for create', function () {
        var ops = [{ value: '{}', type: 'put', key: 'key' }];

        expect(fn({index: 'index', type: 'type', ops: ops, action: 'create'})).to.deep.equal([{ create: { _id: 'key', _index: 'index', _type: 'type' } }, {}]);
      });

      it('throws on unsupported action', function () {
        var ops = [{ value: '{}', type: 'put', key: 'key' }];

        expect(fn.bind(null, {index: 'index', type: 'type', ops: ops, action: 'someUnsupportedAction'})).to.throw('someUnsupportedAction is not supported');
      });
    });

    describe('parseOpValue', function () {
      let fn = lib[this.title];

      it('throws an exception if an op\'s value isn\'t an object', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: 'this is a string'
        };

        expect(fn(op)).to.throw;
      });

      it('throws an exception if an op\'s value isn\'t a string', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: null
        };

        expect(fn(op)).to.throw;
      });
    });

    describe('convertObjectToString', function () {
      let fn = lib[this.title];

      it('returns the first property of an object if the property value is a string', function () {
        let value = { primaryHeadline: 'some headline' };

        expect(fn(value)).to.equal('some headline');
      });

      it('returns the first property of an object inside of an array if the value is a string', function () {
        let value = [{ primaryHeadline: 'some headline', canonicalUrl: 'blahblahblah' }];

        expect(fn(value)).to.deep.equal(['some headline']);
      });

      it('returns the property inside of an array if the value is a string', function () {
        let value = ['some headline'];

        expect(fn(value)).to.deep.equal(['some headline']);
      });

      it('returns string array inside of faked array (object has "items" property)', function () {
        let value = { items: [{ text: 'hey' }] };

        expect(fn(value)).to.deep.equal(['hey']);
      });

      it('throws an exception if the value is a bad string or [string] type', function () {
        let value = 123;

        expect(fn(value)).to.throw;
      });

      it('throws an exception if the array value is a bad string or [string] type', function () {
        let value = [['blah blah']];

        expect(fn(value)).to.throw;
      });
    });

    describe('normalizeOpValuesWithMapping', function () {
      let fn = lib[this.title];

      it('normalizes op with string type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value:
            { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' } } ],
          mapping = { dynamic: false,
            properties:
             { primaryHeadline: { type: 'string', index: 'analyzed' } }},
          result = { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' };

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });

      it('normalizes op with object type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value: {feeds: {sitemaps: true, rss: true, newsfeed: true} }} ],
          mapping = { dynamic: false,
            properties:
             { feeds: { type: 'object', index: 'analyzed' } }},
          result = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value: {feeds: {sitemaps: true, rss: true, newsfeed: true} }} ];

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });

      it('normalizes op with date type', function () {
        let op = [ { type: 'put',
            key: 'localhost.dev.nymag.biz/daily/intelligencer/components/article/instances/civzg5hje000kvurehqsgzcpy',
            value:
            { date: '2016-11-20' } } ],
          mapping = { dynamic: false,
            properties:
             { date: { type: 'date' } }},
          result = { date: '2016-11-20' };

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });

      it('does not invoke a comparitor if the type does not exist', function () {
        let op = [ { type: 'put',
            key: 'localhost/sitename/components/foo/instances/xyz',
            value:
            { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' } } ],
          mapping = {properties:
             { primaryHeadline: { type: 'foo', index: 'analyzed' } }},
          result = { primaryHeadline: 'Blaming Clinton’s Base for Her Loss' };

        fn(mapping, op).then(function (data) {
          expect(data).to.equal(result);
        });
      });
    });

    describe('removeAllReferences', function () {
      let fn = lib[this.title];

      it('returns an operation without its refs', function () {
        let op = {
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: { _ref: 'localhost.dev.nymag.biz/daily/intelligencer/components/clay-paragraph/instances/civv4lklw000jjzp43yqr0a2n' }
        };

        expect(fn(op)).to.deep.equal({
          type: 'put',
          key: 'www.vulture.com/components/article/instances/section-test',
          value: {}
        });
      });
    });

    describe('applyOpFilters', function () {
      let fn = lib[this.title],
        batchOps = [{
          type: 'put',
          key: 'localhost/components/foo/instances/xyz',
          value: { propertyName:'' }
        }],
        mappings = {
          myIndex: {
            general: {
              dynamic: false,
              properties: {
                propertyName: { type: 'string', index: 'analyzed' }
              }
            }
          }
        },
        indexName = 'myIndex',
        func = function (ops) {
          return ops;
        },
        expectedResp = [
          [{
            ops: batchOps,
            mapping: {
              dynamic: false,
              properties: {
                propertyName: { type: 'string', index: 'analyzed' }
              }
            },
            typeName: 'general'
          }]
        ];

      it('returns an operation without its refs', function () {
        return fn(batchOps, mappings, indexName, func)
          .then(function (resp) {
            expect(resp).to.deep.equal(expectedResp);
          });
      });
    });

    describe('resolveReferencesForPropertyOfStringType', function () {
      let fn = lib[this.title];

      it('removes an op if the value for the property is null or undefined', function () {
        let func = fn('content'),
          ops = [{
            type: 'put',
            key: 'localhost/components/foo/instances/xyz',
            value: { content: null }
          }, {
            type: 'put',
            key: 'localhost/components/foo/instances/qrx',
            value: { content: 'value' }
          }, {
            type: 'put',
            key: 'localhost/components/foo/instances/baz',
            value: { content: { _ref: 'localhost/components/baz/instances/foo'} }
          }],
          db = {
            get: _.noop
          };

        sandbox.stub(db);
        setup.setDB(db);
        setup.options.db.get.returns(Promise.resolve('{"content": "value"}'));
        return func(ops).then(function (resp) {
          expect(resp).to.deep.equal([{
            type: 'put',
            key: 'localhost/components/foo/instances/qrx',
            value: { content: 'value' }
          }, {
            type: 'put',
            key: 'localhost/components/foo/instances/baz',
            value: { content: 'value' }
          }]);
        });
      });
    });
  });
});
