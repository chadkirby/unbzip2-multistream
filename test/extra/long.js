var unbzip2Stream = require('../..');
var test = require('tape');
var fs = require('fs');
var streamEqual = require('stream-equal');
var { Readable } = require('stream');

test('a very large binary file piped into unbzip2-stream results in original file content', async function(t) {
    t.plan(1);
    var source = fs.createReadStream('test/fixtures/vmlinux.bin.bz2');
    var expected = fs.createReadStream('test/fixtures/vmlinux.bin');
    var unbz2 = Readable.from(unbzip2Stream(source));
    streamEqual(expected, unbz2, function(err, equal) {
        if (err)
            t.ok(false, err);
        t.ok(equal, "same file contents");
    });
});
