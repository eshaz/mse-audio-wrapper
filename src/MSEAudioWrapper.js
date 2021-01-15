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

import MPEGParser from "./codecs/mpeg/MPEGParser";
import AACParser from "./codecs/aac/AACParser";
import OGGParser from "./codecs/ogg/OGGParser";
import ISOBMFFContainer from "./containers/isobmff/ISOBMFFContainer";
import WEBMContainer from "./containers/webm/WEBMContainer";

export default class MSEAudioWrapper {
  /**
   * @description Wraps audio data into media source API compatible containers
   * @param {string} mimeType Mimetype of the audio data to wrap
   * @param {object} options.preferredContainer Preferred audio container to output if multiple containers are available
   * @param {number} options.minBytesPerSegment Minimum number of bytes to process before returning a media segment
   * @param {number} options.minFramesPerSegment Minimum number of frames to process before returning a media segment
   * @param {number} options.minBytesPerSegment Minimum number of bytes to process before returning a media segment
   */
  constructor(mimeType, options = {}) {
    this._inputMimeType = mimeType;
    this.PREFERRED_CONTAINER = options.preferredContainer || "fmp4";
    this.MIN_FRAMES = options.minFramesPerSegment || 4;
    this.MIN_FRAMES_LENGTH = options.minBytesPerSegment || 1022;

    this._frames = [];
    this._codecData = new Uint8Array(0);
    this._codecParser = this._getCodecParser();

    this._generator = this._generator();
    this._generator.next();
  }

  /**
   * @public
   * @returns The mimetype being returned from MSEAudioWrapper
   */
  get mimeType() {
    return this._mimeType;
  }

  /**
   * @public
   * @returns The mimetype of the incoming audio data
   */
  get inputMimeType() {
    return this._inputMimeType;
  }

  /**
   * @public
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
   * @description Appends two buffers
   * @param {Uint8Array} buf1
   * @param {Uint8Array} buf2
   */
  static _appendBuffers(buf1, buf2) {
    const buf = new Uint8Array(buf1.length + buf2.length);
    buf.set(buf1);
    buf.set(buf2, buf1.length);

    return buf;
  }

  /**
   * @private
   */
  _getCodecParser() {
    if (this._inputMimeType.match(/aac/)) {
      return new AACParser();
    } else if (this._inputMimeType.match(/mpeg/)) {
      return new MPEGParser();
    } else if (this._inputMimeType.match(/ogg/)) {
      return new OGGParser();
    }
  }

  /**
   * @private
   */
  _getContainer() {
    switch (this._codecParser.codec) {
      case "mp3":
        this._mimeType = 'audio/mp4;codecs="mp3"';
        return new ISOBMFFContainer("mp3");
      case "mp4a.40.2":
        this._mimeType = 'audio/mp4;codecs="mp4a.40.2"';
        return new ISOBMFFContainer("mp4a.40.2");
      case "flac":
        this._mimeType = 'audio/mp4;codecs="flac"';
        return new ISOBMFFContainer("flac");
      case "vorbis":
        this._mimeType = 'audio/webm;codecs="vorbis"';
        return new WEBMContainer("vorbis");
      case "opus":
        if (this.PREFERRED_CONTAINER === "webm") {
          this._mimeType = 'audio/webm;codecs="opus"';
          return new WEBMContainer("opus");
        }
        this._mimeType = 'audio/mp4;codecs="opus"';
        return new ISOBMFFContainer("opus");
    }
  }

  /**
   * @private
   */
  *_generator() {
    let frames;
    // start parsing out frames
    while (!frames) {
      yield* this._sendReceiveData();
      frames = this._parseFrames();
    }

    this._container = this._getContainer();

    // yield the movie box along with a movie fragment containing frames
    let mseData = MSEAudioWrapper._appendBuffers(
      this._container.getInitializationSegment(frames[0].header),
      this._container.getMediaSegment(frames)
    );

    // yield movie fragments containing frames
    while (true) {
      yield* this._sendReceiveData(mseData);
      frames = this._parseFrames();
      mseData = frames ? this._container.getMediaSegment(frames) : null;
    }
  }

  /**
   * @private
   */
  *_sendReceiveData(mseData) {
    let codecData = yield mseData;

    while (!codecData) {
      codecData = yield;
    }

    this._codecData = MSEAudioWrapper._appendBuffers(
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
