/* Copyright 2020-2021 Ethan Halsall
    
    This file is part of mse-audio-wrapper.
    
    mse-audio-wrapper is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    mse-audio-wrapper is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

import CodecParser from "../CodecParser";
import VorbisFrame from "./VorbisFrame";
import VorbisHeader from "./VorbisHeader";

const toBinary = (integer, withPaddingLength) =>
  integer.toString(2).padStart(withPaddingLength, "0");

export default class VorbisParser extends CodecParser {
  constructor() {
    super();
    this.CodecFrame = VorbisFrame;
    this._maxHeaderLength = 29;

    this._vorbisHead = null;

    this._codecPrivate = {
      lacing: [],
      vorbisHead: null,
      vorbisSetup: null,
    };

    this._mode = {
      count: 0,
    };
    this._prevBlockSize = 0;
    this._currBlockSize = 0;
  }

  get codec() {
    return "vorbis";
  }

  parseFrames(oggPage) {
    if (oggPage.header.pageSequenceNumber === 0) {
      this._vorbisHead = VorbisHeader.getHeader(oggPage.data);

      // gather WEBM CodecPrivate data
      this._codecPrivate.vorbisHead = oggPage.data;
      this._codecPrivate.lacing = this._codecPrivate.lacing.concat(
        ...oggPage.header.pageSegmentBytes
      );

      return { frames: [], remainingData: 0 };
    }

    if (oggPage.header.pageSequenceNumber === 1) {
      // this._parseSetupHeader(oggPage);

      // gather WEBM CodecPrivate data
      this._codecPrivate.vorbisSetup = oggPage.data;
      for (const lace of oggPage.header.pageSegmentBytes) {
        this._codecPrivate.lacing.push(lace);
        if (lace !== 0xff) break;
      }

      this._vorbisHead.codecPrivate = this._codecPrivate;

      return { frames: [], remainingData: 0 };
    }

    return {
      frames: oggPage.segments.map(
        (segment) =>
          new VorbisFrame(
            segment,
            this._vorbisHead,
            this._vorbisHead.blocksize0 / 4 // this._getSamplesPerFrame(segment)
          )
      ),
      remainingData: 0,
    };
  }

  _parseSetupHeader(oggPage) {
    const setup = oggPage.segments[1];

    let position = setup.length * 8;

    const getBits = (bits) => {
      position -= bits;
      const byte = Math.floor(position / 8);
      const bit = position % 8;

      const byteWindow =
        (setup[byte - 1] << (bit + 7)) + ((setup[byte] || 0) << (bit - 1));

      const val = (byteWindow >> 7) & 0xff;
      console.log(toBinary(val, 8));
      return val;
    };

    //console.log(
    //  ...[...oggPage.segments[1].subarray(-32)].map((byte) => toBinary(byte, 8))
    //);
    //Array(16).fill(null).forEach(() => getBits(1))

    let loop = 0;

    this._mode = {
      count: 0,
    };
    this._prevBlockSize = 0;
    this._currBlockSize = 0;

    // search in reverse to parse out modes
    while (loop < 3) {
      // framing bit is offset in Ogg?
      if ((getBits(1) & 0b00000001) === 1) loop++; // framing bit
    }

    // limit mode count to 63 so previous block flag will be in first packet byte
    while (this._mode.count < 64) {
      const mapping = getBits(8); // vorbis_mode_mapping

      if (
        mapping > 63 || // mode mapping must be less than the total modes
        getBits(8) || // transform type
        getBits(8) || // transform type
        getBits(8) || // window type
        getBits(8) //    window type
      ) {
        console.log("invalid transform / window");
        break;
      }

      this._mode[mapping] = getBits(1) & 0x01; // block flag
      this._mode.count++;

      if (getBits(6) + 1 == this._mode.count) {
        console.log("got mode header");
      }
    }

    // mode mask to read the mode from the first byte in the vorbis frame
    this._mode.mask = ((1 << (Math.log2(this._mode.count - 1) + 1)) - 1) << 1;
    // previous window flag is the next bit after the mode mask
    this._mode.prevMask = (this._mode.mask | 0x1) + 1;

    console.log(this._mode);
  }

  _getSamplesPerFrame(segment) {
    const mode =
      this._mode.count === 0 ? 0 : (segment[0] & this._mode.mask) >> 1;

    // is this a large window
    if (this._mode[mode]) {
      const flag = !!(segment[0] & this._mode.prevMask);
      this._prevBlockSize = this._vorbisHead[`blocksize${flag}`];
    }

    this._currBlockSize = this._vorbisHead[`blocksize${this._mode[mode]}`];
    const samples = (this._prevBlockSize + this._currBlockSize) >> 2;
    this._prevBlockSize = this._currBlockSize;

    return samples;
  }
}
