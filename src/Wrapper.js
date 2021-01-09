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
import WEBMBuilder from "./webm/WEBMBuilder";

/**
 * @description Generator that takes in MPEG 1/2, AAC, or Ogg FLAC and yields Fragmented MP4 (ISOBMFF)
 */
export default class Wrapper {
  constructor(mimeType, options = {}) {
    this.MIN_FRAMES = options.minFramesPerSegment || 100; // 4
    this.MIN_FRAMES_LENGTH = options.minBytesPerSegment || 1022;

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
    return this._mimeType;
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

  getBuilder() {
    switch (this._codecParser.codec) {
      case "mp3":
        this._mimeType = 'audio/mp4;codecs="mp3"';
        return new ISOBMFFBuilder("mp3");
      case "mp4a.40.2":
        this._mimeType = 'audio/mp4;codecs="mp4a.40.2"';
        return new ISOBMFFBuilder("mp4a.40.2");
      case "flac":
        this._mimeType = 'audio/mp4;codecs="flac"';
        return new ISOBMFFBuilder("flac");
      case "opus":
        this._mimeType = `audio/webm;codecs="opus"`;
        return new WEBMBuilder("opus");
    }
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

    this._builder = this.getBuilder();

    // yield the movie box along with a movie fragment containing frames
    let mseData = Wrapper.appendBuffers(
      this._builder.getInitializationSegment(frames[0].header),
      this._builder.getMediaSegment(frames)
    );

    // yield movie fragments containing frames
    while (true) {
      yield* this._sendReceiveData(mseData);
      frames = this._parseFrames();
      mseData = frames ? this._builder.getMediaSegment(frames) : null;
    }
  }

  /**
   * @private
   * @param {Uint8Array} mseData Fragmented MP4 to send
   * @yields {Uint8Array} Fragmented MP4
   */
  *_sendReceiveData(mseData) {
    let codecData = yield mseData;

    while (!codecData) {
      codecData = yield;
    }

    this._codecData = Wrapper.appendBuffers(this._codecData, codecData);
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
