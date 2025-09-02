import bz2 = require('./lib/bzip2');
import bitIterator = require('./lib/bit_iterator');

interface ReadableStream {
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
}



async function* unbzip2Stream(readable: ReadableStream): AsyncIterable<Uint8Array> {
    // Accumulate enough data to process efficiently
    const MIN_BUFFER_SIZE = 64 * 1024; // 64KB minimum before starting
    let dataBuffer: Uint8Array[] = [];
    let currentOffset = 0;
    let isReadingDone = false;
    let iterator: AsyncIterator<Uint8Array> | null = null;

    // Async function to accumulate data
    const accumulateData = async (targetSize: number): Promise<void> => {
        while (getTotalBufferedSize() < targetSize && !isReadingDone) {
            if (!iterator) {
                iterator = readable[Symbol.asyncIterator]();
            }
            const result = await iterator.next();
            if (result.done) {
                isReadingDone = true;
                break;
            }
            dataBuffer.push(result.value);
        }
    };

    // Get total buffered data size
    const getTotalBufferedSize = (): number => {
        return dataBuffer.reduce((total, chunk) => total + chunk.length, 0);
    };

    // Get current chunk and advance offset
    const getCurrentChunk = (): Uint8Array => {
        if (currentOffset >= dataBuffer[0]?.length) {
            if (dataBuffer.length > 1) {
                dataBuffer.shift();
                currentOffset = 0;
            } else {
                return new Uint8Array(0);
            }
        }
        const chunk = dataBuffer[0].subarray(currentOffset);
        currentOffset = dataBuffer[0].length; // Consume entire chunk
        return chunk;
    };

    // Synchronous buffer provider for bit iterator
    const getNextBuffer = (): Uint8Array => {
        // If we have buffered data, return it
        if (dataBuffer.length > 0) {
            return getCurrentChunk();
        }
        // No buffered data - this indicates we need more
        if (isReadingDone) {
            return new Uint8Array(0); // End of stream
        }
        // Need more data but we're synchronous - return empty array for now
        return new Uint8Array(0);
    };

    const bitReader = bitIterator(getNextBuffer);
    let blockSize = 0;
    let streamCRC: number | null = null;
    let currentStreamBuffer: number[] = [];

    while (true) {
        // Ensure we have enough buffered data before attempting to read header/stream
        if (!isReadingDone && getTotalBufferedSize() < MIN_BUFFER_SIZE) {
            await accumulateData(MIN_BUFFER_SIZE);
        }

        if (!blockSize) {
            try {
                blockSize = bz2.header(bitReader);
                streamCRC = 0;
            } catch (e: any) {
                // If header fails, check if we have buffered data to process
                if (currentStreamBuffer.length > 0) {
                    yield new Uint8Array(currentStreamBuffer);
                }
                // If no more data coming and nothing buffered, we're done
                if (isReadingDone && dataBuffer.length === 0) {
                    return;
                }
                // Try accumulating more data
                if (!isReadingDone) {
                    await accumulateData(MIN_BUFFER_SIZE * 2);
                    continue;
                }
                return;
            }
        } else {
            const bufsize = 100000 * blockSize;
            const buf = new Int32Array(bufsize);

            const f = function(b: number): void {
                currentStreamBuffer.push(b);
            };

            let lastStreamCRC = streamCRC;
            streamCRC = bz2.decompress(bitReader, f, buf, bufsize, streamCRC);

            // If streamCRC is null, we've finished a complete stream
            if (streamCRC === null) {
                // End of current stream, yield it
                yield new Uint8Array(currentStreamBuffer);
                currentStreamBuffer = [];
                blockSize = 0; // Reset for next stream

                // Yield to allow consumer to process this stream
                await new Promise(resolve => setImmediate(resolve));
            } else if (lastStreamCRC === streamCRC) {
                // Progress stalled - we may need more data
                if (!isReadingDone) {
                    await accumulateData(MIN_BUFFER_SIZE);
                }
            }
        }

        // Break if no more data and nothing left to process
        if (isReadingDone && dataBuffer.length === 0 && currentStreamBuffer.length === 0) {
            break;
        }
    }

    // Clean up iterator if we created one
    if (iterator) {
        await (iterator as AsyncIterator<Uint8Array>).return?.();
    }
}

export = unbzip2Stream;
