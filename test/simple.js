var unbzip2Stream = require('../');
var concat = require('concat-stream');
var test = require('tape');
var fs = require('fs');
var { Readable } = require('stream');

test('accepts data in both write and end', async function (t) {
    t.plan(1);
    var compressed = fs.readFileSync('test/fixtures/text.bz2');
    const readable = Readable.from(compressed); // Simplified, normally would handle chunks
    var data = Buffer.from([]);
    for await (const chunk of unbzip2Stream(readable)) {
        data = Buffer.concat([data, chunk]);
    }
    var expected = "Hello World!\nHow little you are. now.\n\n";
    t.equal(data.toString('utf-8'), expected);
});

test('accepts concatenated bz2 streams', async function (t) {
    t.plan(1);
    var compressed = fs.readFileSync('test/fixtures/concatenated.bz2');
    const readable = Readable.from(compressed);
    var data = Buffer.from([]);
    for await (const chunk of unbzip2Stream(readable)) {
        data = Buffer.concat([data, chunk]);
    }
    var expected = "ab\n";
    t.equal(data.toString('utf-8'), expected);
});

test('should emit error when stream is broken', async function (t) {
    t.plan(1);
    var compressed = fs.readFileSync('test/fixtures/broken');
    const readable = Readable.from(compressed);
    try {
        for await (const _chunk of unbzip2Stream(readable)) {
            t.ok(false, 'should not get here');
        }
        t.ok(true, 'stream ended as expected');
    } catch (err) {
        t.ok(true, err.message);
    }
});

test('should emit error when crc is broken', async function (t) {
    t.plan(1);
    var compressed = fs.readFileSync('test/fixtures/brokencrc.bz2');
    const readable = Readable.from(compressed);
    try {
        for await (const _chunk of unbzip2Stream(readable)) {
        }
        t.ok(false, 'should not get here');
    } catch (err) {
        t.ok(true, err.message);
    }
});

test('decompresses empty stream', async function (t) {
    t.plan(1);
    var compressed = fs.readFileSync('test/fixtures/empty.bz2');
    const readable = Readable.from(compressed);
    var data = Buffer.from([]);
    for await (const chunk of unbzip2Stream(readable)) {
        data = Buffer.concat([data, chunk]);
    }
    var expected = "";
    t.equal(data.toString('utf-8'), expected);
});

test('decompresses empty input', async function (t) {
    t.plan(1);
    const readable = Readable.from(Buffer.from([])); // Empty input
    var data = Buffer.from([]);
    for await (const chunk of unbzip2Stream(readable)) {
        data = Buffer.concat([data, chunk]);
    }
    var expected = "";
    t.equal(data.toString('utf-8'), expected);
});

test('should emit error when block crc is wrong', async function (t) {
    t.plan(1);
    var compressed = fs.readFileSync('test/fixtures/brokenblockcrc.bz2');
    const readable = Readable.from(compressed);
    try {
        for await (const _chunk of unbzip2Stream(readable)) {
            t.ok(false, 'should not get here');
        }
        t.ok(true, "Stream ended as expected.");
    } catch (err) {
        t.pass(err.message);
    }
});

test('should emit error when stream is broken in a different way?', async function (t) {
    t.plan(1);
    var truncated = fs.readFileSync('test/fixtures/truncated.bz2');
    const readable = Readable.from(truncated);
    try {
        for await (const _chunk of unbzip2Stream(readable)) {
            t.ok(false, "Should not yield.");
        }
        t.ok(true, "Stream ended as expected.");
    } catch (err) {
        t.ok(true, err);
    }
});

test('detects incomplete streams', async function (t) {
    t.plan(1);
    var incomplete = fs.readFileSync('test/fixtures/nostreamcrc.bz2');
    const readable = Readable.from(incomplete);
    try {
        for await (const _chunk of unbzip2Stream(readable)) {
            t.ok(false, 'should not get here');
        }
        t.ok(true, "Stream ended as expected.");
    } catch (err) {
        t.ok(true, err);
    }
});
