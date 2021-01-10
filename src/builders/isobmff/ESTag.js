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

import ContainerElement from "../ContainerElement";

export default class ESTag extends ContainerElement {
  constructor(tagNumber, { contents = [], tags = [] } = {}) {
    super(tagNumber, contents, tags);
    this.LENGTH_SIZE = 1;
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
  get contents() {
    const contents = super.contents;

    /* prettier-ignore */
    return [
      this._name,
      ...ESTag.getLength(contents.length),
    ].concat(contents);
  }

  addTag(tag) {
    this.addObject(tag);
  }
}