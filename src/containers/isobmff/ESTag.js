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

import ContainerElement from "../ContainerElement";

export default class ESTag extends ContainerElement {
  constructor(tagNumber, { contents = [], tags = [] } = {}) {
    super(tagNumber, contents, tags);
    this.MIN_SIZE = 5;
  }

  static getLength(length) {
    let bytes = ContainerElement.getUint32(length);

    bytes.every((byte, i, array) => {
      if (byte === 0x00) {
        array[i] = 0x80;
        return true;
      }
      return false;
    });

    return bytes;
  }

  /**
   * @returns {Uint8Array} Contents of this stream descriptor tag
   */
  _buildContents() {
    return [this._name, ...this._lengthBytes, ...super._buildContents()];
  }

  _buildLength() {
    const length = super._buildLength();
    this._lengthBytes = ESTag.getLength(length);

    return 1 + length + this._lengthBytes.length;
  }

  addTag(tag) {
    this.addChild(tag);
  }
}
