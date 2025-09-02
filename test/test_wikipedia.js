const unbzip2Stream = require('../');
const test = require('tape');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const path = require('node:path');

test('processes real Wikipedia dump without crashing', async function (t) {
  t.plan(5);

  const dumpPath = path.join(__dirname, './fixtures/enwiki-20250801-pages-articles-multistream22.xml-p44496246p44788941.bz2');

  // Check that the file exists and is the expected size
  const stat = fs.statSync(dumpPath);
  t.ok(stat.size > 60 * 1024 * 1024, 'Wikipedia dump file should be larger than 60MB');

  const readable = fs.createReadStream(dumpPath);
  const startTime = Date.now();

  let streamCount = 0;
  let totalBytes = 0;
  let processedData = false;

  try {
    for await (const streamBuffer of unbzip2Stream(readable)) {
      streamCount++;
      totalBytes += streamBuffer.length;

      const content = streamBuffer.toString('utf-8');
      if (content.length > 0) {
        processedData = true;
      }

      // Limit to first 3 streams to keep test fast
      if (streamCount >= 3) break;
    }

    const duration = Date.now() - startTime;
    const throughputKBperSec = Math.round(totalBytes / duration * 1000 / 1024);

    // Core success criteria
    t.equal(streamCount, 3, `Successfully processed ${streamCount} streams`);
    t.ok(processedData, 'Successfully decompressed real data');
    t.ok(throughputKBperSec > 100, `Good throughput: ${throughputKBperSec} KB/sec`);
    t.equal(readable.bytesRead, 458752, 'The entire file was not read');

  } catch (error) {
    t.fail(`Test failed with crash: ${error.message}`);
  }
});
