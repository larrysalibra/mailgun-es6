/*jslint
mocha: true
*/
//Tells jshint not to bug me about describe, context, it, etc.

var mgPrivate = 'KEY-PRIVATEAPI';
var mgPublic = 'KEY-PUBLICAPI';
var mgDomain = 'testDomain.com';

var should = require('chai').should();
var expect = require('chai').expect;
var MailGun = require('../index.js');

describe('Mailgun', function() {
  describe('Internal Functions', function() {
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
      it('should reject the promise if neither are present', function() {
        var mailGun = new MailGun({
          privateApi: mgPrivate
        });
        var promise = new Promise(function(resolve, reject) {
          mailGun._determineDomain(undefined, reject);
        });
        return promise.then(function(res) {
          throw new Error('This should have rejected the promise.');
        }, function(res) {
          res.should.match(/specify a domain/);
        });
      });
    });
  });
});
