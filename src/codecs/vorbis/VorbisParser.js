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

export default class VorbisParser extends CodecParser {
  constructor() {
    super();
    this.CodecFrame = VorbisFrame;
    this._vorbisHead = null;
    this._webmCodecPrivate = {
      lacing: [],
      vorbisHead: null,
      vorbisSetup: null,
    };
    this._maxHeaderLength = 29;
  }

  get codec() {
    return "vorbis";
  }

  parseFrames(oggPage) {
    if (oggPage.header.pageSequenceNumber === 0) {
      // identification header
      this._vorbisHead = VorbisHeader.getHeader(oggPage.data);
      this._webmCodecPrivate.vorbisHead = oggPage.data;
      this._webmCodecPrivate.lacing = this._webmCodecPrivate.lacing.concat(
        ...oggPage.header.pageSegmentBytes
      );

      return { frames: [], remainingData: 0 };
    }

    if (oggPage.header.pageSequenceNumber === 1) {
      // vorbis comment, and setup header
      this._webmCodecPrivate.vorbisSetup = oggPage.data;

      for (const lace of oggPage.header.pageSegmentBytes) {
        this._webmCodecPrivate.lacing.push(lace);
        if (lace !== 0xff) break;
      }

      return { frames: [], remainingData: 0 };
    }

    return {
      frames: oggPage.segments
        /*.filter(
          (segment) =>
            segment[0] === 0x00 &&
            segment[1] === 0x76 &&
            segment[2] === 0x6f &&
            segment[3] === 0x72 &&
            segment[4] === 0x62 &&
            segment[5] === 0x69 &&
            segment[6] === 0x73
        )*/
        .map(
          (segment) =>
            new VorbisFrame(segment, this._vorbisHead, this._webmCodecPrivate)
        ),
      remainingData: 0,
    };
  }
}
