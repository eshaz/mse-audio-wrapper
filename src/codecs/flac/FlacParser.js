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

import CodecParser from "../CodecParser";
import FlacFrame from "../flac/FlacFrame";

export default class FlacParser extends CodecParser {
  constructor() {
    super();
    this.CodecFrame = FlacFrame;
    this._maxHeaderLength = 26;
  }

  get codec() {
    return "flac";
  }

  parseFrames(oggPage) {
    return {
      frames: oggPage.segments.map(FlacFrame.getFrame).filter(Boolean),
      remainingData: 0,
    };
  }
}
