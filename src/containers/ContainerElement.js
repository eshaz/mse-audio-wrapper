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

export default class ContainerElement {
  /**
   * @abstract
   * @description Container Object structure Abstract Class
   * @param {any} name Name of the object
   * @param {Array<Uint8>} [contents] Array of arrays or typed arrays, or a single number or typed array
   * @param {Array<ContainerElement>} [objects] Array of objects to insert into this object
   */
  constructor(name, contents, objects) {
    this._name = name;
    this._contents = contents;
    this._objects = objects;
  }

  /**
   * @description Converts a string to a byte array
   * @param {string} name String to convert
   * @returns {Uint8Array}
   */
  static stringToByteArray(name) {
    return [...name].map((char) => char.charCodeAt(0));
  }

  /**
   * @description Converts a JavaScript number to Uint32
   * @param {number} number Number to convert
   * @returns {Uint32}
   */
  static getFloat64(number) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, number);
    return bytes;
  }

  /**
   * @description Converts a JavaScript number to Uint32
   * @param {number} number Number to convert
   * @returns {Uint32}
   */
  static getUint64(number) {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(number));
    return bytes;
  }

  /**
   * @description Converts a JavaScript number to Uint32
   * @param {number} number Number to convert
   * @returns {Uint32}
   */
  static getUint32(number) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, number);
    return bytes;
  }

  /**
   * @description Converts a JavaScript number to Uint16
   * @param {number} number Number to convert
   * @returns {Uint32}
   */
  static getUint16(number) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, number);
    return bytes;
  }

  /**
   * @description Converts a JavaScript number to Int16
   * @param {number} number Number to convert
   * @returns {Uint32}
   */
  static getInt16(number) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setInt16(0, number);
    return bytes;
  }

  static *flatten(array) {
    for (const item of array) {
      if (Array.isArray(item)) {
        yield* ContainerElement.flatten(item);
      } else {
        yield item;
      }
    }
  }

  /**
   * @returns {Array<Array<number> | Uint8Array>} Contents of this container element
   */
  get contents() {
    const array = [[]];

    for (const element of ContainerElement.flatten(this._buildContents())) {
      if (typeof element !== "object") {
        array[array.length - 1].push(element);
      } else {
        array.push(element);
        array.push([]);
      }
    }

    return array;
  }

  /**
   * @returns {number} Length of this container element
   */
  get length() {
    return this._buildLength();
  }

  _buildContents() {
    return [
      this._contents,
      ...this._objects.map((obj) => obj._buildContents()),
    ];
  }

  _buildLength() {
    let length;

    if (Array.isArray(this._contents)) {
      length = this._contents.reduce(
        (acc, val) => acc + (val.length === undefined ? 1 : val.length),
        0
      );
    } else {
      length = this._contents.length === undefined ? 1 : this._contents.length;
    }

    return length + this._objects.reduce((acc, obj) => acc + obj.length, 0);
  }

  addChild(object) {
    this._objects.push(object);
  }
}
