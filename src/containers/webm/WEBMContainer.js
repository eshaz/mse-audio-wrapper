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

import ContainerElement from "../ContainerElement.js";
import EBML, { id } from "./EBML.js";
import { xiphLacing } from "../../utilities.js";

export default class WEBMContainer {
  constructor(codec) {
    switch (codec) {
      case "opus": {
        this._codecId = "A_OPUS";
        this._getCodecSpecificTrack = (header) => [
          new EBML(id.CodecDelay, {
            contents: EBML.getUint32(
              Math.round(header.preSkip * this._timestampScale)
            ),
          }), // OPUS codec delay
          new EBML(id.SeekPreRoll, {
            contents: EBML.getUint32(Math.round(3840 * this._timestampScale)),
          }), // OPUS seek preroll 80ms
          new EBML(id.CodecPrivate, { contents: header.data }), // OpusHead bytes
        ];
        break;
      }
      case "vorbis": {
        this._codecId = "A_VORBIS";
        this._getCodecSpecificTrack = (header) => [
          new EBML(id.CodecPrivate, {
            contents: [
              0x02, // number of packets
              xiphLacing(header.data, header.vorbisComments),
              header.data,
              header.vorbisComments,
              header.vorbisSetup,
            ],
          }),
        ];
        break;
      }
    }
  }

  getInitializationSegment({ header }) {
    this._timestampScale = 1000000000 / header.sampleRate;

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
                new EBML(id.TimestampScale, {
                  contents: EBML.getUint32(
                    Math.floor(this._timestampScale) // Base timestamps on sample rate vs. milliseconds https://www.matroska.org/technical/notes.html#timestamps
                  ),
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
    const offsetSamples = frames[0].totalSamples;

    return new EBML(id.Cluster, {
      children: [
        new EBML(id.Timestamp, {
          contents: EBML.getUintVariable(offsetSamples), // Absolute timecode of the cluster
        }),
        ...frames.map(
          ({ data, totalSamples }) =>
            new EBML(id.SimpleBlock, {
              contents: [
                0x81, // track number
                EBML.getInt16(totalSamples - offsetSamples), // timestamp relative to cluster Int16
                0x80, // No lacing
                data, // ogg page contents
              ],
            })
        ),
      ],
    }).contents;
  }
}
