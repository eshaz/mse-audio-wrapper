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

import CodecFrame from "../CodecFrame";
import OGGPageHeader from "./OGGPageHeader";

export default class OGGPage extends CodecFrame {
  constructor(data) {
    const oggPage = OGGPageHeader.getHeader(data);

    super(
      oggPage,
      oggPage &&
        data.subarray(oggPage.length, oggPage.length + oggPage.dataByteLength),
      oggPage && oggPage.length + oggPage.dataByteLength
    );

    if (oggPage) {
      let offset = oggPage.length;
      this._segments = oggPage.pageSegmentTable.map((segmentLength) => {
        const segment = data.subarray(offset, offset + segmentLength);
        offset += segmentLength;
        return segment;
      });
    }
  }

  get segments() {
    return this._segments;
  }
}
