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

import CodecParser from "codec-parser";

import ISOBMFFContainer from "./containers/isobmff/ISOBMFFContainer.js";
import WEBMContainer from "./containers/webm/WEBMContainer.js";

const noOp = () => {};

export default class MSEAudioWrapper {
  /**
   * @description Wraps audio data into media source API compatible containers
   * @param {string} mimeType Mimetype of the audio data to wrap
   * @param {string} options.codec Codec of the audio data to wrap
   * @param {object} options.preferredContainer Preferred audio container to output if multiple containers are available
   * @param {number} options.minBytesPerSegment Minimum number of bytes to process before returning a media segment
   * @param {number} options.minFramesPerSegment Minimum number of frames to process before returning a media segment
   * @param {number} options.minBytesPerSegment Minimum number of bytes to process before returning a media segment
   */
  constructor(mimeType, options = {}) {
    this._inputMimeType = mimeType;

    this.PREFERRED_CONTAINER = options.preferredContainer || "webm";
    this.MIN_FRAMES = options.minFramesPerSegment || 4;
    this.MAX_FRAMES = options.maxFramesPerSegment || 50;
    this.MIN_FRAMES_LENGTH = options.minBytesPerSegment || 1022;
    this.MAX_SAMPLES_PER_SEGMENT = Infinity;

    this._onMimeType = options.onMimeType || noOp;

    if (options.codec) {
      this._container = this._getContainer(options.codec);
      this._onMimeType(this._mimeType);
    }

    this._frames = [];
    this._codecParser = new CodecParser(mimeType, {
      onCodec: (codec) => {
        this._container = this._getContainer(codec);
        this._onMimeType(this._mimeType);
      },
      onCodecUpdate: options.onCodecUpdate,
    });
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
   * @param {Uint8Array | Array<Frame>} chunk Next chunk of codec data to read
   * @returns {Iterator} Iterator that operates over the codec data.
   * @yields {Uint8Array} Movie Fragments containing codec frames
   */
  *iterator(chunk) {
    if (chunk.constructor === Uint8Array) {
      yield* this._processFrames([...this._codecParser.iterator(chunk)]);
    } else if (Array.isArray(chunk)) {
      yield* this._processFrames(chunk);
    }
  }

  /**
   * @private
   */
  *_processFrames(frames) {
    this._frames.push(...frames);

    if (this._frames.length) {
      const groups = this._groupFrames();

      if (groups.length) {
        if (!this._sentInitialSegment) {
          this._sentInitialSegment = true;

          yield this._container.getInitializationSegment(groups[0][0]);
        }
        for (const frameGroup of groups) {
          yield this._container.getMediaSegment(frameGroup);
        }
      }
    }
  }

  /**
   * @private
   */
  _groupFrames() {
    const groups = [[]];
    let currentGroup = groups[0];
    let samples = 0;

    for (const frame of this._frames) {
      if (
        currentGroup.length === this.MAX_FRAMES ||
        samples >= this.MAX_SAMPLES_PER_SEGMENT
      ) {
        samples = 0;
        groups.push((currentGroup = [])); // create new group
      }

      currentGroup.push(frame);
      samples += frame.samples;
    }

    // store remaining frames
    this._frames =
      currentGroup.length < this.MIN_FRAMES ||
      currentGroup.reduce((acc, frame) => acc + frame.data.length, 0) <
        this.MIN_FRAMES_LENGTH
        ? groups.pop()
        : [];

    return groups;
  }

  /**
   * @private
   */
  _getContainer(codec) {
    switch (codec) {
      case "mpeg":
        this._mimeType = 'audio/mp4;codecs="mp3"';
        return new ISOBMFFContainer("mp3");
      case "aac":
        this._mimeType = 'audio/mp4;codecs="mp4a.40.2"';
        return new ISOBMFFContainer("mp4a.40.2");
      case "flac":
        this._mimeType = 'audio/mp4;codecs="flac"';
        return new ISOBMFFContainer("flac");
      case "vorbis":
        this._mimeType = 'audio/webm;codecs="vorbis"';

        this.MAX_SAMPLES_PER_SEGMENT = 32767;
        return new WEBMContainer("vorbis");
      case "opus":
        if (this.PREFERRED_CONTAINER === "webm") {
          this._mimeType = 'audio/webm;codecs="opus"';

          this.MAX_SAMPLES_PER_SEGMENT = 32767;
          return new WEBMContainer("opus");
        }
        this._mimeType = 'audio/mp4;codecs="opus"';
        return new ISOBMFFContainer("opus");
    }
  }
}
