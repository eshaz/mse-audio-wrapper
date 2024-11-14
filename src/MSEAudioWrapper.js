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

import {
  WEBM,
  MP3,
  MP4A_40_2,
  FLAC,
  VORBIS,
  OPUS,
  AUDIO_MP4,
  AUDIO_WEBM,
} from "./constants.js";

import ISOBMFFContainer from "./containers/isobmff/ISOBMFFContainer.js";
import WEBMContainer from "./containers/webm/WEBMContainer.js";

const noOp = () => {};

export const getWrappedMimeType = (codec, container = WEBM) => {
  switch (codec) {
    case "mpeg":
      return `${AUDIO_MP4}"${MP3}"`;
    case "aac":
      return `${AUDIO_MP4}"${MP4A_40_2}"`;
    case "flac":
      return `${AUDIO_MP4}"${FLAC}"`;
    case "vorbis":
      return `${AUDIO_WEBM}"${VORBIS}"`;
    case "opus":
      return container === WEBM
        ? `${AUDIO_WEBM}"${OPUS}"`
        : `${AUDIO_MP4}"${OPUS}"`;
  }
};

export default class MSEAudioWrapper {
  /**
   * @description Wraps audio data into media source API compatible containers
   * @param {string} mimeType Mimetype of the audio data to wrap
   * @param {string} options.codec Codec of the audio data to wrap
   * @param {object} options.preferredContainer Preferred audio container to output if multiple containers are available
   * @param {number} options.minBytesPerSegment Minimum number of bytes to process before returning a media segment
   * @param {number} options.minFramesPerSegment Minimum number of frames to process before returning a media segment
   * @param {number} options.minBytesPerSegment Minimum number of bytes to process before returning a media segment
   * @param {boolean} options.enableLogging Set to true to enable debug logging
   */
  constructor(mimeType, options = {}) {
    this._inputMimeType = mimeType;

    this.PREFERRED_CONTAINER = options.preferredContainer || WEBM;
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
      enableLogging: options.enableLogging,
      enableFrameCRC32: false,
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
      yield* this._processFrames(
        [...this._codecParser.parseChunk(chunk)].flatMap(
          (frame) => frame.codecFrames || frame,
        ),
      );
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
    this._mimeType = getWrappedMimeType(codec, this.PREFERRED_CONTAINER);

    switch (codec) {
      case "mpeg":
        return new ISOBMFFContainer(MP3);
      case "aac":
        return new ISOBMFFContainer(MP4A_40_2);
      case "flac":
        return new ISOBMFFContainer(FLAC);
      case "vorbis":
        this.MAX_SAMPLES_PER_SEGMENT = 32767;
        return new WEBMContainer(VORBIS);
      case "opus":
        if (this.PREFERRED_CONTAINER === WEBM) {
          this.MAX_SAMPLES_PER_SEGMENT = 32767;
          return new WEBMContainer(OPUS);
        }
        return new ISOBMFFContainer(OPUS);
    }
  }
}
