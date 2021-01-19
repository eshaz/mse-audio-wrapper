const toBinary = (integer, withPaddingLength) =>
  integer.toString(2).padStart(withPaddingLength, "0");

const reverse = (val) =>
  ((val & 0b10000000) >> 7) +
  ((val & 0b01000000) >> 5) +
  ((val & 0b00100000) >> 3) +
  ((val & 0b00010000) >> 1) +
  ((val & 0b00001000) << 1) +
  ((val & 0b00000100) << 3) +
  ((val & 0b00000010) << 5) +
  ((val & 0b00000001) << 7);

// https://gitlab.xiph.org/xiph/liboggz/-/blob/master/src/liboggz/oggz_auto.c
/*
 * This is the format of the mode data at the end of the packet for all
 * Vorbis Version 1 :
 *
 * [ 6:number_of_modes ]
 * [ 1:size | 16:window_type(0) | 16:transform_type(0) | 8:mapping ]
 * [ 1:size | 16:window_type(0) | 16:transform_type(0) | 8:mapping ]
 * [ 1:size | 16:window_type(0) | 16:transform_type(0) | 8:mapping ]
 * [ 1:framing(1) ]
 *
 * e.g.:
 * 
 * MsB         LsB
 *              <-
 * 0 0 0 0 0 1 0 0
 * 0 0 1 0 0 0 0 0
 * 0 0 1 0 0 0 0 0
 * 0 0 1|0 0 0 0 0
 * 0 0 0 0|0|0 0 0
 * 0 0 0 0 0 0 0 0
 * 0 0 0 0|0 0 0 0
 * 0 0 0 0 0 0 0 0
 * 0 0 0 0|0 0 0 0
 * 0 0 0|1|0 0 0 0 |
 * 0 0 0 0 0 0 0 0 V
 * 0 0 0|0 0 0 0 0
 * 0 0 0 0 0 0 0 0
 * 0 0 1|0 0 0 0 0
 *
 *
 * i.e. each entry is an important bit, 32 bits of 0, 8 bits of blah, a
 * bit of 1.
 * Let's find our last 1 bit first.
 *
 */

const parseSetupHeader = (setup) => {
  let position = setup.length * 8;

  const getBits = (bits) => {
    const byte = Math.floor(position / 8);
    const bit = position % 8;

    const byteWindow =
      (reverse(setup[byte - 1]) << (bit + 7)) +
      (reverse(setup[byte]) << (bit - 1));

    const val = (byteWindow >> 7) & 0xff;

    //console.log(toBinary(val, 8), byte, bit);
    position -= bits;
    return val;
  };

  console.log(
    ...[...setup.subarray(-32)].map((byte) => toBinary(reverse(byte), 8))
  );

  let mode = {
    count: 0,
  };

  // sync with the framing bit
  while ((getBits(1) & 0x01) !== 1) {}

  let modeBits;
  // search in reverse to parse out the mode entries
  // limit mode count to 63 so previous block flag will be in first packet byte
  while (mode.count < 64 && position > 0) {
    const mapping = reverse(getBits(8));
    if (mapping in mode) {
      console.log(
        "received duplicate mode mapping, failed to parse vorbis modes"
      );
      break;
    }

    // 16 bits transform type, 16 bits window type, all values must be zero
    let i = 0;
    while (getBits(8) === 0x00 && i++ < 3) {} // a non-zero value may indicate the end of the mode entries, or a read error

    if (i === 4) {
      // transform type and window type were all zeros
      modeBits = getBits(7); // modeBits may need to be used in the next iteration if this is the last mode entry
      mode[mapping] = modeBits & 0x01; // read and store mode -> block flag mapping
      position += 6; // go back 6 bits so next iteration starts right after the block flag
      mode.count++;
      console.log("mode", mapping, "block_flag", mode[mapping]);
    } else {
      // transform type and window type were not all zeros
      // check for mode count using previous iteration modeBits
      if (((reverse(modeBits) & 0b01111110) >> 1) + 1 === mode.count) {
        console.log("got mode count");
      } else {
        console.log(
          "mode count did not match actual modes, failed to parse vorbis modes"
        );
      }

      break;
    }
  }

  // mode mask to read the mode from the first byte in the vorbis frame

  mode.mask = (1 << Math.log2(mode.count)) - 1;
  // mode.mask = ((1 << (Math.log2(mode.count - 1) + 1)) - 1) << 1;

  // previous window flag is the next bit after the mode mask
  mode.prevMask = (mode.mask | 0x1) + 1;
  mode.nextMask = (mode.prevMask | 0x1) + 1;

  console.log(mode);

  return mode;
};

export { parseSetupHeader, reverse, toBinary };
