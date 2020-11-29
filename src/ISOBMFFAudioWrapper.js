/* Copyright 2020 Ethan Halsall
    
    This file is part of isobmff-audio.
    
    isobmff-audio is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    isobmff-audio is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

import MPEGParser from "./codecs/mpeg/MPEGParser";
import AACParser from "./codecs/aac/AACParser";
import OGGParser from "./codecs/ogg/OGGParser";

import ISOBMFFBuilder from "./isobmff/ISOBMFFBuilder";

/**
 * @description Generator that takes in MPEG 1/2, AAC, or Ogg FLAC and yields Fragmented MP4 (ISOBMFF)
 */
export default class ISOBMFFAudioWrapper {
  constructor(mimeType) {
    this.MIN_FRAMES = 4;
    this.MIN_FRAMES_LENGTH = 1022;

    if (mimeType.match(/aac/)) {
      this._codecParser = new AACParser();
    } else if (mimeType.match(/mpeg/)) {
      this._codecParser = new MPEGParser();
    } else if (mimeType.match(/ogg/)) {
      this._codecParser = new OGGParser();
    }

    this._frames = [];
    this._codecData = new Uint8Array(0);

    this._generator = this._generator();
    this._generator.next();
  }

  get mimeType() {
    return `audio/mp4;codecs="${this._codecParser.codec}"`;
  }

  /**
   * @private
   * @description Appends two buffers
   * @param {Uint8Array} buf1
   * @param {Uint8Array} buf2
   */
  static appendBuffers(buf1, buf2) {
    const buf = new Uint8Array(buf1.length + buf2.length);
    buf.set(buf1);
    buf.set(buf2, buf1.length);

    return buf;
  }

  /**
   * @description Returns an iterator for the passed in codec data.
   * @param {Uint8Array} chunk Next chunk of codec data to read
   * @returns {IterableIterator} Iterator that operates over the codec data.
   * @yields {Uint8Array} Movie Fragments containing codec frames
   */
  *iterator(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {
      yield i.value;
    }
  }

  /**
   * @private
   * @description Internal generator.
   * @yields {Uint8Array} Movie Fragments containing codec frames
   */
  *_generator() {
    let frames;
    // start parsing out frames
    while (!frames) {
      yield* this._sendReceiveData();
      frames = this._parseFrames();
    }

    this._ISOBMFFBuilder = new ISOBMFFBuilder(this.mimeType);

    // yield the movie box along with a movie fragment containing frames
    let fMP4 = ISOBMFFAudioWrapper.appendBuffers(
      this._ISOBMFFBuilder.getMovieBox(frames[0].header),
      this._ISOBMFFBuilder.wrapFrames(frames)
    );

    // yield movie fragments containing frames
    while (true) {
      yield* this._sendReceiveData(fMP4);
      frames = this._parseFrames();
      fMP4 = frames ? this._ISOBMFFBuilder.wrapFrames(frames) : null;
    }
  }

  /**
   * @private
   * @param {Uint8Array} fMP4 Fragmented MP4 to send
   * @yields {Uint8Array} Fragmented MP4
   */
  *_sendReceiveData(fMP4) {
    let codecData = yield fMP4;

    while (!codecData) {
      codecData = yield;
    }

    this._codecData = ISOBMFFAudioWrapper.appendBuffers(
      this._codecData,
      codecData
    );
  }

  /**
   * @private
   */
  _parseFrames() {
    const { frames, remainingData } = this._codecParser.parseFrames(
      this._codecData
    );

    this._frames = this._frames.concat(frames);
    this._codecData = this._codecData.subarray(remainingData);

    if (
      this._frames.length >= this.MIN_FRAMES &&
      this._frames.reduce((acc, frame) => acc + frame.data.length, 0) >=
        this.MIN_FRAMES_LENGTH
    ) {
      const frames = this._frames;
      this._frames = [];
      return frames;
    }
  }
}
