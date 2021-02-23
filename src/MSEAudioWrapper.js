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

import { concatBuffers } from "./utilities";

import MPEGParser from "./codecs/mpeg/MPEGParser";
import AACParser from "./codecs/aac/AACParser";
import OggParser from "./codecs/ogg/OggParser";

import ISOBMFFContainer from "./containers/isobmff/ISOBMFFContainer";
import WEBMContainer from "./containers/webm/WEBMContainer";

const noOp = () => {};

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
    this.MAX_FRAMES = options.maxFramesPerSegment || 20;
    this.MIN_FRAMES_LENGTH = options.minBytesPerSegment || 1022;
    this._onCodecUpdate = options.onCodecUpdate || noOp;
    this._onMimeType = options.onMimeType || noOp;

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
   */
  _getCodecParser() {
    if (this._inputMimeType.match(/aac/)) {
      return new AACParser(this._onCodecUpdate);
    } else if (this._inputMimeType.match(/mpeg/)) {
      return new MPEGParser(this._onCodecUpdate);
    } else if (this._inputMimeType.match(/ogg/)) {
      return new OggParser(this._onCodecUpdate);
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
    this._onMimeType(this._mimeType);

    // yield the movie box along with a movie fragment containing frames
    let mseData = concatBuffers(
      this._container.getInitializationSegment(frames[0][0].header),
      ...frames.map((frameGroup) => this._container.getMediaSegment(frameGroup))
    );

    // yield movie fragments containing frames
    while (true) {
      yield* this._sendReceiveData(mseData);
      frames = this._parseFrames();
      mseData = frames
        ? concatBuffers(
            ...frames.map((frameGroup) =>
              this._container.getMediaSegment(frameGroup)
            )
          )
        : null;
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

    this._codecData = concatBuffers(this._codecData, codecData);
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
      const remainingFrames = this._frames.length % this.MAX_FRAMES;

      const framesToReturn =
        remainingFrames < this.MIN_FRAMES // store the frames if a group doesn't meet min frames
          ? this._frames.length - remainingFrames
          : this._frames.length;

      const groups = [];
      for (let i = 0; i < framesToReturn; i++) {
        const index = Math.floor(i / this.MAX_FRAMES);

        if (!groups[index]) groups[index] = [];
        groups[index].push(this._frames.shift());
      }

      return groups;
    }
  }
}
