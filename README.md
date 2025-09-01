unbzip2-multistream
===
streaming bzip2 decompressor in pure TypeScript for Node.js and browsers.

### Cross-platform compatibility
This package works identically across Node.js, browsers, Deno, and other JavaScript environments. It has **zero runtime dependencies** and uses standard Web APIs (ArrayBuffer, Uint8Array, async iteration) that are available everywhere.

### Usage
``` js
import unbzip2Stream = require('@ckirby/unbzip2-multistream');

// For Node.js streams
const fs = require('fs');
const { Readable } = require('node:stream');

// Example usage
(async () => {
    const inputStream = Readable.from(fs.createReadStream('./test.bz2'));
    for await (const chunk of unbzip2Stream(inputStream)) {
        process.stdout.write(chunk);
    }
})();
```

### Browser usage
``` js
// Simple helper to convert ReadableStream to async iterable
function readableStreamToAsyncIterable(stream) {
  return (async function* () {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value; // value is Uint8Array
      }
    } finally {
      reader.releaseLock();
    }
  })()
}

fetch('/file.bz2')
    .then(response => unbzip2Stream(readableStreamToAsyncIterable(response.body)))
    .then(async (stream) => {
        for await (const chunk of stream) {
            // process each decompressed chunk (Uint8Array)
        }
    });
```

### Tests
To run tests:

    npm test

To run long-running benchmarks:

    npm run prepare-long-test
    npm run long-test

### Features
- **Zero dependencies**: Pure TypeScript implementation with no external runtime dependencies
- **Cross-platform**: Works in Node.js, browsers, Deno, and other JS environments
- **Streaming**: Processes data incrementally, suitable for large files
- **Multi-stream support**: Handles concatenated bzip2 streams
- **TypeScript**: Full type definitions included

### API
The package exports a single async generator function that takes any object implementing `Symbol.asyncIterator` that yields `Uint8Array` chunks and returns an async iterable of decompressed `Uint8Array` chunks.
