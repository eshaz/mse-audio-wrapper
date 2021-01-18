import EBML, { id } from "./EBML";

const EBML_HEADER = new EBML(id.EBML, {
  children: [
    new EBML(id.EBMLVersion, { contents: [1] }),
    new EBML(id.EBMLReadVersion, { contents: [1] }),
    new EBML(id.EBMLMaxIDLength, { contents: [4] }),
    new EBML(id.EBMLMaxSizeLength, { contents: [8] }),
    new EBML(id.DocType, { contents: EBML.stringToByteArray("webm") }),
    new EBML(id.DocTypeVersion, { contents: [4] }),
    new EBML(id.DocTypeReadVersion, { contents: [2] }),
  ],
}).contents;

export default class WEBMContainer {
  constructor(codec) {
    switch (codec) {
      case "opus": {
        this._codecId = "A_OPUS";
        this._getCodecSpecificTrack = (header) => [
          new EBML(id.CodecDelay, {
            contents: [
              ...EBML.getUint32(
                this._getTimecode(header.preSkip) * this._timecodeScale
              ),
            ],
          }), // OPUS codec delay
          new EBML(id.SeekPreRoll, {
            contents: [
              ...EBML.getUint32(this._getTimecode(3840) * this._timecodeScale),
            ],
          }), // OPUS seek preroll 80ms
          new EBML(id.CodecPrivate, { contents: [...header.bytes] }), // OpusHead bytes
        ];
        this._getTimecode = (sampleNumber) =>
          (sampleNumber / this._sampleRate) * 1000;
        this._getTimecodeScale = () => 1000000;
        break;
      }
      case "vorbis": {
        this._codecId = "A_VORBIS";
        this._getCodecSpecificTrack = (header) => [
          new EBML(id.CodecPrivate, {
            contents: [
              0x02, // number of packets
              ...header.codecPrivate.lacing,
              ...header.codecPrivate.vorbisHead,
              ...header.codecPrivate.vorbisSetup,
            ],
          }),
        ];
        this._getTimecode = (sampleNumber) =>
          Math.round((1000000000 * sampleNumber) / this._sampleRate) /
          this._timecodeScale;
        this._getTimecodeScale = () =>
          Math.floor(1000000000 / this._sampleRate);
        break;
      }
    }

    this._sampleNumber = 0;
  }

  getInitializationSegment(header) {
    this._sampleRate = header.sampleRate;
    this._timecodeScale = this._getTimecodeScale();

    const segment = new EBML(id.Segment, {
      isUnknownLength: true,
      children: [
        new EBML(id.Info, {
          children: [
            new EBML(id.TimecodeScale, {
              contents: [...EBML.getUint32(this._timecodeScale)],
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
                new EBML(id.TrackNumber, { contents: [0x01] }),
                new EBML(id.TrackUID, { contents: [0x01] }),
                new EBML(id.FlagLacing, { contents: [0x00] }),
                new EBML(id.CodecID, {
                  contents: EBML.stringToByteArray(this._codecId),
                }),
                new EBML(id.TrackType, { contents: [0x02] }), // audio
                new EBML(id.Audio, {
                  children: [
                    new EBML(id.Channels, { contents: [header.channels] }),
                    new EBML(id.SamplingFrequency, {
                      contents: [...EBML.getFloat64(header.sampleRate)],
                    }),
                    new EBML(id.BitDepth, { contents: [header.bitDepth] }),
                  ],
                }),
                ...this._getCodecSpecificTrack(header),
              ],
            }),
          ],
        }),
      ],
    }).contents;

    const buffer = new Uint8Array(EBML_HEADER.length + segment.length);
    buffer.set(EBML_HEADER);
    buffer.set(segment, EBML_HEADER.length);

    return buffer;
  }

  getMediaSegment(frames) {
    let blockSamples = 0;

    const cluster = new EBML(id.Cluster, {
      children: [
        new EBML(id.Timecode, {
          contents: [
            ...EBML.getUintVariable(
              Math.round(this._getTimecode(this._sampleNumber))
            ),
          ], // Absolute timecode of the cluster
        }),
        ...frames.map(
          ({ data, header }) =>
            new EBML(id.SimpleBlock, {
              contents: [
                0x81, // track number
                ...EBML.getInt16(
                  Math.round(
                    this._getTimecode(
                      blockSamples,
                      void (blockSamples += header.samplesPerFrame)
                    )
                  )
                ), // timestamp relative to cluster Int16
                0x80, // No lacing
                ...data, // ogg page contents
              ],
            })
        ),
      ],
    }).contents;

    this._sampleNumber += blockSamples;

    const data = new Uint8Array(cluster.length);
    data.set(cluster);

    return data;
  }
}
