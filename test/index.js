/*jslint
mocha: true
*/
//Tells jshint not to bug me about describe, context, it, etc.

var mgPrivate = 'KEY-PRIVATEAPI';
var mgPublic = 'KEY-PUBLICAPI';
var mgDomain = 'testDomain.com';

var should = require('chai').should();
var expect = require('chai').expect;
var nock = require('nock');
var fs = require('fs');
var stream = require('stream');
var MailGun = require('../index.js');
var FormData = require('../lib/formdata.js');
var mgServer = nock('https://api.mailgun.net');
var mgVersion = 'v3';

describe('Mailgun', function() {
  describe('Internal Functions', function() {
    context('Form Data Library', function() {
      var fd;
      beforeEach(function() {
        fd = new FormData();
      });
      it('should create a boundry and datastream on creation', function() {
        fd._boundary.should.contain('--------------------------');
        fd.dataStream.should.be.a('object');
        fd.dataStream.should.contain.keys('_readableState');
      });
      it('should return the content type on contentType()', function() {
        fd.contentType.should.equal('multipart/form-data; boundary=' + fd._boundary);
      });
      it('should return the correct value for line breaks', function() {
        fd._lineBreak.should.equal('\r\n');
      });
      it('addData should throw error with no name or value', function() {
        expect(function() {
          fd.addData('name');
        }).to.throw(Error);
        expect(function() {
          fd.addData();
        }).to.throw(Error);
      });
      it('should increment dataCount when formData is added.', function() {
        fd.dataCount.should.equal(0);
        fd.addData('test', 'val');
        fd.dataCount.should.equal(1);
      });
      it('addData should add data to the stream', function(done) {
        var result = '';
        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          fd.dataCount.should.equal(1);
          result.should.include('testKey').and.include('testVal');
          var re = new RegExp(fd._boundary, 'g');
          result.match(re).length.should.equal(1);
          done();
        };

        fd.addData('testKey', 'testVal');
        fd.dataStream.push(null);
        fd.dataStream.pipe(streamCatch);
      });
      it('submitTo should stream form data to the writeable stream', function(done) {
        var result = '';
        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          fd.dataCount.should.equal(1);
          result.should.include('varKey11').and.include('varryVal5');
          var re = new RegExp(fd._boundary, 'g');
          result.match(re).length.should.equal(2);
          done();
        };

        fd.addData('varKey11', 'varryVal5');
        fd.submitTo(streamCatch);
      });
    });

    context('Constructor', function() {
      it('should return the correct objects on creation', function() {
        var mailGun = new MailGun({
          privateApi: 'privateapi',
          publicApi: 'publicapi',
          domainName: 'domainname'
        });
        MailGun.should.be.a('function');
        mailGun.should.be.a('object');
      });
      it('should store the passed options', function() {
        var mailGun = new MailGun({
          privateApi: 'privateapi',
          publicApi: 'publicapi',
          domainName: 'domainname'
        });
        mailGun.privateApi.should.equal('privateapi');
        mailGun.publicApi.should.equal('publicapi');
        mailGun.domainName.should.equal('domainname');
      });
      it('should throw an error if not public or private API set', function() {
        expect(function() {
          var mailGun = new MailGun();
        }).to.throw(Error);
        expect(function() {
          var mailGun = new MailGun({domainName: 'testDomain.com'});
        }).to.throw(Error);
      });
      it('should not error when one API key is set', function() {
        expect(function() {
          var mailGun = new MailGun({privateApi: 'privateapi'});
          mailGun = new MailGun({publicApi: 'publicapi'});
        }).to.not.throw(Error);
      });
    });

    context('_genHttpsOptions', function() {
      var mailGun = new MailGun({
          publicApi: mgPublic,
          privateApi: mgPrivate,
          domainName: mgDomain
        });
      it('should return an object', function() {
        mailGun._genHttpsOptions().should.be.a('object');
      });
      it('should correctly set resource, method, false for public api key', function() {
        var httpsOptions = mailGun._genHttpsOptions('/resource', 'method', false);
        httpsOptions.path.should.equal('/v3/resource');
        httpsOptions.method.should.equal('method');
        httpsOptions.auth.should.equal('api:' + mgPrivate);
      });
      it('should correctly set resource, method, true for public api key', function() {
        var httpsOptions = mailGun._genHttpsOptions('/resource', 'method', true);
        httpsOptions.path.should.equal('/v3/resource');
        httpsOptions.method.should.equal('method');
        httpsOptions.auth.should.equal('api:' + mgPublic);
      });
      it('should correctly set resource, method, empty third arg', function() {
        var httpsOptions = mailGun._genHttpsOptions('/resource', 'method');
        httpsOptions.path.should.equal('/v3/resource');
        httpsOptions.method.should.equal('method');
        httpsOptions.auth.should.equal('api:' + mgPrivate);
      });
    });

    context('_handleHttpsResponse', function() {
      //Test Returning Data to promise?
      it('should resolve promise on 200 status', function(done) {
        var mailGun = new MailGun({privateApi: mgPrivate});
        var promise = new Promise(function(resolve, reject) {
          var res = {
            statusCode: 200
          };
          mailGun._handleHttpsResponse(res, resolve, reject);
        });
        promise.then(done(), function() {
          throw new Error('Should have resolved and not rejected promise');
        });
      });
      it('should reject promise on any other status', function (done) {
        var mailGun = new MailGun({privateApi: mgPrivate});
        var promise = new Promise(function(resolve, reject) {
          var res = {
            statusCode: 500
          };
          mailGun._handleHttpsResponse(res, resolve, reject);
        });
        promise.then(function() {
          throw new Error('Should have rejected and not resolved promise');
        }, done());
      });
    });

    context('_determineDomain', function() {
      it('should return this.domainName if no domain is passed', function() {
        var mailGun = new MailGun({
          privateApi: mgPrivate,
          domainName: mgDomain
        });
        mailGun._determineDomain().should.equal(mgDomain);
      });
      it('should return domain if domain is passed', function() {
        var mailGun = new MailGun({
          privateApi: mgPrivate
        });
        mailGun._determineDomain('testdomain.com').should.equal('testdomain.com');
      });
      it('should return domain if both are present', function() {
        var mailGun = new MailGun({
          privateApi: mgPrivate,
          domainName: mgDomain
        });
        mailGun._determineDomain('testdomain.com').should.equal('testdomain.com');
      });
      it('should throw error if neither are present', function() {
        var mailGun = new MailGun({
          privateApi: mgPrivate
        });
        expect(function() {
          mailGun._determineDomain(undefined);
        }).to.throw(Error);
      });
    });

    context('_buildQueryString', function() {
      var mg;
      beforeEach(function() {
        mg = new MailGun({
          privateApi: mgPrivate,
          domainName: mgDomain
        });
      });
      it('should return an empty string with no query', function() {
        mg._buildQueryString().should.equal('');
      });
      it('should return a raw query string if given', function() {
        mg._buildQueryString('?var1=val1').should.equal('?var1=val1');
      });
      it('should append a question mark if given a raw query string missing one', function() {
        mg._buildQueryString('var1=val1').should.equal('?var1=val1');
      });
      it('should return a query string when given an object', function() {
        mg._buildQueryString({ var1: 'val1'}).should.equal('?var1=val1');
      });
      it('should throw an error with an invalid parameter type', function() {
        expect(function() {
          mg._buildQueryString(true);
        }).to.throw(Error);
      });
    });

    context('_buildFormData', function() {
      var mg;
      beforeEach(function() {
        mg = new MailGun({
          privateApi: mgPrivate,
          domainName: mgDomain
        });
      });

      it('should add a single form field when given as an object', function(done) {
        var result = '';
        var tmpForm = mg._buildFormData({
          field1: 'val1'
        });

        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          tmpForm.dataCount.should.equal(1);
          result.should.include('val1').and.include('field1');
          var re = new RegExp(tmpForm._boundary, 'g');
          result.match(re).length.should.equal(2);
          done();
        };

        tmpForm.submitTo(streamCatch);
      });
      it('should add multiple form fields given within an object', function(done) {
        var result = '';
        var tmpForm = mg._buildFormData({
          field1: 'val1',
          field2: 'val2',
          field3: 'val3'
        });

        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          tmpForm.dataCount.should.equal(3);
          result.should.include('val1').and.include('field1');
          result.should.include('val2').and.include('field2');
          result.should.include('val3').and.include('field3');
          var re = new RegExp(tmpForm._boundary, 'g');
          result.match(re).length.should.equal(4);
          done();
        };

        tmpForm.submitTo(streamCatch);
      });
      it('should add multiple records of the same form data for array values', function(done) {
        var result = '';
        var tmpForm = mg._buildFormData({
          field1: ['val1', 'val2', 'val3']
        });

        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          tmpForm.dataCount.should.equal(3);
          result.should.include('val1').and.include('field1');
          result.should.include('val2');
          result.should.include('val3');
          result.match(/field1/g).length.should.equal(3);
          var re = new RegExp(tmpForm._boundary, 'g');
          result.match(re).length.should.equal(4);
          done();
        };

        tmpForm.submitTo(streamCatch);
      });
      it('should add a file when type is given in the form field', function(done) {
        var result = '';
        var tmpForm = mg._buildFormData({
          fileTest: {
            fType: 'image/png',
            fLoc: __dirname + '/img/cat1.png'
          }
        });
        var catBuffer = fs.readFileSync(__dirname + '/img/cat1.png');

        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          tmpForm.dataCount.should.equal(1);
          result.should.include('image/png').and.include('cat1.png');
          result.match(/fileTest/g).length.should.equal(1);
          result.should.include(catBuffer);
          var re = new RegExp(tmpForm._boundary, 'g');
          result.match(re).length.should.equal(2);
          done();
        };

        tmpForm.submitTo(streamCatch);
      });
      it('should add multiple files of the same type with an array', function(done) {
        var result = '';
        var tmpForm = mg._buildFormData({
          fileTest: [{
            fType: 'image/png',
            fLoc: __dirname + '/img/cat1.png'
          },{
            fType: 'image/jpg',
            fLoc: __dirname + '/img/cat2.jpg'
          }]
        });
        var catBuffer = fs.readFileSync(__dirname + '/img/cat1.png');
        var catBuffer2 = fs.readFileSync(__dirname + '/img/cat2.jpg');

        var streamCatch = new stream.Writable();
        streamCatch.setDefaultEncoding('utf8');
        streamCatch.write = function(chunk) {
          result = result + chunk.toString('utf8');
        };
        streamCatch.end = function() {
          tmpForm.dataCount.should.equal(2);
          result.should.include('image/png').and.include('cat1.png');
          result.should.include('image/jpg').and.include('cat2.jpg');
          result.match(/fileTest/g).length.should.equal(2);
          result.should.include(catBuffer);
          result.should.include(catBuffer2);
          var re = new RegExp(tmpForm._boundary, 'g');
          result.match(re).length.should.equal(3);
          done();
        };

        tmpForm.submitTo(streamCatch);
      });
    });

    context('_sendRequest', function() {
      var mg;
      beforeEach(function() {
        mg = new MailGun({
          privateApi: mgPrivate,
          domainName: mgDomain
        });
      });
      it('should throw an error if path is missing', function() {
        return expect(function() {
          mg._sendRequest();
        }).to.throw(Error);
      });
      it('should throw an error if method is missing', function() {
        return expect(function() {
          mg._sendRequest('testPath');
        }).to.throw(Error);
      });
      it('should throw an error if options is not an object.', function() {
        return expect(function() {
          mg._sendRequest('testPath', 'POST', 'string');
        }).to.throw(Error);
      });
      it('should set options to an empty object if none passed', function() {
        mgServer.get('/' + mgVersion +
          '/testPath')
        .reply(200, {message: 'yes'});
        return mg._sendRequest('/testPath', 'GET')
          .then(function(res) {
            res.message.should.equal('yes');
          }, function() {
            throw new Error('This should have resolved the promise.');
          });
      });
      it('should replace <> with current domain if present', function() {
        mgServer.get('/' + mgVersion +
          '/' + mgDomain + '/testPath')
        .reply(200, {message: 'yes'});
        return mg._sendRequest('/<>/testPath', 'GET', {domain: mgDomain})
          .then(function(res) {
            res.message.should.equal('yes');
          }, function() {
            throw new Error('This should have resolved the promise.');
          });
      });
      /*These tests are not in this module anymore, however I am leaving them here
        to ensure constant functionality. */
      it('should add and send formData if present', function() {
        mgServer.post('/' + mgVersion +
          '/testPath')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });
        return mg._sendRequest('/testPath', 'POST', {formData: {test1: 'zzzzzzzzzzzzz'}})
          .then(function(res) {
            res.data.should.contain('zzzzzzzzzzzzz');
          }, function() {
            throw new Error('This should have resolved the promise.');
          });
      });
      it('should turn an array of formData into seperate keys', function() {
        mgServer.post('/' + mgVersion +
          '/testPath')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });
        return mg._sendRequest('/testPath', 'POST', {
          formData: {
            test1: ['qwerty', 'asdfg', 'zxcvb']
          }
        })
        .then(function(res) {
          res.data.should.contain('qwerty').and.contain('asdfg').and.contain('zxcvb');
          res.data.match(/test1/g).length.should.equal(3);
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should return a promise', function() {
        mgServer.get('/' + mgVersion +
          '/testPath')
        .reply(200, {message: 'yes'});
        return expect(mg._sendRequest('/testPath', 'GET')).to.be.a('promise');
      });
      it('should resolve promise on 200 status', function() {
        mgServer.get('/' + mgVersion +
          '/testPath')
        .reply(200, {message: 'yes'});
        return mg._sendRequest('/testPath', 'GET')
          .then(function(res) {
            res.message.should.equal('yes');
          }, function() {
            throw new Error('This should have resolved the promise.');
          });
      });
      it('should reject promise on non-200 status', function() {
        mgServer.get('/' + mgVersion +
          '/testPath')
        .reply(500, {message: 'yes'});
        return mg._sendRequest('/testPath', 'GET')
          .then(function(res) {
            throw new Error('This should have rejected the promise.');
          }, function(res) {
            res.message.should.equal('yes');
          });
      });
      it('should reject promise on connection error', function() {
        mgServer.get('/' + mgVersion +
          '/testPath')
        .replyWithError('Connection Problem');
        return mg._sendRequest('/testPath', 'GET')
          .then(function(res) {
            throw new Error('This should have rejected the promise.');
          }, function(res) {
            res.message.should.include('Problem connecting');
          });
      });
    });
  });

  describe('Messages', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('sendEmail (POST /<domain>/messages)', function() {
      it('should throw an error if nothing is passed', function() {
        expect(function() {
          return mg.sendEmail();
        }).to.throw(Error);
      });
      it('should throw an error if the first parameter is not an object', function() {
        expect(function() {
          return mg.sendEmail('aString');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/messages')
        .reply(200, {message: 'success'});

        return mg.sendEmail({
          to: 'test@test.com'
        }).then(function(res) {
          res.message.should.equal('success');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
    });

    context('getStoredMessages (GET /domains/<domain>/messages/<msgId>)', function() {
      it('should access the correct endpoint with no parameters', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/events?event=stored')
        .reply(200, {message: 'OK'});

        return mg.getStoredMessages().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
      it('should retrieve the correct message with ID', function() {
        var msgId = 'thisMsg';
        mgServer.get('/' + mgVersion +
        '/domains/' + mgDomain + '/messages/' + msgId)
        .reply(200, {message: 'OK'});

        return mg.getStoredMessages(msgId).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
      it('should recognize the domain when supplied as first argument', function() {
        var otherDomain = 'test.com';
        mgServer.get('/' + mgVersion +
        '/' + otherDomain + '/events?event=stored')
        .reply(200, {message: 'OK'});

        return mg.getStoredMessages(otherDomain).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('deleteStoredMessages (DELETE /domains/<domain>/messages/<msgId>)', function() {
      var msgId = 'thisMsg';
      it('should throw an error if no msgId is given', function() {
        expect(function() {
          return mg.deleteStoredMessages();
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        mgServer.delete('/' + mgVersion +
        '/domains/' + mgDomain + '/messages/' + msgId)
        .reply(200, {message: 'OK'});

        return mg.deleteStoredMessages(msgId).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
    });
  });

  describe('Domains', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getInformation (GET /domains/<domain>)', function() {
      it('should access the correct endpoint', function() {
        mgServer.get('/' + mgVersion +
        '/domains/' + mgDomain)
        .reply(200, {message: 'OK'});

        return mg.getInformation().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('addNewDomain (POST /domains)', function() {
      it('should throw an error when no domain is given', function() {
        expect(function() {
          return mg.addNewDomain();
        }).to.throw(Error);
      });
      it('should throw an error when no default password is given', function() {
        expect(function() {
          return mg.addNewDomain('test.com');
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        mgServer.post('/' + mgVersion +
        '/domains')
        .reply(200, {message: 'OK'});
        return mg.addNewDomain('test.com', 'smtpPassword', true, 'tag').then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This promise should have resolved');
        });
      });
      it('should accept spaAction values in wildcard slot', function() {
        mgServer.post('/' + mgVersion +
        '/domains')
        .reply(200, {message: 'OK'});
        return mg.addNewDomain('test.com', 'smtpPassword', 'tag').then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This promise should have resolved');
        });
      });
      it('should set default values to tag and false', function() {
        mgServer.post('/' + mgVersion +
        '/domains')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });
        return mg.addNewDomain('test.com', 'smtpPassword').then(function(res) {
          res.data.should.include('tag').include('false');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('deleteDomain (DELETE /domains/<domain>)', function() {
      var domainToDelete = 'haxxor.org';
      it('should throw an error if no domain is given', function() {
        expect(function() {
          return mg.deleteDomain();
        }).to.throw(Error);
      });
      it('should access the correct resource', function() {
        mgServer.delete('/' + mgVersion +
        '/domains/' + domainToDelete)
        .reply(200, {message: 'OK'});

        return mg.deleteDomain(domainToDelete).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('getSmtpUsers (GET /domains/<domain>/credentials)', function() {
      it('should access the correct endpoint', function() {
        mgServer.get('/' + mgVersion +
        '/domains/' + mgDomain + '/credentials')
        .reply(200, {message: 'OK'});

        return mg.getSmtpUsers().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
    });

    context('addSmtpUser (POST /domains/<domain>/credentials)', function() {
      it('should throw an error if username is missing', function() {
        expect(function() {
          return mg.addSmtpUser();
        }).to.throw(Error);
      });
      it('should throw error if password is too short', function() {
        expect(function() {
          return mg.addSmtpUser('username', 'pas');
        }).to.throw(Error);
      });
      it('should throw error if password it too long', function() {
        expect(function() {
          return mg.addSmtpUser('username', 'passwordistoolongandidontcarewhereareyouallimissyou');
        }).to.throw(Error);
      });
      it('should throw an error if password is missing', function() {
        expect(function() {
          return mg.addSmtpUser('username');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        mgServer.post('/' + mgVersion +
        '/domains/' + mgDomain + '/credentials')
        .reply(200, function(uri, postData) {
          return {data: postData};
        });

        var thisUser = 'yoonie';
        var thisPass = 'notsecure';

        return mg.addSmtpUser(thisUser, thisPass).then(function(res) {
          res.data.should.include(thisUser).include(thisPass);
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('updateSmtpUser (PUT /domains/<domain>/credentials/<username>)', function() {
      it('should throw an error if username is missing', function() {
        expect(function() {
          return mg.updateSmtpUser();
        }).to.throw(Error);
      });
      it('should throw error if password is too short', function() {
        expect(function() {
          return mg.updateSmtpUser('username', 'pas');
        }).to.throw(Error);
      });
      it('should throw error if password it too long', function() {
        expect(function() {
          return mg.updateSmtpUser('username', 'passwordistoolongandidontcarewhereareyouallimissyou');
        }).to.throw(Error);
      });
      it('should throw an error if password is missing', function() {
        expect(function() {
          return mg.updateSmtpUser('username');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var thisUser = 'yoonie';
        var thisPass = 'notsecure';

        mgServer.put('/' + mgVersion +
        '/domains/' + mgDomain + '/credentials/' + thisUser)
        .reply(200, function(uri, postData) {
          return {data: postData};
        });

        return mg.updateSmtpUser(thisUser, thisPass).then(function(res) {
          res.data.should.include(thisPass);
        }, function(res) {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('deleteSmtpUser (DELETE /domains/<domain>/credentials/<username>)', function() {
      it('should throw an error if no username is given', function() {
        expect(function() {
          return mg.deleteSmtpUser();
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var thisUser = 'Angela';

        mgServer.delete('/' + mgVersion +
        '/domains/' + mgDomain + '/credentials/' + thisUser)
        .reply(200, {message: 'OK'});

        return mg.deleteSmtpUser(thisUser).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('getConnectionSettings (GET /domains/<domain>/connection)', function() {
      it('should access the correct resource', function() {
        mgServer.get('/' + mgVersion +
        '/domains/' + mgDomain + '/connection')
        .reply(200, {message: 'OK'});

        return mg.getConnectionSettings().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
    });

    context('updateConnectionSettings (PUT /domains/<domain>/connection)', function() {
      it('should throw an error when requireTLS is missing', function() {
        expect(function() {
          return mg.updateConnectionSettings();
        }).to.throw(Error);
      });
      it('should throw an error when skipVerfication is missing', function() {
        expect(function() {
          return mg.updateConnectionSettings(true);
        }).to.throw(Error);
      });
      it('should access the correct resource', function() {
        mgServer.put('/' + mgVersion +
        '/domains/' + mgDomain + '/connection')
        .reply(200, function(uri, postData) {
          return {data: postData};
        });

        mg.updateConnectionSettings(true, false).then(function(res) {
          res.should.include('true').include('false');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });
  });

  describe('Stats', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getStats (GET /<domain>/stats)', function() {
      it('should retrieve the correct resource with no query', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/stats')
        .reply(200, {message: 'OK'});

        return mg.getStats().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have resolved.');
        });
      });
      it('should retrieve the correct resource with query string', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/stats?var1=val1')
        .reply(200, {message: 'OK'});

        return mg.getStats('var1=val1').then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have resolved.');
        });
      });
    });

    context('deleteStats (DELETE /<domain>/tags/<tagName>)', function() {
      it('should throw an error with no tagname given', function() {
        expect(function() {
          return mg.deleteStats();
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var tagName = 'Norma';
        mgServer.delete('/' + mgVersion +
        '/' + mgDomain + '/tags/' + tagName)
        .reply(200, {message: 'OK'});

        return mg.deleteStats(tagName).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
    });
  });

  describe('Events', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getEvents (GET /<domain>/events)', function() {
      it('should retrieve the correct endpoint with no query', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/events')
        .reply(200, {message: 'OK'});

        return mg.getEvents().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
      it('should retrieve the correct endpoint wit query string', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/events?var1=val1')
        .reply(200, {message: 'OK'});

        return mg.getEvents({var1: 'val1'}).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
    });
  });

  describe('Supressions', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getBounces (GET /<domain>/bounces/<address>)', function() {
      it('should throw error if search is not a number or string', function() {
        expect(function() {
          return mg.getBounces(true);
        }).to.throw(Error);
      });
      it('should get the correct resource when limit is given', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/bounces?limit=22')
        .reply(200, {message: 'OK'});

        return mg.getBounces(22).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get the correct resource when address is given', function() {
        var email = 'yoonie@gmail.com';

        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/bounces/' + email)
        .reply(200, {message: 'OK'});

        return mg.getBounces(email).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get the correct resource when no search is given', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/bounces')
        .reply(200, {message: 'OK'});

        return mg.getBounces().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
    });

    context('addBounces (POST /<domain>/bounces)', function() {
      it('should throw an error if no addresses are passed', function() {
        expect(function() {
          return mg.addBounces();
        }).to.throw(Error);
      });
      it('should throw an error if addresses is not an object or array', function() {
        expect(function() {
          return mg.addBounces(345353535);
        }).to.throw(Error);
      });
      it('should convert an object to an array', function() {
        var testObj = {
          bounceName: '73465837465345345',
        };

        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/bounces')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });

        return mg.addBounces(testObj).then(function(res) {
          res.data.should.include(JSON.stringify(testObj));
        }, function() {
          throw new Error('This should have resovled the promise.');
        });
      });
      it('should correctly send an array', function() {
        var testObj = [{
          bounceName: '73465837465345345',
        }];

        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/bounces')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });

        return mg.addBounces(testObj).then(function(res) {
          res.data.should.include(JSON.stringify(testObj));
        }, function() {
          throw new Error('This should have resovled the promise.');
        });
      });
    });

    context('deleteBounces (DELETE /<domain>/bounces/<address>)', function() {
      it('should throw an error if no address is given', function() {
        expect(function() {
          return mg.deleteBounces();
        }).to.throw(Error);
      });
      it('should throw an error if a non-string is given', function() {
        expect(function() {
          return mg.deleteBounces(564373456);
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        var thisEmail = 'aclewis@mail.sfsu.edu';

        mgServer.delete('/' + mgVersion +
        '/' + mgDomain + '/bounces/' + thisEmail)
        .reply(200, {message: 'OK'});

        return mg.deleteBounces(thisEmail).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have resolved.');
        });
      });
    });

    context('getUnsubscribes (GET /<domain>/unsubscribes/<address>)', function() {
      it('should throw error if search is not a number or string', function() {
        expect(function() {
          return mg.getUnsubscribes(true);
        }).to.throw(Error);
      });
      it('should get the correct resource when limit is given', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/unsubscribes?limit=22')
        .reply(200, {message: 'OK'});

        return mg.getUnsubscribes(22).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get the correct resource when address is given', function() {
        var email = 'yoonie@gmail.com';

        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/unsubscribes/' + email)
        .reply(200, {message: 'OK'});

        return mg.getUnsubscribes(email).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get the correct resource when no search is given', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/unsubscribes')
        .reply(200, {message: 'OK'});

        return mg.getUnsubscribes().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
    });

    context('addUnsubscribes (POST /<domain>/unsubscribes)', function() {
      it('should throw an error if no addresses are passed', function() {
        expect(function() {
          return mg.addUnsubscribes();
        }).to.throw(Error);
      });
      it('should throw an error if addresses is not an object or array', function() {
        expect(function() {
          return mg.addUnsubscribes(345353535);
        }).to.throw(Error);
      });
      it('should convert an object to an array', function() {
        var testObj = {
          bounceName: '73465837465345345',
        };

        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/unsubscribes')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });

        return mg.addUnsubscribes(testObj).then(function(res) {
          res.data.should.include(JSON.stringify(testObj));
        }, function() {
          throw new Error('This should have resovled the promise.');
        });
      });
      it('should correctly send an array', function() {
        var testObj = [{
          bounceName: '73465837465345345',
        }];

        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/unsubscribes')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });

        return mg.addUnsubscribes(testObj).then(function(res) {
          res.data.should.include(JSON.stringify(testObj));
        }, function() {
          throw new Error('This should have resovled the promise.');
        });
      });
    });

    context('deleteUnsubscribes (DELETE /<domain>/unsubscribes/<address>)', function() {
      it('should throw an error if no address is given', function() {
        expect(function() {
          return mg.deleteUnsubscribes();
        }).to.throw(Error);
      });
      it('should throw an error if a non-string is given', function() {
        expect(function() {
          return mg.deleteUnsubscribes(564373456);
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        var thisEmail = 'aclewis@mail.sfsu.edu';

        mgServer.delete('/' + mgVersion +
        '/' + mgDomain + '/unsubscribes/' + thisEmail)
        .reply(200, {message: 'OK'});

        return mg.deleteUnsubscribes(thisEmail).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have resolved.');
        });
      });
    });

    context('getComplaints (GET /<domain>/complaints/<address>)', function() {
      it('should throw error if search is not a number or string', function() {
        expect(function() {
          return mg.getComplaints(true);
        }).to.throw(Error);
      });
      it('should get the correct resource when limit is given', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/complaints?limit=22')
        .reply(200, {message: 'OK'});

        return mg.getComplaints(22).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get the correct resource when address is given', function() {
        var email = 'yoonie@gmail.com';

        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/complaints/' + email)
        .reply(200, {message: 'OK'});

        return mg.getComplaints(email).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get the correct resource when no search is given', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/complaints')
        .reply(200, {message: 'OK'});

        return mg.getComplaints().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
    });

    context('addComplaints (POST /<domain>/complaints)', function() {
      it('should throw an error if no addresses are passed', function() {
        expect(function() {
          return mg.addComplaints();
        }).to.throw(Error);
      });
      it('should throw an error if addresses is not an object or array', function() {
        expect(function() {
          return mg.addComplaints(345353535);
        }).to.throw(Error);
      });
      it('should convert an object to an array', function() {
        var testObj = {
          bounceName: '73465837465345345',
        };

        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/complaints')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });

        return mg.addComplaints(testObj).then(function(res) {
          res.data.should.include(JSON.stringify(testObj));
        }, function() {
          throw new Error('This should have resovled the promise.');
        });
      });
      it('should correctly send an array', function() {
        var testObj = [{
          bounceName: '73465837465345345',
        }];

        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/complaints')
        .reply(200, function(uri, postBody) {
          return {data: postBody};
        });

        return mg.addComplaints(testObj).then(function(res) {
          res.data.should.include(JSON.stringify(testObj));
        }, function() {
          throw new Error('This should have resovled the promise.');
        });
      });
    });

    context('deleteComplaints (DELETE /<domain>/complaints/<address>)', function() {
      it('should throw an error if no address is given', function() {
        expect(function() {
          return mg.deleteComplaints();
        }).to.throw(Error);
      });
      it('should throw an error if a non-string is given', function() {
        expect(function() {
          return mg.deleteComplaints(564373456);
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        var thisEmail = 'aclewis@mail.sfsu.edu';

        mgServer.delete('/' + mgVersion +
        '/' + mgDomain + '/complaints/' + thisEmail)
        .reply(200, {message: 'OK'});

        return mg.deleteComplaints(thisEmail).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have resolved.');
        });
      });
    });
  });

  describe('Routes', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getRoutes (GET /routes/<id>)', function() {
      it('should get the correct endpoint with default values', function() {
        mgServer.get('/' + mgVersion +
        '/routes?limit=100&skip=0')
        .reply(200, {message: 'OK'});

        return mg.getRoutes().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
      it('should get a specific route if ID given as first argv', function() {
        var routeId = 'yoonie';

        mgServer.get('/' + mgVersion +
        '/routes/' + routeId)
        .reply(200, {message: 'OK'});

        return mg.getRoutes(routeId).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
      it('should get the correct endpoint with custom parameters', function() {
        mgServer.get('/' + mgVersion +
        '/routes?limit=444&skip=3')
        .reply(200, {message: 'OK'});

        return mg.getRoutes(444, 3).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('addRoutes (POST /routes)', function() {
      it('should throw an error if no data is passed to the function', function() {
        expect(function() {
          return mg.addRoutes(222);
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        mgServer.post('/' + mgVersion +
        '/routes')
        .reply(200, function(uri, body) {
          return {data: body};
        });

        return mg.addRoutes({
          filter: '*@mail.com'
        }).then(function(res) {
          res.data.should.include('*@mail.com');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('updateRoutes (PUT /routes/<id>)', function() {
      it('should throw an error if id is not given', function() {
        expect(function() {
          return mg.updateRoutes();
        }).to.throw(Error);
      });
      it('should throw an error if no update information is given', function() {
        expect(function() {
          return mg.updateRoutes('routeID');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var routeId = 'soohyun';

        mgServer.put('/' + mgVersion +
        '/routes/' + routeId)
        .reply(200, function(uri, body) {
          return {data: body};
        });

        return mg.updateRoutes(routeId, {
          filter: '*.*@mail.com'
        }).then(function(res) {
          res.data.should.include('*.*@mail.com');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('deleteRoutes (DELETE /routes/<id>)', function() {
      it('should throw an error if route ID is missing', function() {
        expect(function() {
          return mg.deleteRoutes();
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var routeId = 'soohyun';

        mgServer.delete('/' + mgVersion +
        '/routes/' + routeId)
        .reply(200, {message: 'OK'});

        return mg.deleteRoutes(routeId).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });
  });

  describe('Campaigns', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getCampaigns (GET /<domain>/campaigns)', function() {
      it('should return a single campaign if a string is given', function() {
        var campId = 'christa';

        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/campaigns/' + campId)
        .reply(200, {message: 'OK'});

        return mg.getCampaigns(campId).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should get default values with no parameters passed', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/campaigns?limit=100&skip=0')
        .reply(200, {message: 'OK'});

        return mg.getCampaigns().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should accept custom values for limit and skip', function() {
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/campaigns?limit=33&skip=76')
        .reply(200, {message: 'OK'});

        return mg.getCampaigns(33,76).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should find domain in limit filed', function() {
        var newDomain = 'frozen.com';

        mgServer.get('/' + mgVersion +
        '/' + newDomain + '/campaigns?limit=100&skip=0')
        .reply(200, {message: 'OK'});

        return mg.getCampaigns(newDomain).then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should find domain in skip fields', function() {
        var newDomain = 'ana.com';

        mgServer.get('/' + mgVersion +
        '/' + newDomain + '/campaigns?limit=22&skip=0')
        .reply(200, {message: 'OK'});

        return mg.getCampaigns(22, newDomain).then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This should have resolved the promise.' + res);
        });
      });
    });

    context('addCampaigns (POST /<domain>/campaigns)', function() {
      it('should throw an error with no campaign name', function() {
        expect(function() {
          return mg.addCampaigns();
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        mgServer.post('/' + mgVersion +
        '/' + mgDomain + '/campaigns')
        .reply(200, function(uri, body) {
          return {data: body};
        });

        return mg.addCampaigns({name: 'campName'}).then(function(res) {
          res.data.should.include('campName');
        }, function(res) {
          console.log(res);
          throw new Error('This should have resolved the promise');
        });
      });
    });

    context('updateCampaigns (PUT /<domain>/campaigns/<Id>)', function() {
      it('should throw an error if id is not given', function() {
        expect(function() {
          return mg.updateCampaigns();
        }).to.throw(Error);
      });
      it('should throw an error if no update information is given', function() {
        expect(function() {
          return mg.updateCampaigns('campId');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var campId = 'soohyun';

        mgServer.put('/' + mgVersion +
        '/' + mgDomain + '/campaigns/' + campId)
        .reply(200, function(uri, body) {
          return {data: body};
        });

        return mg.updateCampaigns(campId, {
          name: 'newCampName'
        }).then(function(res) {
          res.data.should.include('newCampName');
        }, function(res) {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('deleteCampaigns (DELETE /<domain>/campaigns/<Id>)', function() {
      it('should throw an error if campaign ID is missing', function() {
        expect(function() {
          return mg.deleteCampaigns();
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var campId = 'soohyun';

        mgServer.delete('/' + mgVersion +
        '/' + mgDomain + '/campaigns/' + campId)
        .reply(200, {message: 'OK'});

        return mg.deleteCampaigns(campId).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('getCampaignsEvents (GET  /<domain>/campaigns/<id>/<eventName>)', function() {
      it('should throw an error where campId is empty', function() {
        expect(function() {
          return mg.getCampaignsEvents();
        }).to.throw(Error);
      });
      it('should get all events with no event type given', function() {
        var campId = "igdf84hkjshdf";
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/campaigns/' + campId + '/events')
        .reply(200, {message: 'OK'});

        return mg.getCampaignsEvents(campId).then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should throw an error if event type is not valid', function() {
        expect(function() {
          return mg.getCampaignsEvents('campId', 'notAEvent');
        }).to.throw(Error);
      });
      it('should convert options into a query string', function() {
        var campId = "igdf84hkjshdf";
        mgServer.get('/' + mgVersion +
        '/' + mgDomain + '/campaigns/' + campId + '/opens?limit=50')
        .reply(200, {message: 'OK'});

        return mg.getCampaignsEvents(campId, 'opens', {limit: 50}).then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This should have resolved the promise.');
        });

      });
      it('should find the domain in the events field', function() {
        var newDomain = "newdomain.com";
        var campId = "igdf84hkjshdf";

        mgServer.get('/' + mgVersion +
        '/' + newDomain + '/campaigns/' + campId + '/events')
        .reply(200, {message: 'OK'});

        return mg.getCampaignsEvents(campId, newDomain).then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This should have resolved the promise.');
        });
      });
      it('should find the domain in the options field', function() {
        var newDomain = "newdomain.com";
        var campId = "igdf84hkjshdf";

        mgServer.get('/' + mgVersion +
        '/' + newDomain + '/campaigns/' + campId + '/clicks')
        .reply(200, {message: 'OK'});

        return mg.getCampaignsEvents(campId, 'clicks', newDomain).then(function(res) {
          res.message.should.equal('OK');
        }, function(res) {
          throw new Error('This should have resolved the promise.');
        });
      });
    });
  });

  describe('Webhooks', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getWebhooks (GET /domains/<domain>/webhooks/<webhookname>)', function() {
      it('should get the correct resource with no agruments', function() {
        mgServer.get('/' + mgVersion +
        '/domains/' + mgDomain + '/webhooks')
        .reply(200, {message: 'OK'});

        return mg.getWebhooks().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
      it('should throw an error on invalid hook name', function() {
        expect(function() {
          return mg.getWebhooks('badHookName');
        }).to.throw(Error);
      });
      it('should return one webhook if hookName is given', function() {
        var hookName = 'spam';
        mgServer.get('/' + mgVersion +
        '/domains/' + mgDomain + '/webhooks/spam')
        .reply(200, {message: 'OK'});

        return mg.getWebhooks(hookName).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
      it('should find domain if put in hookName', function() {
        var newDomain = 'www.newdomain.com';
        mgServer.get('/' + mgVersion +
        '/domains/' + newDomain + '/webhooks')
        .reply(200, {message: 'OK'});

        return mg.getWebhooks(newDomain).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
    });

    context('addWebhooks (POST /domains/<domain>/webhooks)', function() {
      it('should throw an error with not arguments', function() {
        expect(function() {
          return mg.addWebhooks();
        }).to.throw(Error);
      });
      it('should throw an error with invalid hook type', function() {
        expect(function() {
          return mg.addWebhooks('notavalidhook');
        }).to.throw(Error);
      });
      it('should throw an error with no url', function() {
        expect(function() {
          return mg.addWebhooks('spam');
        }).to.throw(Error);
      });
      it('should reach the correct resoruce', function() {
        mgServer.post('/' + mgVersion +
        '/domains/' + mgDomain + '/webhooks')
        .reply(200, {message: 'OK'});

        return mg.addWebhooks('click', 'http://web.hook.com').then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('updateWebhooks (PUT /domains/<domain>/webhooks/<webhookname>)', function() {
      it('should throw an error with not arguments', function() {
        expect(function() {
          return mg.updateWebhooks();
        }).to.throw(Error);
      });
      it('should throw an error with invalid hook type', function() {
        expect(function() {
          return mg.updateWebhooks('notavalidhook', 'http://url.here.net');
        }).to.throw(Error);
      });
      it('should throw an error with no url', function() {
        expect(function() {
          return mg.updateWebhooks('spam');
        }).to.throw(Error);
      });
      it('should reach the correct resoruce', function() {
        var hookName = 'click';

        mgServer.put('/' + mgVersion +
        '/domains/' + mgDomain + '/webhooks/' + hookName)
        .reply(200, {message: 'OK'});

        return mg.updateWebhooks(hookName, 'http://web.hook.com').then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('deleteWebhooks (DELETE /domains/<domain>/webhooks/<webhookname>)', function() {
      it('should throw an error with not arguments', function() {
        expect(function() {
          return mg.deleteWebhooks();
        }).to.throw(Error);
      });
      it('should throw an error with invalid hook type', function() {
        expect(function() {
          return mg.deleteWebhooks('notavalidhook', 'http://url.here.net');
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        var hookName = 'deliver';

        mgServer.delete('/' + mgVersion +
        '/domains/' + mgDomain + '/webhooks/' + hookName)
        .reply(200, {message: 'OK'});

        return mg.deleteWebhooks(hookName).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });
  });

  describe('Mailing Lists', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('getMailLists (GET /lists/<address>)', function() {
      it('should get all mailing lists with no parameters', function() {
        mgServer.get('/' + mgVersion +
        '/lists')
        .reply(200, {message: 'OK'});

        return mg.getMailLists().then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
      it('should get one mailing list with a list address', function() {
        var testAddress = 'sf@sf.com';

        mgServer.get('/' + mgVersion +
        '/lists/' + testAddress)
        .reply(200, {message: 'OK'});

        return mg.getMailLists(testAddress).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
      it('should allow for search strings', function() {
        var testAddress = 'sf@sf.com';
        var queryString = 'limit=4';

        mgServer.get('/' + mgVersion +
        '/lists?' + queryString)
        .reply(200, {message: 'OK'});

        return mg.getMailLists(queryString).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('addMailLists (POST /lists)', function() {
      it('should throw an error when no listData is given', function() {
        expect(function() {
          return mg.addMailLists();
        }).to.throw(Error);
      });
      it('should throw an error if listData is not an object', function() {
        expect(function() {
          return mg.addMailLists(true);
        }).to.throw(Error);
      });
      it('should send the list data to the correct resource', function() {
        mgServer.post('/' + mgVersion +
        '/lists')
        .reply(200, {message: 'OK'});

        return mg.addMailLists({name: 'newList'}).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved.');
        });
      });
    });

    context('updateMailLists (PUT /lists/<address>)', function() {
      it('should throw an error if listAddress is empty', function() {
        expect(function() {
          return mg.updateMailLists();
        }).to.throw(Error);
      });
      it('should throw an error if listData is empty', function() {
        expect(function() {
          return mg.updateMailLists('test@kylebaldw.in');
        }).to.throw(Error);
      });
      it('should send the information to the correct resource', function() {
        var thisAddress = 'yoonie@gmail.com';

        mgServer.put('/' + mgVersion +
        '/lists/' + thisAddress)
        .reply(200, {message: 'OK'});

        return mg.updateMailLists(thisAddress, {description: 'Yea. New Words'}).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
    });

    context('deleteMailLists (DELETE /lists/<address>)', function() {
      it('should throw an error if listAddress is empty', function() {
        expect(function() {
          return mg.deleteMailLists();
        }).to.throw(Error);
      });
      it('should send the information to the correct resource', function() {
        var thisAddress = 'yoonie@gmail.com';

        mgServer.delete('/' + mgVersion +
        '/lists/' + thisAddress)
        .reply(200, {message: 'OK'});

        return mg.deleteMailLists(thisAddress).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
    });

    context('getMailListsMembers (GET /lists/<address>/members/<member_address>)', function() {
      it('should throw an error if listAddress is missing', function() {
        expect(function() {
          return mg.getMailListsMembers();
        }).to.throw(Error);
      });
      it('should get all members if only listAddress is given', function() {
        var listAddress = 'list@kylebaldw.in';

        mgServer.get('/' + mgVersion +
        '/lists/' + listAddress + '/members')
        .reply(200, {message: 'OK'});

        return mg.getMailListsMembers(listAddress).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
      it('should get a single member record if memberAddress is given', function() {
        var listAddress = 'list@kylebaldw.in';
        var memberAddress = 'celes@kylebaldw.in';

        mgServer.get('/' + mgVersion +
        '/lists/' + listAddress + '/members/' + memberAddress)
        .reply(200, {message: 'OK'});

        return mg.getMailListsMembers(listAddress, memberAddress).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This should have resolved the promise');
        });
      });
    });

    context('addMailListsMembers (POST /lists/<address>/members.json)', function() {
      it('should throw an eror if listAddress is missing', function() {
        expect(function() {
          return mg.addMailListsMembers();
        }).to.throw(Error);
      });
      it('should throw an error if memberObject is missing', function() {
        expect(function() {
          return mg.addMailListsMembers('list@address.com');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var listAddress = 'shiva@square.com';

        mgServer.post('/' + mgVersion +
        '/lists/' + listAddress + '/members.json')
        .reply(200, {message: 'OK'});

        return mg.addMailListsMembers(listAddress, {email: 'new@tolist.com'}).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should be resolved.');
        });
      });
      it('should set upsert to be no if not given', function() {
        var listAddress = 'shiva@square.com';

        mgServer.post('/' + mgVersion +
        '/lists/' + listAddress + '/members.json')
        .reply(200, function(uri, body) {
          return {data: body};
        });

        return mg.addMailListsMembers(listAddress, {email: 'new@tolist.com'}).then(function(res) {
          res.data.should.include('no');
          res.data.should.include('upsert');
        }, function() {
          throw new Error('This promise should be resolved.');
        });
      });
    });

    context('updateMailListsMembers (PUT /lists/<address>/members/<member_address>)', function() {
      it('should throw an eror if listAddress is missing', function() {
        expect(function() {
          return mg.updateMailListsMembers();
        }).to.throw(Error);
      });
      it('should throw an error if memberAddress is missing', function() {
        expect(function() {
          return mg.updateMailListsMembers('list@address.com');
        }).to.throw(Error);
      });
      it('should throw an error if memberObject is missing', function() {
        expect(function() {
          return mg.updateMailListsMembers('list@address.com', 'member@address.com');
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var listAddress = 'list@address.com';
        var memberAddress = 'member@address.com';

        mgServer.put('/' + mgVersion +
        '/lists/' + listAddress + '/members/' + memberAddress)
        .reply(200, {message: 'OK'});

        return mg.updateMailListsMembers(listAddress, memberAddress, {vars: {test: true}}).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
    });

    context('deleteMailListsMembers (DELETE /lists/<address>/members/<member_address>)', function() {
      it('should throw an eror if listAddress is missing', function() {
        expect(function() {
          return mg.deleteMailListsMembers();
        }).to.throw(Error);
      });
      it('should throw an error if memberAddress is missing', function() {
        expect(function() {
          return mg.deleteMailListsMembers('list@address.com');
        }).to.throw(Error);
      });
      it('should reach the correct endpoint', function() {
        var listAddress = 'list@address.com';
        var memberAddress = 'member@address.com';

        mgServer.delete('/' + mgVersion +
        '/lists/' + listAddress + '/members/' + memberAddress)
        .reply(200, {message: 'OK'});

        return mg.deleteMailListsMembers(listAddress, memberAddress).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
    });
  });

  describe('Email Validation', function() {
    var mg;
    beforeEach(function() {
      mg = new MailGun({
        privateApi: mgPrivate,
        publicApi: mgPublic,
        domainName: mgDomain
      });
    });

    context('validateEmail (GET /address/validate)', function() {
      it('should throw an error if emailToCheck is missing', function() {
        expect(function() {
          return mg.validateEmail();
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var emailToCheck = 'amivalid@maybe.com';

        mgServer.get('/' + mgVersion +
        '/address/validate?address=' + encodeURIComponent(emailToCheck))
        .reply(200, {message: 'OK'});

        return mg.validateEmail(emailToCheck).then(function(res) {
          res.message.should.equal('OK');
        }, function(r) {
          throw new Error('This promise should have been resolved');
        });
      });
    });

    context('parseEmail (GET /address/parse)', function() {
      it('should throw an error if emailToParse is missing', function() {
        expect(function() {
          return mg.parseEmail();
        }).to.throw(Error);
      });
      it('should throw an error if syntaxOnly is not boolean or undefined', function() {
        expect(function() {
          return mg.parseEmail('emails@email.com', 67264834);
        }).to.throw(Error);
      });
      it('should access the correct endpoint', function() {
        var emailToCheck = 'amivalid@maybe.com';
        var syntaxOnly = false;

        mgServer.get('/' + mgVersion +
        '/address/parse?syntax_only=' + syntaxOnly.toString() + '&addresses=' + encodeURIComponent(emailToCheck))
        .reply(200, {message: 'OK'});

        return mg.parseEmail(emailToCheck, syntaxOnly).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
      it('should set syntaxOnly to true when undefined', function() {
        var emailToCheck = 'amivalid@maybe.com';

        mgServer.get('/' + mgVersion +
        '/address/parse?syntax_only=true&addresses=' + encodeURIComponent(emailToCheck))
        .reply(200, {message: 'OK'});

        return mg.parseEmail(emailToCheck).then(function(res) {
          res.message.should.equal('OK');
        }, function() {
          throw new Error('This promise should have been resolved');
        });
      });
    });
  });
});
