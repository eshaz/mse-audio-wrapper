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

import { concatBuffers } from "./utilities";
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

    this._onMimeType = options.onMimeType || noOp;

    this._frames = [];
    this._codecParser = new CodecParser(mimeType, {
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

  wrap(chunk) {
    const frames = [...this._codecParser.iterator(chunk)];
    this._frames.push(...frames);

    const groups = this._groupFrames();

    if (groups) {
      if (!this._mimeType) {
        this._container = this._getContainer();
        this._onMimeType(this._mimeType);

        return concatBuffers(
          this._container.getInitializationSegment(groups[0][0]),
          ...groups.map((frameGroup) =>
            this._container.getMediaSegment(frameGroup)
          )
        );
      }

      return concatBuffers(
        ...groups.map((frameGroup) =>
          this._container.getMediaSegment(frameGroup)
        )
      );
    }
  }

  _groupFrames() {
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
}
