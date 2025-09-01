const BITMASK: number[] = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF];

// Define the bit reader function interface
interface BitReader {
    (n: number | null): number;
    bytesRead: number;
}

// returns a function that reads bits.
// takes a buffer iterator as input
export = function bitIterator(nextBuffer: () => Uint8Array): BitReader {
    let bit: number = 0;
    let byte: number = 0;
    let bytes: Uint8Array = nextBuffer();
    const f = function(n: number | null): number {
        if (n === null && bit != 0) {  // align to byte boundary
            bit = 0;
            byte++;
            return -1; // Dummy return for alignment case
        }
        let result = 0;
        while(n !== null && n > 0) {
            if (byte >= bytes.length) {
                byte = 0;
                bytes = nextBuffer();
            }
            const left = 8 - bit;
            if (bit === 0 && n > 0) {
                f.bytesRead++;
            }
            if (n >= left) {
                result <<= left;
                result |= (BITMASK[left] & bytes[byte++]);
                bit = 0;
                n -= left;
            } else {
                result <<= n;
                result |= ((bytes[byte] & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit));
                bit += n;
                n = 0;
            }
        }
        return result;
    };
    f.bytesRead = 0;
    return f;
};
