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

import CodecFrame from "../CodecFrame";
import FlacHeader from "./FlacHeader";

export default class FlacFrame extends CodecFrame {
  constructor(data, header) {
    super(header, data, data.length);
  }

  static getFrame(segment) {
    const header = FlacHeader.getHeader(segment);

    return header && new FlacFrame(segment, header);
  }
}
