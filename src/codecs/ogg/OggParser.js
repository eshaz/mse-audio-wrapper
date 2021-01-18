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
import OggPage from "./OggPage";

import FlacParser from "../flac/FlacParser";
import OpusParser from "../opus/OpusParser";
import VorbisParser from "../vorbis/VorbisParser";

export default class OggParser extends CodecParser {
  constructor(onCodecUpdate) {
    super();
    this._onCodecUpdate = onCodecUpdate;
    this.CodecFrame = OggPage;
    this._maxHeaderLength = 283;
    this._codec = null;
  }

  get codec() {
    return this._codec || "";
  }

  _matchBytes(matchString, bytes) {
    return String.fromCharCode(...bytes).match(matchString);
  }

  setCodec({ data }) {
    if (this._matchBytes(/\x7fFLAC/, data.subarray(0, 5))) {
      this._codec = "flac";
      this._parser = new FlacParser(this._onCodecUpdate);
    } else if (this._matchBytes(/OpusHead/, data.subarray(0, 8))) {
      this._codec = "opus";
      this._parser = new OpusParser(this._onCodecUpdate);
    } else if (this._matchBytes(/\x01vorbis/, data.subarray(0, 7))) {
      this._codec = "vorbis";
      this._parser = new VorbisParser(this._onCodecUpdate);
    }
  }

  parseFrames(data) {
    const oggPages = this.fixedLengthFrame(data);

    if (!this._codec && oggPages.frames.length)
      this.setCodec(oggPages.frames[0]);

    return {
      frames: oggPages.frames.flatMap(
        (oggPage) => this._parser.parseFrames(oggPage).frames
      ),
      remainingData: oggPages.remainingData,
    };
  }
}