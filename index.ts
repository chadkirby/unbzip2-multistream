import bz2 = require('./lib/bzip2');
import bitIterator = require('./lib/bit_iterator');

interface ReadableStream {
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
}

// Concatenate multiple Uint8Arrays into one
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

async function* unbzip2Stream(readable: ReadableStream): AsyncIterable<Uint8Array> {

    // Read all data from the readable stream first
    const buffers: Uint8Array[] = [];
    for await (const chunk of readable) {
        buffers.push(chunk);
    }
    if (buffers.length === 0) {
        return; // No data
    }

    const totalBuffer = concatUint8Arrays(buffers);
    let dataConsumed = 0;
    const getNextBuffer = function() {
        if (dataConsumed >= totalBuffer.length) {
            return new Uint8Array(0);
        }
        // Return the remaining data
        const remaining = totalBuffer.subarray(dataConsumed);
        dataConsumed = totalBuffer.length;
        return remaining;
    };

    const bitReader = bitIterator(getNextBuffer);
    let blockSize = 0;
    let streamCRC: number | null = null;
    let currentStreamBuffer: number[] = [];

    while (true) {
        if (!blockSize) {
            try {
                blockSize = bz2.header(bitReader);
                streamCRC = 0;
            } catch (e: any) {
                // If header fails and we have data, it might be end of input
                if (currentStreamBuffer.length > 0) {
                    yield new Uint8Array(currentStreamBuffer);
                }
                return;
            }
        } else {
            const bufsize = 100000 * blockSize;
            const buf = new Int32Array(bufsize);

            const f = function(b: number): void {
                currentStreamBuffer.push(b);
            };

            streamCRC = bz2.decompress(bitReader, f, buf, bufsize, streamCRC);
            if (streamCRC === null) {
                // End of current stream, yield it
                yield new Uint8Array(currentStreamBuffer);
                currentStreamBuffer = [];
                blockSize = 0; // Reset for next stream
            }
        }
    }
}

export = unbzip2Stream;
