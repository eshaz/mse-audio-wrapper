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

/*
https://xiph.org/ogg/doc/framing.html

AAAAAAAA AAAAAAAA AAAAAAAA AAAAAAAA BBBBBBBB 00000CDE

(LSB)                                                             (MSB)
FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF
GGGGGGGG GGGGGGGG GGGGGGGG GGGGGGGG
HHHHHHHH HHHHHHHH HHHHHHHH HHHHHHHH
IIIIIIII IIIIIIII IIIIIIII IIIIIIII

JJJJJJJJ
LLLLLLLL...

OGG Page Header
Letter 	Length (bits) 	Description
A 	32 	0x4f676753, "OggS"
B 	8 	stream_structure_version
C 	1 	(0 no, 1 yes) continued packet
D 	1 	(0 no, 1 yes) first page of logical bitstream (bos)
E 	1 	(0 no, 1 yes) last page of logical bitstream (eos)

F 	64 	absolute granule position
        Sample Count??
G   32  stream serial number
H   32  page sequence no
I   32  page checksum
J   8   Number of page segments in the segment table
L   n   Segment table (n=page_segments+26).
        Segment table values sum to the total length of the packet.
        Last value is always < 0xFF. Last lacing value will be 0x00 if evenly divisible by 0xFF.
        
*/

const OggS = 0x4f676753;

export default class OGGPageHeader {
  static getHeader(buffer) {
    const header = {};

    // Must be at least 28 bytes.
    if (buffer.length < 28) return new OGGPageHeader(header, false);

    let headerBytes = [];
    for (let i = 0; i < 28; i++) {
      headerBytes.push(buffer[i]);
    }
    const view = new DataView(Uint8Array.from(headerBytes).buffer);

    // Bytes (1-4 of 28)
    // Frame sync (must equal OggS): `AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA`:
    if (view.getUint32(0) !== OggS) {
      return null;
    }

    // Byte (5 of 28)
    // * `BBBBBBBB`: stream_structure_version
    header.streamStructureVersion = buffer[4];

    // Byte (6 of 28)
    // * `00000CDE`
    // * `00000...`: All zeros
    // * `.....C..`: (0 no, 1 yes) continued packet
    // * `......D.`: (0 no, 1 yes) first page of logical bitstream (bos)
    // * `.......E`: (0 no, 1 yes) last page of logical bitstream (eos)
    const zeros = buffer[5] & 0b11111000;
    const continuePacketBit = buffer[5] & 0b00000100;
    const firstPageBit = buffer[5] & 0b00000010;
    const lastPageBit = buffer[5] & 0b00000001;

    if (zeros) return null;
    header.isContinuedPacket = !!(continuePacketBit >> 2);
    header.isFirstPage = !!(firstPageBit >> 1);
    header.isLastPage = !!lastPageBit;

    // Byte (7-14 of 28)
    // * `FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF`
    // * Absolute Granule Position
    header.absoluteGranulePosition = view.getBigInt64(6, true);

    // Byte (15-18 of 28)
    // * `GGGGGGGG|GGGGGGGG|GGGGGGGG|GGGGGGGG`
    // * Stream Serial Number
    header.streamSerialNumber = view.getInt32(14, true);

    // Byte (19-22 of 28)
    // * `HHHHHHHH|HHHHHHHH|HHHHHHHH|HHHHHHHH`
    // * Page Sequence Number
    header.pageSequenceNumber = view.getInt32(18, true);

    // Byte (23-26 of 28)
    // * `IIIIIIII|IIIIIIII|IIIIIIII|IIIIIIII`
    // * Page Checksum
    header.pageChecksum = view.getInt32(22, true);

    // Byte (27 of 28)
    // * `JJJJJJJJ`: Number of page segments in the segment table
    const pageSegmentTableLength = buffer[26];
    header.length = pageSegmentTableLength + 27;

    if (header.length > buffer.length) return new OGGPageHeader(header, false); // out of data

    header.dataByteLength = 0;
    header.pageSegmentTable = [];
    header.pageSegmentBytes = buffer.subarray(27, header.length);

    let segmentLength = 0;

    for (const segmentByte of header.pageSegmentBytes) {
      header.dataByteLength += segmentByte;
      segmentLength += segmentByte;

      if (segmentByte !== 0xff) {
        header.pageSegmentTable.push(segmentLength);
        segmentLength = 0;
      }
    }

    return new OGGPageHeader(header, true);
  }

  /**
   * @private
   * Call OGGPageHeader.getHeader(Array<Uint8>) to get instance
   */
  constructor(header, isParsed) {
    this._isParsed = isParsed;
    this._absoluteGranulePosition = header.absoluteGranulePosition;
    this._dataByteLength = header.dataByteLength;
    this._isContinuedPacket = header.isContinuedPacket;
    this._isFirstPage = header.isFirstPage;
    this._isLastPage = header.isLastPage;
    this._length = header.length;
    this._pageSegmentBytes = header.pageSegmentBytes;
    this._pageSegmentTable = header.pageSegmentTable;
    this._pageSequenceNumber = header.pageSequenceNumber;
    this._pageChecksum = header.pageChecksum;
    this._streamSerialNumber = header.streamSerialNumber;
  }

  get isParsed() {
    return this._isParsed;
  }

  get absoluteGranulePosition() {
    return this._absoluteGranulePosition;
  }

  get dataByteLength() {
    return this._dataByteLength;
  }

  get pageSegmentTable() {
    return this._pageSegmentTable;
  }

  get pageSegmentBytes() {
    return this._pageSegmentBytes;
  }

  get pageSequenceNumber() {
    return this._pageSequenceNumber;
  }

  get length() {
    return this._length;
  }
}
