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

export default class ISOBMFFObject {
  /**
   * @abstract
   * @description ISO Base Media File Format Object structure Abstract Class
   * @param {any} name Name of the object
   * @param {Array<Uint8>} [contents] Array of bytes to insert into this box
   * @param {Array<ISOBMFFObject>} [objects] Array of objects to insert into this object
   */
  constructor(name, contents, objects) {
    this._name = name;
    this._contents = contents;
    this._objects = objects;
  }

  get contents() {
    return this._contents.concat(
      this._objects.reduce((acc, obj) => acc.concat(obj.contents), [])
    );
  }

  /**
   * @returns {number} Total length of this object and all contents
   */
  get length() {
    return this._objects.reduce(
      (acc, obj) => acc + obj.length,
      this.LENGTH_SIZE + this._contents.length
    );
  }

  /**
   * @description Inserts bytes into the contents of this object
   * @param {Array<Uint>} data Bytes to insert
   * @param {number} index Position to insert bytes
   */
  insertBytes(data, index) {
    index = index + this.LENGTH_SIZE;
    this._contents = this._contents
      .slice(0, index)
      .concat(data)
      .concat(this._contents.slice(index));
  }

  /**
   * @description Appends data to the end of the contents of this box
   * @param {Array<Uint>} data Bytes to append
   */
  appendBytes(data) {
    this._contents = this._contents.concat(data);
  }

  addObject(object) {
    this._objects.push(object);
  }
}