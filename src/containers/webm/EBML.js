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

import { logError } from "../../utilities";
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
  static getUintVariable(number) {
    let buffer;

    if (number < 0x7f) {
      buffer = [0b10000000 | number];
    } else if (number < 0x3fff) {
      buffer = ContainerElement.getUint16(number);
      buffer[0] |= 0b01000000;
    } else if (number < 0x1fffff) {
      buffer = ContainerElement.getUint32(number).subarray(1);
      buffer[0] |= 0b00100000;
    } else if (number < 0xfffffff) {
      buffer = ContainerElement.getUint32(number);
      buffer[0] |= 0b00010000;
    } else if (number < 0x7ffffffff) {
      buffer = ContainerElement.getUint64(number).subarray(3);
      buffer[0] |= 0b00001000;
    } else if (number < 0x3ffffffffff) {
      buffer = ContainerElement.getUint64(number).subarray(2);
      buffer[0] |= 0b00000100;
    } else if (number < 0x1ffffffffffff) {
      buffer = ContainerElement.getUint64(number).subarray(1);
      buffer[0] |= 0b00000010;
    } else if (number < 0xffffffffffffff) {
      buffer = ContainerElement.getUint64(number);
      buffer[0] |= 0b00000001;
    } else if (typeof number !== "number" || isNaN(number)) {
      logError(
        `EBML Variable integer must be a number, instead received ${number}`
      );
      throw new Error("mse-audio-wrapper: Unable to encode WEBM");
    }

    return buffer;
  }

  /**
   * @returns {number} Total length of this object and all contents
   */
  get length() {
    const length = super.length;

    return length + EBML.getUintVariable(length).length;
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
          : [...EBML.getUintVariable(contents.length)]
      )
      .concat(contents);
  }
}

// https://tools.ietf.org/id/draft-lhomme-cellar-matroska-00.html
export const id = {
  AlphaMode: [0x53, 0xc0],
  AspectRatioType: [0x54, 0xb3],
  AttachedFile: [0x61, 0xa7],
  AttachmentLink: [0x74, 0x46],
  Attachments: [0x19, 0x41, 0xa4, 0x69],
  Audio: [0xe1],
  BitDepth: [0x62, 0x64],
  BitsPerChannel: [0x55, 0xb2],
  Block: [0xa1],
  BlockAddID: [0xee],
  BlockAdditional: [0xa5],
  BlockAdditions: [0x75, 0xa1],
  BlockDuration: [0x9b],
  BlockGroup: [0xa0],
  BlockMore: [0xa6],
  CbSubsamplingHorz: [0x55, 0xb5],
  CbSubsamplingVert: [0x55, 0xb6],
  Channels: [0x9f],
  ChapCountry: [0x43, 0x7e],
  ChapLanguage: [0x43, 0x7c],
  ChapProcess: [0x69, 0x44],
  ChapProcessCodecID: [0x69, 0x55],
  ChapProcessCommand: [0x69, 0x11],
  ChapProcessData: [0x69, 0x33],
  ChapProcessPrivate: [0x45, 0x0d],
  ChapProcessTime: [0x69, 0x22],
  ChapString: [0x85],
  ChapterAtom: [0xb6],
  ChapterDisplay: [0x80],
  ChapterFlagEnabled: [0x45, 0x98],
  ChapterFlagHidden: [0x98],
  ChapterPhysicalEquiv: [0x63, 0xc3],
  Chapters: [0x10, 0x43, 0xa7, 0x70],
  ChapterSegmentEditionUID: [0x6e, 0xbc],
  ChapterSegmentUID: [0x6e, 0x67],
  ChapterStringUID: [0x56, 0x54],
  ChapterTimeEnd: [0x92],
  ChapterTimeStart: [0x91],
  ChapterTrack: [0x8f],
  ChapterTrackNumber: [0x89],
  ChapterTranslate: [0x69, 0x24],
  ChapterTranslateCodec: [0x69, 0xbf],
  ChapterTranslateEditionUID: [0x69, 0xfc],
  ChapterTranslateID: [0x69, 0xa5],
  ChapterUID: [0x73, 0xc4],
  ChromaSitingHorz: [0x55, 0xb7],
  ChromaSitingVert: [0x55, 0xb8],
  ChromaSubsamplingHorz: [0x55, 0xb3],
  ChromaSubsamplingVert: [0x55, 0xb4],
  Cluster: [0x1f, 0x43, 0xb6, 0x75],
  CodecDecodeAll: [0xaa],
  CodecDelay: [0x56, 0xaa],
  CodecID: [0x86],
  CodecName: [0x25, 0x86, 0x88],
  CodecPrivate: [0x63, 0xa2],
  CodecState: [0xa4],
  Colour: [0x55, 0xb0],
  ColourSpace: [0x2e, 0xb5, 0x24],
  ContentCompAlgo: [0x42, 0x54],
  ContentCompression: [0x50, 0x34],
  ContentCompSettings: [0x42, 0x55],
  ContentEncAlgo: [0x47, 0xe1],
  ContentEncKeyID: [0x47, 0xe2],
  ContentEncoding: [0x62, 0x40],
  ContentEncodingOrder: [0x50, 0x31],
  ContentEncodings: [0x6d, 0x80],
  ContentEncodingScope: [0x50, 0x32],
  ContentEncodingType: [0x50, 0x33],
  ContentEncryption: [0x50, 0x35],
  ContentSigAlgo: [0x47, 0xe5],
  ContentSigHashAlgo: [0x47, 0xe6],
  ContentSigKeyID: [0x47, 0xe4],
  ContentSignature: [0x47, 0xe3],
  CRC32: [0xbf],
  CueBlockNumber: [0x53, 0x78],
  CueClusterPosition: [0xf1],
  CueCodecState: [0xea],
  CueDuration: [0xb2],
  CuePoint: [0xbb],
  CueReference: [0xdb],
  CueRefTime: [0x96],
  CueRelativePosition: [0xf0],
  Cues: [0x1c, 0x53, 0xbb, 0x6b],
  CueTime: [0xb3],
  CueTrack: [0xf7],
  CueTrackPositions: [0xb7],
  DateUTC: [0x44, 0x61],
  DefaultDecodedFieldDuration: [0x23, 0x4e, 0x7a],
  DefaultDuration: [0x23, 0xe3, 0x83],
  DiscardPadding: [0x75, 0xa2],
  DisplayHeight: [0x54, 0xba],
  DisplayUnit: [0x54, 0xb2],
  DisplayWidth: [0x54, 0xb0],
  DocType: [0x42, 0x82],
  DocTypeReadVersion: [0x42, 0x85],
  DocTypeVersion: [0x42, 0x87],
  Duration: [0x44, 0x89],
  EBML: [0x1a, 0x45, 0xdf, 0xa3],
  EBMLMaxIDLength: [0x42, 0xf2],
  EBMLMaxSizeLength: [0x42, 0xf3],
  EBMLReadVersion: [0x42, 0xf7],
  EBMLVersion: [0x42, 0x86],
  EditionEntry: [0x45, 0xb9],
  EditionFlagDefault: [0x45, 0xdb],
  EditionFlagHidden: [0x45, 0xbd],
  EditionFlagOrdered: [0x45, 0xdd],
  EditionUID: [0x45, 0xbc],
  FieldOrder: [0x9d],
  FileData: [0x46, 0x5c],
  FileDescription: [0x46, 0x7e],
  FileMimeType: [0x46, 0x60],
  FileName: [0x46, 0x6e],
  FileUID: [0x46, 0xae],
  FlagDefault: [0x88],
  FlagEnabled: [0xb9],
  FlagForced: [0x55, 0xaa],
  FlagInterlaced: [0x9a],
  FlagLacing: [0x9c],
  Info: [0x15, 0x49, 0xa9, 0x66],
  LaceNumber: [0xcc],
  Language: [0x22, 0xb5, 0x9c],
  LuminanceMax: [0x55, 0xd9],
  LuminanceMin: [0x55, 0xda],
  MasteringMetadata: [0x55, 0xd0],
  MatrixCoefficients: [0x55, 0xb1],
  MaxBlockAdditionID: [0x55, 0xee],
  MaxCache: [0x6d, 0xf8],
  MaxCLL: [0x55, 0xbc],
  MaxFALL: [0x55, 0xbd],
  MinCache: [0x6d, 0xe7],
  MuxingApp: [0x4d, 0x80],
  Name: [0x53, 0x6e],
  NextFilename: [0x3e, 0x83, 0xbb],
  NextUID: [0x3e, 0xb9, 0x23],
  OutputSamplingFrequency: [0x78, 0xb5],
  PixelCropBottom: [0x54, 0xaa],
  PixelCropLeft: [0x54, 0xcc],
  PixelCropRight: [0x54, 0xdd],
  PixelCropTop: [0x54, 0xbb],
  PixelHeight: [0xba],
  PixelWidth: [0xb0],
  Position: [0xa7],
  PrevFilename: [0x3c, 0x83, 0xab],
  PrevSize: [0xab],
  PrevUID: [0x3c, 0xb9, 0x23],
  Primaries: [0x55, 0xbb],
  PrimaryBChromaticityX: [0x55, 0xd5],
  PrimaryBChromaticityY: [0x55, 0xd6],
  PrimaryGChromaticityX: [0x55, 0xd3],
  PrimaryGChromaticityY: [0x55, 0xd4],
  PrimaryRChromaticityX: [0x55, 0xd1],
  PrimaryRChromaticityY: [0x55, 0xd2],
  Range: [0x55, 0xb9],
  ReferenceBlock: [0xfb],
  ReferencePriority: [0xfa],
  SamplingFrequency: [0xb5],
  Seek: [0x4d, 0xbb],
  SeekHead: [0x11, 0x4d, 0x9b, 0x74],
  SeekID: [0x53, 0xab],
  SeekPosition: [0x53, 0xac],
  SeekPreRoll: [0x56, 0xbb],
  Segment: [0x18, 0x53, 0x80, 0x67],
  SegmentFamily: [0x44, 0x44],
  SegmentFilename: [0x73, 0x84],
  SegmentUID: [0x73, 0xa4],
  SilentTrackNumber: [0x58, 0xd7],
  SilentTracks: [0x58, 0x54],
  SimpleBlock: [0xa3],
  SimpleTag: [0x67, 0xc8],
  Slices: [0x8e],
  StereoMode: [0x53, 0xb8],
  Tag: [0x73, 0x73],
  TagAttachmentUID: [0x63, 0xc6],
  TagBinary: [0x44, 0x85],
  TagChapterUID: [0x63, 0xc4],
  TagDefault: [0x44, 0x84],
  TagEditionUID: [0x63, 0xc9],
  TagLanguage: [0x44, 0x7a],
  TagName: [0x45, 0xa3],
  Tags: [0x12, 0x54, 0xc3, 0x67],
  TagString: [0x44, 0x87],
  TagTrackUID: [0x63, 0xc5],
  Targets: [0x63, 0xc0],
  TargetType: [0x63, 0xca],
  TargetTypeValue: [0x68, 0xca],
  Timecode: [0xe7],
  TimecodeScale: [0x2a, 0xd7, 0xb1],
  TimeSlice: [0xe8],
  Title: [0x7b, 0xa9],
  TrackCombinePlanes: [0xe3],
  TrackEntry: [0xae],
  TrackJoinBlocks: [0xe9],
  TrackJoinUID: [0xed],
  TrackNumber: [0xd7],
  TrackOperation: [0xe2],
  TrackOverlay: [0x6f, 0xab],
  TrackPlane: [0xe4],
  TrackPlaneType: [0xe6],
  TrackPlaneUID: [0xe5],
  Tracks: [0x16, 0x54, 0xae, 0x6b],
  TrackTranslate: [0x66, 0x24],
  TrackTranslateCodec: [0x66, 0xbf],
  TrackTranslateEditionUID: [0x66, 0xfc],
  TrackTranslateTrackID: [0x66, 0xa5],
  TrackType: [0x83],
  TrackUID: [0x73, 0xc5],
  TransferCharacteristics: [0x55, 0xba],
  Video: [0xe0],
  Void: [0xec],
  WhitePointChromaticityX: [0x55, 0xd7],
  WhitePointChromaticityY: [0x55, 0xd8],
  WritingApp: [0x57, 0x41],
};
