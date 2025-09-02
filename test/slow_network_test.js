const unbzip2Stream = require('../');
const test = require('tape');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

class SlowReadable extends Readable {
  constructor(data, chunkSize = 512, delayMs = 10) {
    super();
    this.data = data;
    this.chunkSize = chunkSize;
    this.delayMs = delayMs;
    this.offset = 0;
    this.drained = false;
  }

  _read() {
    if (this.drained) return;

    const chunk = this.data.slice(this.offset, this.offset + this.chunkSize);
    this.offset += chunk.length;

    if (chunk.length === 0) {
      this.drained = true;
      this.push(null);
    } else {
      // Simulate delay before pushing chunk
      setTimeout(() => {
        this.push(chunk);
      }, this.delayMs);
    }
  }
}

test('large file', async function (t) {
  t.plan(3);

  const fixturePath = path.join(__dirname, 'fixtures', 'enwiki-20250801-pages-articles-multistream22.xml-p44496246p44788941.bz2');

  if (!fs.existsSync(fixturePath)) {
    t.skip('Wikipedia fixture not available');
    return;
  }

  const startTime = Date.now();
  let streamCount = 0;
  let totalBytes = 0;

  try {
    // Use file stream with very small chunks and a small delay
    const readable = new SlowReadable(fs.readFileSync(fixturePath), 4096, 1); // 4KB chunks, 1ms delay

    for await (const streamBuffer of unbzip2Stream(readable)) {
      streamCount++;
      totalBytes += streamBuffer.length;

      const content = streamBuffer.toString('utf-8');
      if (content.length > 0) {
        // Successfully processed this stream
      }

      // Limit to first 2 streams to keep test reasonable
      if (streamCount >= 2) break;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const throughputKBperSec = Math.round(totalBytes / duration * 1000 / 1024);

    t.ok(streamCount > 0, `processed ${streamCount} streams`);
    t.ok(totalBytes > 0, `produced ${totalBytes} bytes`);
    t.ok(duration > 0, `took ${duration}ms`);

    console.log(`accumulation: ${streamCount} streams, ${totalBytes} bytes in ${duration}ms`);
    console.log(`Throughput: ${throughputKBperSec} KB/sec`);

  } catch (error) {
    t.fail(`Large file test without mid-decompression failed: ${error.message}`);
    console.log(error.stack);
  }

  t.end();
});
