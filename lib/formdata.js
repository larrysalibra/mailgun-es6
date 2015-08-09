'use strict'; //Needed for ES6 Classes.

var https = require('https');
var stream = require('stream');

class FormData {
  constructor(options) {
    //Generate a Boundry to use for this instance
    //The boundary just needs to be random enough to not be included in any of
    //the sent data text.  This generates multiple -'s followed by 24 random
    //HexDec Chars.  Should be good for almost any situation...
    //unless you're really trying to screw things up.
    //https://github.com/coolaj86/http-examples/tree/master/multipart-form
    var baseBoundary = '--------------------------';
    for (var i = 0; i < 24; i++) {
      baseBoundary += Math.floor(Math.random() * 16).toString(16);
    }
    this._boundary = baseBoundary;

    //Set the variable that we will save the stream to. The way that they name
    //the streams was a little confusing for me.  This is how you should see it.
    //StreamReadable allows you to read FROM it.
    //StreamWriteable allows you to write TO it.
    //Lots of good information here: https://github.com/substack/stream-handbook
    this.dataStream = new stream.Readable();
  }

  get contentType() {
    return 'multipart/form-data; boundary=' + this._boundary;
  }

  get _lineBreak() {
    return '\r\n';
  }

  addData(name, value, type) {
    //This function adds data to the dataStream.
    //TODO: Add support for files with type.  (e.g., type = file, read and send w/MIME)
    if ((typeof name == 'undefined') || (typeof value == 'undefined')) {
      throw new Error('You must provide a name and value to add.');
    }

    this.dataStream.push('--' + this._boundary + this._lineBreak);
    this.dataStream.push(`Content-Disposition: form-data; name="${name}"`);
    this.dataStream.push(this._lineBreak + this._lineBreak);
    this.dataStream.push(value + this._lineBreak);
  }

  submitTo(req) {
    //This will stream a Readable stream to a writeable stream.
    //Curious to see what it looks like? process.stdout is a writable stream.

    //First we need to close up the form data.
    this.dataStream.push('--' + this._boundary + '--' + this._lineBreak);
    //Pushing null tells the stream that that's the end.
    this.dataStream.push(null);
    this.dataStream.pipe(req);
  }
}

module.exports = FormData;
