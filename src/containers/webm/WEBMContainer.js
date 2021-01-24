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
import EBML, { id } from "./EBML";

export default class WEBMContainer {
  constructor(codec) {
    switch (codec) {
      case "opus": {
        this._codecId = "A_OPUS";
        this._getCodecSpecificTrack = (header) => [
          new EBML(id.CodecDelay, {
            contents: EBML.getUint32(
              this._getTimecode(header.preSkip) * this._timecodeScale
            ),
          }), // OPUS codec delay
          new EBML(id.SeekPreRoll, {
            contents: EBML.getUint32(
              this._getTimecode(3840) * this._timecodeScale
            ),
          }), // OPUS seek preroll 80ms
          new EBML(id.CodecPrivate, { contents: header.bytes }), // OpusHead bytes
        ];
        break;
      }
      case "vorbis": {
        this._codecId = "A_VORBIS";
        this._getCodecSpecificTrack = (header) => [
          new EBML(id.CodecPrivate, {
            contents: [
              0x02, // number of packets
              header.codecPrivate.lacing,
              header.codecPrivate.vorbisHead,
              header.codecPrivate.vorbisSetup,
            ],
          }),
        ];
        break;
      }
    }

    this._sampleNumber = 0;
  }

  _getTimecode(sampleNumber) {
    return (sampleNumber / this._sampleRate) * 1000;
  }

  getInitializationSegment(header) {
    this._sampleRate = header.sampleRate;

    return new ContainerElement({
      children: [
        new EBML(id.EBML, {
          children: [
            new EBML(id.EBMLVersion, { contents: 1 }),
            new EBML(id.EBMLReadVersion, { contents: 1 }),
            new EBML(id.EBMLMaxIDLength, { contents: 4 }),
            new EBML(id.EBMLMaxSizeLength, { contents: 8 }),
            new EBML(id.DocType, { contents: EBML.stringToByteArray("webm") }),
            new EBML(id.DocTypeVersion, { contents: 4 }),
            new EBML(id.DocTypeReadVersion, { contents: 2 }),
          ],
        }),
        new EBML(id.Segment, {
          isUnknownLength: true,
          children: [
            new EBML(id.Info, {
              children: [
                new EBML(id.TimecodeScale, {
                  contents: EBML.getUint32(1000000),
                }),
                new EBML(id.MuxingApp, {
                  contents: EBML.stringToByteArray("mse-audio-wrapper"),
                }),
                new EBML(id.WritingApp, {
                  contents: EBML.stringToByteArray("mse-audio-wrapper"),
                }),
              ],
            }),
            new EBML(id.Tracks, {
              children: [
                new EBML(id.TrackEntry, {
                  children: [
                    new EBML(id.TrackNumber, { contents: 0x01 }),
                    new EBML(id.TrackUID, { contents: 0x01 }),
                    new EBML(id.FlagLacing, { contents: 0x00 }),
                    new EBML(id.CodecID, {
                      contents: EBML.stringToByteArray(this._codecId),
                    }),
                    new EBML(id.TrackType, { contents: 0x02 }), // audio
                    new EBML(id.Audio, {
                      children: [
                        new EBML(id.Channels, { contents: header.channels }),
                        new EBML(id.SamplingFrequency, {
                          contents: EBML.getFloat64(header.sampleRate),
                        }),
                        new EBML(id.BitDepth, { contents: header.bitDepth }),
                      ],
                    }),
                    ...this._getCodecSpecificTrack(header),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }).contents;
  }

  getMediaSegment(frames) {
    let blockSamples = 0;

    const cluster = new EBML(id.Cluster, {
      children: [
        new EBML(id.Timecode, {
          contents: EBML.getUintVariable(
            Math.round(this._getTimecode(this._sampleNumber))
          ), // Absolute timecode of the cluster
        }),
        ...frames.map(
          ({ data, header }) =>
            new EBML(id.SimpleBlock, {
              contents: [
                0x81, // track number
                EBML.getInt16(
                  Math.round(
                    this._getTimecode(
                      blockSamples,
                      void (blockSamples += header.samplesPerFrame)
                    )
                  )
                ), // timestamp relative to cluster Int16
                0x80, // No lacing
                data, // ogg page contents
              ],
            })
        ),
      ],
    });

    this._sampleNumber += blockSamples;

    return cluster.contents;
  }
}
