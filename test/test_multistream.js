const path = require('path');
const unbzip2Stream = require('../index.js');
const fs = require('fs');

async function testMultistream() {
  console.log('Testing multistream...');
  const readable = fs.createReadStream(path.join(__dirname, './fixtures/concatenated.bz2'));
  let count = 0;
  for await (const streamBuffer of unbzip2Stream(readable)) {
    count++;
    console.log(`Stream ${count}: ${JSON.stringify(streamBuffer.toString('utf-8'))} (length: ${streamBuffer.length})`);
  }
  console.log(`Total streams: ${count}`);
}

testMultistream().catch(console.error);
