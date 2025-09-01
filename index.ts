import through = require('through');
import bz2 = require('./lib/bzip2');
import bitIterator = require('./lib/bit_iterator');

type ThroughStream = through.ThroughStream;

function unbzip2Stream() {
    var bufferQueue: Buffer[] = [];
    var hasBytes: number = 0;
    var blockSize: number = 0;
    var broken: boolean = false;
    var done: boolean = false;
    var bitReader: any = null;
    var streamCRC: number | null = null;

    function decompressBlock(push: (data: Buffer | null) => void): boolean {
        if(!blockSize){
            blockSize = bz2.header(bitReader);
            //console.error("got header of", blockSize);
            streamCRC = 0;
            return true;
        }else{
            var bufsize: number = 100000 * blockSize;
            var buf: Int32Array = new Int32Array(bufsize);

            var chunk: number[] = [];
            var f = function(b: number): void {
                chunk.push(b);
            };

            streamCRC = bz2.decompress(bitReader, f, buf, bufsize, streamCRC);
            if (streamCRC === null) {
                // reset for next bzip2 header
                blockSize = 0;
                return false;
            }else{
                //console.error('decompressed', chunk.length,'bytes');
                push(Buffer.from(chunk));
                return true;
            }
        }
    }

    var outlength: number = 0;
    function decompressAndQueue(stream: ThroughStream): boolean {
        if (broken) return false;
        try {
            return decompressBlock(function(d: Buffer | null) {
                stream.queue(d);
                if (d !== null) {
                    //console.error('write at', outlength.toString(16));
                    outlength += d.length;
                } else {
                    //console.error('written EOS');
                }
            });
        } catch(e) {
            //console.error(e);
            stream.emit('error', e);
            broken = true;
            return false;
        }
    }

    return through(
        function write(this: ThroughStream, data: Buffer): void {
            //console.error('received', data.length,'bytes in', typeof data);
            bufferQueue.push(data);
            hasBytes += data.length;
            if (bitReader === null) {
                bitReader = bitIterator(function() {
                    return bufferQueue.shift() || Buffer.alloc(0);
                });
            }
            while (!broken && hasBytes - bitReader.bytesRead + 1 >= ((25000 + 100000 * blockSize) || 4)){
                //console.error('decompressing with', hasBytes - bitReader.bytesRead + 1, 'bytes in buffer');
                decompressAndQueue(this);
            }
        },
        function end(this: ThroughStream): void {
            //console.error('last compressing with', hasBytes, 'bytes in buffer');
            while (!broken && bitReader && hasBytes > bitReader.bytesRead){
                decompressAndQueue(this);
            }
            if (!broken) {
                if (streamCRC !== null)
                    this.emit('error', new Error("input stream ended prematurely"));
                this.queue(null);
            }
        }
    );
}

export = unbzip2Stream;
