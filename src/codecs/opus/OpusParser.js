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
import OpusFrame from "./OpusFrame";
import OpusHeader from "./OpusHeader";

export default class OpusParser extends CodecParser {
  constructor() {
    super();
    this.CodecFrame = OpusFrame;
    this._initialHeader = null;
    this._maxHeaderLength = 26;
  }

  static decodeLength(data, readPos) {
    if (data[readPos] >= 0xfc)
      return {
        value: data[readPos] + data[readPos + 1] * 4,
        byteLength: 2,
      };
    return { value: data[readPos], byteLength: 1 };
  }

  static getPacket(data) {
    let readPos = 0;
    const packet = { length: 1 };
    if (data.length < packet.length) return null;

    //  0 1 2 3 4 5 6 7
    // +-+-+-+-+-+-+-+-+
    // | config  |s| c |
    // +-+-+-+-+-+-+-+-+
    const configTable = {
      0b00000000: { mode: "SILK-only", bandwidth: "NB", frameSize: 10 },
      0b00001000: { mode: "SILK-only", bandwidth: "NB", frameSize: 20 },
      0b00010000: { mode: "SILK-only", bandwidth: "NB", frameSize: 40 },
      0b00011000: { mode: "SILK-only", bandwidth: "NB", frameSize: 60 },
      0b00100000: { mode: "SILK-only", bandwidth: "MB", frameSize: 10 },
      0b00101000: { mode: "SILK-only", bandwidth: "MB", frameSize: 20 },
      0b00110000: { mode: "SILK-only", bandwidth: "MB", frameSize: 40 },
      0b00111000: { mode: "SILK-only", bandwidth: "MB", frameSize: 60 },
      0b01000000: { mode: "SILK-only", bandwidth: "WB", frameSize: 10 },
      0b01001000: { mode: "SILK-only", bandwidth: "WB", frameSize: 20 },
      0b01010000: { mode: "SILK-only", bandwidth: "WB", frameSize: 40 },
      0b01011000: { mode: "SILK-only", bandwidth: "WB", frameSize: 60 },
      0b01100000: { mode: "Hybrid", bandwidth: "SWB", frameSize: 10 },
      0b01101000: { mode: "Hybrid", bandwidth: "SWB", frameSize: 20 },
      0b01110000: { mode: "Hybrid", bandwidth: "FB", frameSize: 10 },
      0b01111000: { mode: "Hybrid", bandwidth: "FB", frameSize: 20 },
      0b10000000: { mode: "CELT-only", bandwidth: "NB", frameSize: 2.5 },
      0b10001000: { mode: "CELT-only", bandwidth: "NB", frameSize: 5 },
      0b10010000: { mode: "CELT-only", bandwidth: "NB", frameSize: 10 },
      0b10011000: { mode: "CELT-only", bandwidth: "NB", frameSize: 20 },
      0b10100000: { mode: "CELT-only", bandwidth: "WB", frameSize: 2.5 },
      0b10101000: { mode: "CELT-only", bandwidth: "WB", frameSize: 5 },
      0b10110000: { mode: "CELT-only", bandwidth: "WB", frameSize: 10 },
      0b10111000: { mode: "CELT-only", bandwidth: "WB", frameSize: 20 },
      0b11000000: { mode: "CELT-only", bandwidth: "SWB", frameSize: 2.5 },
      0b11001000: { mode: "CELT-only", bandwidth: "SWB", frameSize: 5 },
      0b11010000: { mode: "CELT-only", bandwidth: "SWB", frameSize: 10 },
      0b11011000: { mode: "CELT-only", bandwidth: "SWB", frameSize: 20 },
      0b11100000: { mode: "CELT-only", bandwidth: "FB", frameSize: 2.5 },
      0b11101000: { mode: "CELT-only", bandwidth: "FB", frameSize: 5 },
      0b11110000: { mode: "CELT-only", bandwidth: "FB", frameSize: 10 },
      0b11111000: { mode: "CELT-only", bandwidth: "FB", frameSize: 20 },
    };

    packet.config = configTable[0b11111000 & data[readPos]];
    packet.channels = 0b00000100 & data[readPos] ? 2 : 1;

    // 0: 1 frame in the packet
    // 1: 2 frames in the packet, each with equal compressed size
    // 2: 2 frames in the packet, with different compressed sizes
    // 3: an arbitrary number of frames in the packet
    packet.code = 0b00000011 & data[readPos];
    readPos++;

    // https://tools.ietf.org/html/rfc6716#appendix-B
    switch (packet.code) {
      case 0:
        const frameLength = OpusParser.decodeLength(data, readPos);
        readPos += frameLength.byteLength;

        packet.length += frameLength.value;
        packet.frameCount = 1;
        break;
      case 1: {
        const frameLength = OpusParser.decodeLength(data, readPos);
        readPos += frameLength.byteLength;

        packet.length += frameLength.value;
        packet.frameCount = 2;
        break;
      }
      case 2: {
        const firstLength = OpusParser.decodeLength(data, readPos);
        readPos += firstLength.byteLength;
        const secondLength = OpusParser.decodeLength(data, readPos);
        readPos += secondLength.byteLength;

        packet.length += firstLength.value + secondLength.value;
        packet.frameCount = 2;
        break;
      }
      case 3: {
        packet.isVbr = Boolean(0b10000000 & data[readPos]);
        packet.hasOpusPadding = Boolean(0b01000000 & data[readPos]);
        packet.frameCount = 0b00111111 & data[readPos];
        readPos++;

        if (packet.hasOpusPadding) {
          if (data[readPos] >= 0xfc) {
            packet.opusPadding = 0xfc + data[readPos + 1];
            readPos += 2;
          } else {
            packet.opusPadding = data[readPos];
            readPos++;
          }

          packet.length += packet.opusPadding;
        }

        if (packet.isVbr) {
          for (let i = 0; i < packet.frameCount; i++) {
            const length = OpusParser.decodeLength(data, readPos);
            readPos += length.byteLength;
            packet.length += length.byteLength + length.value;
          }
        } else {
          const length = OpusParser.decodeLength(data, readPos);
          readPos += length.byteLength;
          packet.length += length.byteLength + length.value * packet.frameCount;
        }

        break;
      }
    }
    console.log(packet);
    return packet;
  }

  get codec() {
    return "opus";
  }

  parseFrames(oggPage) {
    if (this._initialHeader) {
      return {
        frames: oggPage.segments
          .filter((segment) => segment[0] !== 0x4f && segment[1] !== 0x70)
          .map((segment) => new OpusFrame(segment, this._initialHeader)),
        remainingData: 0,
      };
    }

    this._initialHeader = OpusHeader.getHeader(oggPage.data);
    return { frames: [], remainingData: 0 };
  }
}
