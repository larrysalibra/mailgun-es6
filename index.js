'use strict'; //Needed for ES6 Classes.
var https = require('https');
var queryString = require('querystring');
var FormData = require('./lib/formdata.js');

class MailGun {
  constructor(options) {
    if ((typeof options == 'undefined') ||
    (typeof options.privateApi == 'undefined' &&
     typeof options.publicApi == 'undefined')) {
      throw new Error('Some options are required in order to use this program.' +
      'Please see the documentation for more information.');
    }
      //Assign the Public and Private API and domain to the object
      //Users are expected to know what key they need for what functions.
      this.privateApi = options.privateApi || null;
      this.publicApi = options.publicApi || null;
      this.domainName = options.domainName || null;
  }

  _genHttpsOptions(resource, method, publicApi) {
    return {
      hostname: 'api.mailgun.net',
      port: 443,
      path: `/v3${resource}`,
      method: `${method}`,
      auth: publicApi === true ? `api:${this.publicApi}` : `api:${this.privateApi}`
    };
  }

  _handleHttpsResponse(res, resolve, reject) {
    //Handles the response by resolving a promise
    var data = "";
    res.setEncoding('utf8');
    res.on('data', function(newData) {
      data = data + newData;
    });
    res.on('end', function() {
      data = JSON.parse(data);
      if (res.statusCode == 200) {
        //If the status is 200, everything went well.
        resolve(data);
      } else {
        //If not, something was wrong.
        reject(data);
      }
    });
  }

  _determineDomain(domain, reject) {
    if (typeof domain != 'undefined') {
      return domain;
    } else if ((this.domainName !== null) && (typeof this.domainName != 'undefined')){
      //Why do I use null? Because on the constructor function, something
      //will get assigned to this.DomainName.  Therefore, undefined
      //won't catch it as it has a null value.
      return this.domainName;
    } else {
      reject('You need to either specify a domain in the inital ' +
      'config or when calling sendEmail.');
    }
  }

  sendEmail(mgOptions, domain) {
    //TODO: Allow HTML Bodies.
    //Should be passed as 'html' as opposed to 'text'
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);

      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/${domain}/messages`, 'POST');
      try {
        form.addData('to', mgOptions.to);
        delete mgOptions.to;
        form.addData('from', mgOptions.from);
        delete mgOptions.from;
        form.addData('subject', mgOptions.subject);
        delete mgOptions.subject;
        form.addData('text', mgOptions.text);
        delete mgOptions.text;

        if (Object.keys(mgOptions).length !== 0) {
          Object.keys(mgOptions).forEach(function(k) {
            form.addData(k, mgOptions[k].toString());
          });
        }
      } catch (e) {
        reject('There was an error building POST body' + e);
      }

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`sendEmail() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  } //End of sendEmail()

  getStoredMessages(msgId, domain) {
    if (typeof msgId == 'undefined') {
      return this.getEvents({event: 'stored'});
    }
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);

      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/messages/${msgId}`, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getStoredMessage() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  deleteStoredMessages(msgId, domain) {
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/messages/${msgId}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteStoredMessage() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getInformation(domain) {
    return new Promise(function(resolve, reject) {
      if (typeof domain != 'undefined') {
        domain = '/' + domain;
      } else {
        domain = '';
      }

      var httpsOptions = this._genHttpsOptions(`/domains${domain}`, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getInformation() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  addNewDomain(newDomain, smtpPassword, opts) {
    return new Promise(function(resolve, reject) {
      if (typeof newDomain == 'undefined') {
        return reject('You must specify a domain to add');
      }
      if (typeof smtpPassword == 'undefined') {
        return reject('You must specify a smtp password for the account');
      }
      if (typeof opts == 'undefined') {
        opts = {};
      }
      opts.spamAction = typeof opts.spamAction == 'undefined' ? 'disable' : opts.spamAction;
      opts.wildCard = typeof opts.wildCard == 'undefined' ? false : opts.wildCard;

      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/domains`, 'POST');
      form.addData('name', newDomain);
      form.addData('smtp_password', smtpPassword);
      form.addData('spam_action', opts.spamAction);
      form.addData('wildcard', opts.wildCard.toString());

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`createNewDomain() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  deleteDomain(domainToDelete) {
    return new Promise(function(resolve, reject) {
      if (typeof domainToDelete == 'undefined') {
        return reject('A domain needs to be passed to this function');
      }
      var httpsOptions = this._genHttpsOptions(`/domains/${domainToDelete}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteDomain() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getSmtpUsers(domain) {
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);

      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/credentials`, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getSmtpUsers() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  addSmtpUser(username, password, domain) {
    return new Promise(function(resolve, reject) {

      if ((typeof username == 'undefined') || (typeof password == 'undefined')) {
        return reject('Both the username and password must be set.');
      }
      //Check to make sure length is correct.
      if ((password.length < 5) || (password.length > 32)) {
        return reject('Password needs to be between 5 and 32 characters long.');
      }
      domain = this._determineDomain(domain, reject);
      //Start new Form
      var form = new FormData();


      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/credentials`, 'POST');
      form.addData('login', username);
      form.addData('password', password);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`addSmtpUser() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  updateSmtpUser(username, password, domain) {
    return new Promise(function(resolve, reject) {
      if ((typeof username == 'undefined') || (typeof password == 'undefined')) {
        return reject('Both the username and password must be set.');
      }

      //Check to make sure length is correct.
      if ((password.length < 5) || (password.length > 32)) {
        return reject("Password needs to be between 5 and 32 characters long.");
      }

      domain = this._determineDomain(domain, reject);

      //Start new Form
      var form = new FormData();


      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/credentials/${username}`, 'PUT');
      form.addData('password', password);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateSmtpUser() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  deleteSmtpUser(username, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof username == 'undefined') {
        return reject('A username is required for this function');
      }

      domain = this._determineDomain(domain, reject);

      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/credentials/${username}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteSmtpUser() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getConnectionSettings(domain) {
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);

      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/connection`, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getDomainConnectionSettings() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  updateConnectionSettings(requireTLS, skipVerification, domain) {
    if (typeof requireTLS == 'undefined') {
      requireTLS = false;
    }
    if (typeof skipVerification == 'undefined') {
      skipVerification = false;
    }
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);
      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/connection`, 'PUT');
      form.addData('require_tls', requireTLS.toString()); //I added toString to these so that
      form.addData('skip_verification', skipVerification.toString()); //true => "true"

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateConnectionSettings() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  getStats(options, domain) {
    //For options, see https://documentation.mailgun.com/api-stats.html#stats
    return new Promise(function(resolve, reject) {
      domain = this._determineDomain(domain, reject);
      //First build path.
      var basePath = `/${domain}/stats`;
      var path = '';
      if (typeof options == 'object') {
        path = basePath + '?' + queryString.stringify(options);
      } else if (typeof options == 'string') {
        path = basePath + '?' + options;
      } else if (typeof options != 'undefined') {
        return reject("Options parameter not correct. Must be object or string");
      } else {
        path = basePath;
      }

      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getStats() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  deleteStats(tagName, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof tagName == 'undefined') {
        return reject('A tagName needs to be supplied');
      }
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/tags/${tagName}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteStats() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getEvents(search, skipPolling, update, domain) {
    var filterData = function(k, v) {
      switch (k) {
        case 'begin':
          if (typeof v == 'number') {
            return v * 1000;
          } else {
            return (new Date(v).getTime() / 1000);
          }
          break;
        case 'begin':
          if (typeof v == 'number') {
            return v * 1000;
          } else {
            return (new Date(v).getTime() / 1000);
          }
          break;
        default:
          return v;
      }
    };

    return new Promise(function(resolve, reject) {
      //TODO: Add Event polling support
      var addedPath;
      //TODO: If there is a better way to do this, please fix.
      //The arguments var contains the functions for the promise...
      if ((typeof search == 'string') && (/=/.test(search))) {
        //We were passed a query string. I test for the = sign as the only
        //other string passed would be the domain, which wouldn't have the
        //= sign.
        addedPath = '?' + search;
      } else if (typeof search == 'object') {
        for (var k in search) {
          search[k] = filterData(k, search[k]);
        }
        addedPath = '?' + queryString.stringify(search);
      } else {
        addedPath = '';
        domain = update;
        update = skipPolling;
        skipPolling = search;
      }

      if (typeof skipPolling != 'boolean') {
        domain = update;
        update = skipPolling;
        skipPolling = false;
      }

      if (typeof update != 'function') {
        domain = update;
        update = undefined;
      }

      if ((typeof domain == 'undefined') || (/^[a-zA-Z0-9\-]+\.\w+/.test(domain))) {
        domain = this._determineDomain(domain, reject);
      } else {
        return reject('Your variables are not correct. Read the Docs for more info');
      }

      var basePath = `/${domain}/events`;
      var httpsOptions = this._genHttpsOptions(basePath + addedPath, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function(newData) {
          data = data + newData;
        });
        res.on('end', function() {
          data = JSON.parse(data, null, 2);
          if (res.statusCode == 200) {
            //If the status is 200, everything went well.
            resolve(data);
          } else {
            //If not, something was wrong.
            reject(data);
          }
        });
      });

      req.end();

      req.on('error', function(e) {
        reject(`getEvents() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getBounces(limit, address, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof limit == 'undefined') {
        //Nothing passed, set default
        limit = 100;
        address = undefined;
      } else {
        //Do the assignment checks
        //if limit isn't a number, we need to figure out what it is
        if (typeof limit != 'number') {
          if (/.+\@.+\..+/.test(limit) === true) {
            domain = address;
            address = limit;
          } else {
            domain = limit;
            address = undefined;
          }
          //100 Limit is the Mailgun default
          limit = 100;
        }

        if ((typeof address != 'undefined') && (/.+\@.+\..+/.test(address) === false)) {
          domain = address;
          address = undefined;
        }
      }

      domain = this._determineDomain(domain, reject);

      var path = `/${domain}/bounces`;
      path += (typeof address != 'undefined') ? '/' + address : '';
      path += (typeof limit != 'undefined') ? '?limit=' + limit : '';

      console.log(path);
      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getBounces() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  addBounces(addresses, domain) {
    //https://documentation.mailgun.com/api-suppressions.html#add-a-single-bounce
    //This requires at least an address for each record.  You can either pass
    //a single object or an array of objects.  The objects should include:
    //address, code, error, and created_at
    return new Promise(function(resolve, reject) {
      //WOOHOO! Normal JSON via POST!
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/bounces`, 'POST');

      //So if an array isn't sent, this actually replies with Invalid JSON
      //Which is a misnomer.  It should say 'Misformatted. Expected Array.' Whatever
      addresses = JSON.stringify((typeof addresses == 'object' ? [addresses] : addresses));

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', 'application/json');
      //Why? See: http://stackoverflow.com/questions/4505809/how-to-post-to-a-request-using-node-js
      req.setHeader('Content-Length', Buffer.byteLength(addresses));
      //Send JSON Body. This is like a backwards stream.
      //req is a writable stream so we're writing addresses to req.
      req.write(addresses, 'utf8');
      req.end();

      req.on('error', function(e) {
        reject(`addBounces() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  deleteBounces(address, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof address == 'undefined') {
        return reject('An address needs to be supplied');
      }
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/bounces/${address}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteBounces() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getUnsubscribes(limit, address, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof limit == 'undefined') {
        //Nothing passed, set default
        limit = 100;
        address = undefined;
      } else {
        //Do the assignment checks
        //if limit isn't a number, we need to figure out what it is
        if (typeof limit != 'number') {
          if (/.+\@.+\..+/.test(limit) === true) {
            domain = address;
            address = limit;
          } else {
            domain = limit;
            address = undefined;
          }
          //100 Limit is the Mailgun default
          limit = 100;
        }

        if ((typeof address != 'undefined') && (/.+\@.+\..+/.test(address) === false)) {
          domain = address;
          address = undefined;
        }
      }

      domain = this._determineDomain(domain, reject);

      var path = `/${domain}/unsubscribes`;
      path += (typeof address != 'undefined') ? '/' + address : '';
      path += (typeof limit != 'undefined') ? '?limit=' + limit : '';

      console.log(path);
      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getUnsubscribes() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  addUnsubscribes(addresses, domain) {
    //https://documentation.mailgun.com/api-suppressions.html#add-a-single-unsubscribe
    //This requires at least an address for each record.  You can either pass
    //a single object or an array of objects.  The objects should include:
    //address, code, error, and created_at
    return new Promise(function(resolve, reject) {
      //WOOHOO! Normal JSON via POST!
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/unsubscribes`, 'POST');

      //So if an array isn't sent, this actually replies with Invalid JSON
      //Which is a misnomer.  It should say 'Misformatted. Expected Array.' Whatever
      addresses = JSON.stringify((typeof addresses == 'object' ? [addresses] : addresses));

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', 'application/json');
      //Why? See: http://stackoverflow.com/questions/4505809/how-to-post-to-a-request-using-node-js
      req.setHeader('Content-Length', Buffer.byteLength(addresses));
      //Send JSON Body. This is like a backwards stream.
      //req is a writable stream so we're writing addresses to req.
      req.write(addresses, 'utf8');
      req.end();

      req.on('error', function(e) {
        reject(`addUnsubscribes() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  deleteUnsubscribes(address, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof address == 'undefined') {
        return reject('An address needs to be supplied');
      }
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/unsubscribes/${address}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteUnsubscribes() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getComplaints(limit, address, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof limit == 'undefined') {
        //Nothing passed, set default
        limit = 100;
        address = undefined;
      } else {
        //Do the assignment checks
        //if limit isn't a number, we need to figure out what it is
        if (typeof limit != 'number') {
          if (/.+\@.+\..+/.test(limit) === true) {
            domain = address;
            address = limit;
          } else {
            domain = limit;
            address = undefined;
          }
          //100 Limit is the Mailgun default
          limit = 100;
        }

        if ((typeof address != 'undefined') && (/.+\@.+\..+/.test(address) === false)) {
          domain = address;
          address = undefined;
        }
      }

      domain = this._determineDomain(domain, reject);

      var path = `/${domain}/complaints`;
      path += (typeof address != 'undefined') ? '/' + address : '';
      path += (typeof limit != 'undefined') ? '?limit=' + limit : '';

      console.log(path);
      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getComplaints() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  addComplaints(addresses, domain) {
    //https://documentation.mailgun.com/api-suppressions.html#add-a-single-unsubscribe
    //This requires at least an address for each record.  You can either pass
    //a single object or an array of objects.  The objects should include:
    //address, code, error, and created_at
    return new Promise(function(resolve, reject) {
      //WOOHOO! Normal JSON via POST!
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/complaints`, 'POST');

      //So if an array isn't sent, this actually replies with Invalid JSON
      //Which is a misnomer.  It should say 'Misformatted. Expected Array.' Whatever
      addresses = JSON.stringify((typeof addresses == 'object' ? [addresses] : addresses));

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', 'application/json');
      //Why? See: http://stackoverflow.com/questions/4505809/how-to-post-to-a-request-using-node-js
      req.setHeader('Content-Length', Buffer.byteLength(addresses));
      //Send JSON Body. This is like a backwards stream.
      //req is a writable stream so we're writing addresses to req.
      req.write(addresses, 'utf8');
      req.end();

      req.on('error', function(e) {
        reject(`addComplaints() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  deleteComplaints(address, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof address == 'undefined') {
        return reject('An address needs to be supplied');
      }
      domain = this._determineDomain(domain, reject);
      var httpsOptions = this._genHttpsOptions(`/${domain}/conplaints/${address}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteComplaints() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getRoutes(limit, skip) {
    return new Promise(function(resolve, reject) {
      var path = "/routes";

      if (typeof limit == 'string' && limit.length > 3) {
        //Crude check to see if the user is trying to search by an ID
        //and not passing a limit
        path += `/${limit}`;
      } else {
        //Set defaults
        limit = limit || 100;
        skip = skip || 0;

        path += (typeof limit != 'undefined') ? '?limit=' + limit : '';
        path += (typeof skip != 'undefined') ? '&skip=' + skip : '';
      }

      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getRoutes() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  addRoutes(route) {
    //Information about all options with routes here:
    //https://documentation.mailgun.com/user_manual.html#routes
    //Also the function name is a misnomer.  Even though I used the plural,
    //it was strictly for consistency of terms.  Only single routes are
    //able to be added at the time.
    //TODO: Add array support for route.action in order to allow multiple actions for each route
    return new Promise(function(resolve, reject) {
      if (typeof route !== 'object') {
        return reject('An object must be passed to this function. Please read the docs.');
      }

      if ((typeof route.priority == 'undefined') || (typeof route.filter == 'undefined') ||
       (typeof route.actions == 'undefined')) {
        return reject('priority, filter, and action must all be set. See docs for more information.');
      }

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/routes`, 'POST');
      //Start new Form
      var form = new FormData();
      form.addData('priority', route.priority);
      form.addData('description', route.description || '');
      form.addData('expression', route.filter);
      form.addData('action', route.actions);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`addRoutes() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  updateRoutes(id, route) {
    //TODO: Add array support for route.action in order to allow multiple actions for each route
    return new Promise(function(resolve, reject) {
      if (typeof id !== 'undefined') {
        return reject('An ID must be supplied. If trying to create a route, use addRoute()');
      }

      if (typeof route == 'undefined') {
        return reject('Some information about the route must be specified to update');
      }

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/routes/${id}`, 'PUT');
      //Start new Form
      var form = new FormData();
      if (route.priority) { form.addData('priority', route.priority); }
      if (route.description) { form.addData('description', route.description);}
      if (route.filter) { form.addData('expression', route.filter); }
      if (route.actions) { form.addData('action', route.actions); }

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateRoutes() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  deleteRoutes(id) {
    return new Promise(function(resolve, reject) {
      if (typeof id !== 'undefined') {
        return reject('An ID must be supplied. Read the Docs for more info.');
      }

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/routes/${id}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteRoutes() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  getCampaigns(limit, skip, domain) {
    //domain or ID of campaign
    return new Promise(function(resolve, reject) {
      var path = '';
      //Check to see if the domain was passes as limit or skip.
      if (/\W/.test(limit) === true) {
        domain = limit;
        limit = undefined;
      } else if (/\W/.test(skip) === true) {
        domain = skip;
        skip = undefined;
      }

      //Set domainName first
      domain = this._determineDomain(domain, reject);

      //Then figure out if we have an id or an actual limit.
      if (typeof limit == 'string') {
        //Crude check to see if the user is trying to search by an ID
        //and not passing a limit
        path = `/${domain}/campaigns/${limit}`;
      } else {
        //Set defaults
        limit = limit || 100;
        skip = skip || 0;
        path = `/${domain}/campaigns`;
        path += '?limit=' + limit;
        path += '&skip=' + skip;
      }

      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getCampaigns() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  addCampaigns(id, name, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof name == 'undefined') {
        return reject('You must specify a name to add');
      }
      if (typeof id == 'undefined') {
        return reject('You must specify an id for the campaign');
      }

      domain = this._determineDomain(domain, reject);

      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/${domain}/campaigns`, 'POST');
      form.addData('name', name);
      form.addData('id', id);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`addCampaigns() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  updateCampaigns(id, name, domain) {
    //TODO: Find some intuitive way to specifiy a new ID along with new name
    return new Promise(function(resolve, reject) {
      if (typeof id == 'undefined') {
        return reject('You must specify an id to change.');
      }

      domain = this._determineDomain(domain, reject);

      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/${domain}/campaigns/${id}`, 'PUT');
      if (typeof name != 'undefined') {
        form.addData('name', name);
      }
      form.addData('id', id);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateCampaigns() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  deleteCampaigns(idToDelete, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof idToDelete == 'undefined') {
        return reject('A campaign needs to be passed to this function');
      }
      domain = this._determineDomain(domain, reject);

      var httpsOptions = this._genHttpsOptions(`/${domain}/campaigns/${idToDelete}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteCampaigns() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getCampaignsEvents(campId, eventType, options, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof campId == 'undefined') {
        return reject('A campaign ID id required.');
      }

      if (typeof eventType == 'undefined') {
        eventType = 'events';
        options = {};
      } else if (/\W/.test(eventType) === true) {
        domain = eventType;
        eventType = 'events';
        options = {};
      } else if (typeof eventType == 'object') {
        domain = options;
        options = eventType;
        eventType = 'events';
      }

      domain = this._determineDomain(domain, reject);

      //First build path.
      var basePath = `/${domain}/campaigns/${campId}/${eventType}`;
      var path = '';
      if (typeof options == 'object') {
        path = basePath + '?' + queryString.stringify(options);
      } else {
        path = basePath;
      }

      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getCampaignsEvents() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getWebhooks(id, domain) {
    //domain or ID of campaign
    return new Promise(function(resolve, reject) {
      var path = '';
      //Check to see if the domain was passes as limit or skip.
      if (/\W/.test(id) === true) {
        domain = id;
        id = undefined;
      }

      //Set domainName first
      domain = this._determineDomain(domain, reject);

      path = `/domains/${domain}/webhooks`;
      if (typeof id != 'undefined') {
        path += '/' + id;
      }

      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getWebhooks() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  addWebhooks(id, url, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof id == 'undefined') {
        return reject('You must specify an id for the webhook');
      }
      if (typeof url == 'undefined') {
        return reject('You must specify a url for the webhook');
      }

      domain = this._determineDomain(domain, reject);

      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/webhooks`, 'POST');
      form.addData('id', id);
      form.addData('url', url);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`addWebhooks() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  updateWebhooks(id, url, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof id !== 'undefined') {
        return reject('An ID must be supplied. If trying to create a webhook, use addWebhooks()');
      }

      if (typeof url == 'undefined') {
        return reject('If you don\'t pass a url, what are you going to update?');
      }

      domain = this._determineDomain(domain, reject);

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/webhooks/${id}`, 'PUT');
      //Start new Form
      var form = new FormData();
      form.addData('url', url);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateWebhooks() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  deleteWebhooks(idToDelete, domain) {
    return new Promise(function(resolve, reject) {
      if (typeof idToDelete == 'undefined') {
        return reject('A webhook needs to be passed to this function');
      }
      domain = this._determineDomain(domain, reject);

      var httpsOptions = this._genHttpsOptions(`/domains/${domain}/webhooks/${idToDelete}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteWebhooks() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getMailingLists(listName) {
    //TODO: Integrate limit and skip
    return new Promise(function(resolve, reject) {
      var path = `/lists`;
      if (typeof listName != 'undefined') {
        path += '/' + listName;
      }

      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getMailingLists() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  addMailingLists(address, name, description, accessLevel) {
    return new Promise(function(resolve, reject) {
      if (typeof address == 'undefined') {
        return reject('You must specify an address for the mailing list');
      }
      if (typeof name == 'undefined') {
        return reject('You must specify a name for the mailing list');
      }
      if (typeof description == 'undefined') {
        return reject('You must specify a description for the mailing list');
      }
      if (typeof accessLevel == 'undefined') {
        return reject('You must specify an access level for the mailing list');
      }

      //Start new Form
      var form = new FormData();

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/lists`, 'POST');
      form.addData('address', address);
      form.addData('name', name);
      form.addData('description', description);
      form.addData('access_level', accessLevel);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`addMailingLists() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  updateMailingLists(address, name, description, accessLevel) {
    return new Promise(function(resolve, reject) {
      if (typeof address !== 'undefined') {
        return reject('You must specify a mailing list to update.');
      }

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/lists/${address}`, 'PUT');
      //Start new Form
      var form = new FormData();
      if (name !== '' && typeof name != 'undefined') {
        form.addData('name', name);
      }
      if (description !== '' && typeof description != 'undefined') {
        form.addData('description', description);
      }
      if (accessLevel !== '' && typeof accessLevel != 'undefined') {
        form.addData('access_level', accessLevel);
      }

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateMailingLists() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  deleteMailingLists(idToDelete) {
    return new Promise(function(resolve, reject) {
      if (typeof idToDelete == 'undefined') {
        return reject('An email needs to be passed to this function');
      }

      var httpsOptions = this._genHttpsOptions(`/lists/${idToDelete}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteMailingLists() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getMailingListsMembers(listName, memberName) {
    //TODO: Integrate subscribed, limit and skip
    return new Promise(function(resolve, reject) {
      if (typeof listName == 'undefined') {
        return reject('You must pass a listname to this function.');
      }
      var path = `/lists/${listName}/members`;
      if (typeof memberName != 'undefined') {
        path += '/' + memberName;
      }
      var httpsOptions = this._genHttpsOptions(path, 'GET');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`getMailingListsMembers() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  addMailingListsMembers(listAddress, options) {
    return new Promise(function(resolve, reject) {
      if (typeof listAddress == 'undefined') {
        return reject('You must specify an listAddress for the mailing list');
      }

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/lists/${listAddress}/members`, 'POST');

      //Start new Form
      var form = new FormData();

      if (typeof options != 'undefined' && Object.keys(options).length !== 0) {
        Object.keys(options).forEach(function(k) {
          form.addData(k, options[k].toString());
        });
      }

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`addMailingListsMembers() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }

  updateMailingListsMembers(memberAddress, listAddress, options) {
    return new Promise(function(resolve, reject) {
      if (typeof memberAddress == 'undefined') {
        return reject('You must pass the address of the member you\re updating.');
      }
      if (typeof listAddress == 'undefined') {
        return reject('You must specify an address for the mailing list');
      }
      if (typeof options == 'undefined') {
        return reject('No updates we passed. Why are you using this function?');
      }

      //Generate new HTTPS options
      var httpsOptions = this._genHttpsOptions(`/lists/${listAddress}/members/${memberAddress}`, 'PUT');

      //Start new Form
      var form = new FormData();

      if (Object.keys(options).length !== 0) {
        Object.keys(options).forEach(function(k) {
          form.addData(k, options[k].toString());
        });
      }

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`updateMailingListsMembers() Connection Problem. ${e}`);
      });
    }.bind(this)); //End of promise. I've bound this so I can use _genHttpsOptions
  }
  //TODO: Support for POST /lists/<address>/members.json

  deleteMailingListsMembers(idToDelete, listAddress) {
    return new Promise(function(resolve, reject) {
      if (typeof idToDelete == 'undefined') {
        return reject('An email needs to be passed to this function');
      }
      if (typeof listAddress == 'undefined') {
        return reject('Another email needs to be passed to this function');
      }

      var httpsOptions = this._genHttpsOptions(`/lists/${listAddress}/members/${idToDelete}`, 'DELETE');

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      req.end();

      req.on('error', function(e) {
        reject(`deleteMailingListsMembers() Connection Problem. ${e}`);
      });

    }.bind(this));
  }

  getIsValidEmail(emailToCheck) {
    //domain or ID of campaign
    return new Promise(function(resolve, reject) {
      //Check to see if the domain was passes as limit or skip.
      if (typeof emailToCheck == 'undefined') {
        return reject('You must specify an email to check.');
      }

      var httpsOptions = this._genHttpsOptions('/address/validate', 'GET', true);

      var form = new FormData();

      form.addData('address', emailToCheck);

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`getIsValidEmail() Connection Problem. ${e}`);
      });
    }.bind(this));
  }

  getEmailAddressParse(emailToParse, syntaxOnly) {
    //domain or ID of campaign
    return new Promise(function(resolve, reject) {
      //Check to see if the domain was passes as limit or skip.
      if (typeof emailToParse == 'undefined') {
        return reject('You must specify an email to check.');
      }

      syntaxOnly = syntaxOnly || 'true';

      var httpsOptions = this._genHttpsOptions('/address/parse', 'GET', true);

      var form = new FormData();

      form.addData('addresses', emailToParse);
      form.addData('syntax_only', syntaxOnly.toString());

      //Make the connection
      var req = https.request(httpsOptions, function(res) {
        this._handleHttpsResponse(res, resolve, reject);
      }.bind(this)); //End of request. I've bound this so I can use _handleHttpsResponse

      //Set content Header with dynamic boundary
      req.setHeader('Content-Type', form.contentType);

      //Send data to server.
      //No req.end() as then ed of the pipe will automatically close it
      form.submitTo(req);

      req.on('error', function(e) {
        reject(`getEmailAddressParse() Connection Problem. ${e}`);
      });
    }.bind(this));
  }
} //End of Class




module.exports = MailGun;
