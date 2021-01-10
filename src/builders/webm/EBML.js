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

export default class EBML extends ContainerElement {
  /**
   * @description ISO/IEC 14496-12 Part 12 ISO Base Media File Format Box
   * @param {name} name ID of the EBML element
   * @param {object} params Object containing contents or children
   * @param {boolean} [isUnknownLength] Set to true to use the unknown length constant for EBML
   * @param {Array<Uint8>} [params.contents] Array of bytes to insert into this box
   * @param {Array<Box>} [params.children] Array of children to insert into this box
   */
  constructor(
    name,
    { contents = [], children = [], isUnknownLength = false } = {}
  ) {
    super(name, contents, children);

    this._isUnknownLength = isUnknownLength;
  }

  /**
   * @description Converts a JavaScript number into a variable length EBML integer
   * @param {number} number Number to convert
   */
  static getVint(number) {
    if (number < 2 ** 7 - 1) {
      return [0b10000000 | number];
    } else if (number < 2 ** 14 - 1) {
      const buffer = ContainerElement.getUint16(number);
      buffer[0] |= 0b01000000;
      return buffer;
    } else if (number < 2 ** 21 - 1) {
      const buffer = ContainerElement.getUint32(number).subarray(1);
      buffer[0] |= 0b00100000;
      return buffer;
    } else if (number < 2 ** 28 - 1) {
      const buffer = ContainerElement.getUint32(number);
      buffer[0] |= 0b00010000;
      return buffer;
    } else if (number < 2 ** 35 - 1) {
      const buffer = ContainerElement.getUint64(number).subarray(3);
      buffer[0] |= 0b00001000;
      return buffer;
    } else if (number < 2 ** 42 - 1) {
      const buffer = ContainerElement.getUint64(number).subarray(2);
      buffer[0] |= 0b00000100;
      return buffer;
    } else if (number < 2 ** 49 - 1) {
      const buffer = ContainerElement.getUint64(number).subarray(1);
      buffer[0] |= 0b00000010;
      return buffer;
    } else if (number < 2 ** 56 - 1) {
      const buffer = ContainerElement.getUint64(number);
      buffer[0] |= 0b00000001;
      return buffer;
    } else if (typeof number !== "number") {
      throw new Error(
        `Variable integer must be a number, instead received ${number}`
      );
    }
  }

  /**
   * @returns {number} Total length of this object and all contents
   */
  get length() {
    const length = super.length;

    return length + EBML.getVint(length).length;
  }

  /**
   * @returns {Array<Uint8>} Contents of this EBML tag
   */
  get contents() {
    const contents = super.contents;

    // prettier-ignore
    return this._name
      .concat(
        this._isUnknownLength
          ? [0x01,0xff,0xff,0xff,0xff,0xff,0xff,0xff] // unknown length constant
          : [...EBML.getVint(contents.length)]
      )
      .concat(contents);
  }
}
