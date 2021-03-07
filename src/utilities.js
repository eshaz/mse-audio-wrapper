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

const xiphLacing = (...buffers) =>
  buffers.flatMap((buffer) => {
    const lacing = [];
    for (let l = buffer.length; l >= 0; l -= 255) {
      lacing.push(l >= 255 ? 255 : l);
    }
    return lacing;
  });

const logError = (...messages) => {
  console.error(
    "mse-audio-wrapper",
    messages.reduce((acc, message) => acc + "\n  " + message, "")
  );
};

export { logError, xiphLacing };
