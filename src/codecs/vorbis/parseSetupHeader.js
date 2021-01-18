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

  console.log(setup.length);

  const getBits = (bits) => {
    const byte = Math.floor(position / 8);
    const bit = position % 8;

    const byteWindow =
      (reverse(setup[byte - 1]) << (bit + 7)) +
      (reverse(setup[byte]) << (bit - 1));

    const val = (byteWindow >> 7) & 0xff;

    console.log(toBinary(val, 8), byte, bit);
    //console.log(toBinary(reverse, 8), byte, bit);
    position -= bits;
    return val;
  };

  console.log(
    ...[...setup.subarray(-32)].map((byte) => toBinary(reverse(byte), 8))
  );
  //console.log(Array(16).fill(null).map(() => toBinary(getBits(8), 8)))

  let mode = {
    count: 0,
  };

  // search in reverse to parse out modes
  while ((getBits(1) & 0x01) !== 1) {}

  // read first mode mapping

  let bytes;
  // limit mode count to 63 so previous block flag will be in first packet byte
  while (mode.count < 64) {
    const mapping = reverse(getBits(8)); // vorbis mode_mapping
    console.log("mapping", mapping);

    let i = 0; // 2 bytes transform type, 2 bytes window type

    while (4 >= ++i) {
      bytes = getBits(8);
      if (bytes !== 0x00) {
        break;
      }
    }

    bytes = getBits(7);

    if (i > 4) {
      if (mapping in mode) console.log("duplicate mode mapping");
      mode[mapping] = bytes & 0x01; // block flag
      mode.count++;
      position += 6; // prepare read position for next iteration
    } else {
      console.log("non zero window");
      break;
    }

    console.log("mode", mode);

    if (((reverse(bytes) & 0b01111110) >> 1) + 1 === mode.count) {
      console.log("got mode header");
      //break;
    }

    if (position <= 0) break;
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
