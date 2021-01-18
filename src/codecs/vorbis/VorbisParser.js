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
import { parseSetupHeader, reverse, toBinary } from "./parseSetupHeader";

export default class VorbisParser extends CodecParser {
  constructor(onCodecUpdate) {
    super(onCodecUpdate);
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
      this._vorbisHead = VorbisHeader.getHeader(
        oggPage.data,
        this._headerCache
      );
      // gather WEBM CodecPrivate data
      this._codecPrivate.vorbisHead = oggPage.segments[0];
      this._codecPrivate.lacing = this._codecPrivate.lacing.concat(
        ...oggPage.header.pageSegmentBytes
      );

      console.log(this._vorbisHead);

      return { frames: [], remainingData: 0 };
    }

    if (oggPage.header.pageSequenceNumber === 1) {
      // gather WEBM CodecPrivate data
      this._codecPrivate.vorbisSetup = oggPage.data;
      for (const lace of oggPage.header.pageSegmentBytes) {
        this._codecPrivate.lacing.push(lace);
        if (lace !== 0xff) break;
      }

      this._vorbisHead.codecPrivate = this._codecPrivate;

      this._mode = parseSetupHeader(oggPage.segments[1]);

      return { frames: [], remainingData: 0 };
    }

    return {
      frames: oggPage.segments.map(
        (segment) =>
          new VorbisFrame(
            segment,
            this._vorbisHead,
            this._getSamplesPerFrame(segment)
          )
      ),
      remainingData: 0,
    };
  }

  _getSamplesPerFrame(segment) {
    const byte = segment[0] >> 1;

    const blockFlag = this._mode[byte & this._mode.mask];
    let prevWindowBlockFlag, nextWindowBlockFlag;

    // is this a large window
    if (blockFlag) {
      prevWindowBlockFlag = byte & this._mode.prevMask ? 1 : 0;
      nextWindowBlockFlag = byte & this._mode.nextMask ? 1 : 0;
      this._prevBlockSize = this._vorbisHead[`blocksize${prevWindowBlockFlag}`];
    }

    this._currBlockSize = this._vorbisHead[`blocksize${blockFlag}`];

    const samples = (this._prevBlockSize + this._currBlockSize) >> 2;
    this._prevBlockSize = this._currBlockSize;

    console.log(
      toBinary(byte, 8),
      blockFlag,
      prevWindowBlockFlag,
      nextWindowBlockFlag,
      samples
    );

    return samples;
  }
}
