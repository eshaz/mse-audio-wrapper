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
          new EBML(id.CodecDelay, { contents: [0x63, 0x2e, 0xa0] }), // OPUS codec delay
          new EBML(id.SeekPreRoll, { contents: [0x04, 0xc4, 0xb4, 0x00] }), // OPUS seek preroll
          new EBML(id.CodecPrivate, { contents: [...header.bytes] }), // OpusHead bytes
        ];
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
        break;
      }
    }

    this._sampleNumber = 0;
    this._timecodeGranularity = 1000000000;
  }

  calcTimecode(sampleNumber) {
    return Math.round(
      Math.round(
        (this._timecodeGranularity * sampleNumber) / this._sampleRate
      ) / this._timecodeScale
    );
  }

  getInitializationSegment(header) {
    this._sampleRate = header.sampleRate;
    this._timecodeScale = Math.floor(
      this._timecodeGranularity / header.sampleRate
    );

    const segment = new EBML(id.Segment, {
      isUnknownLength: true,
      children: [
        new EBML(id.Info, {
          children: [
            new EBML(id.TimecodeScale, {
              contents: [...EBML.getUint32(this._timecodeScale)], //[0x0f, 0x42, 0x40],
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
            ...EBML.getUintVariable(this.calcTimecode(this._sampleNumber)),
          ], // Absolute timecode of the cluster
        }),
        ...frames.map(({ data, header }) => {
          const block = new EBML(id.SimpleBlock, {
            contents: [
              0x81, // track number
              ...EBML.getInt16(this.calcTimecode(blockSamples)), // timestamp relative to cluster Int16
              0x80, // No lacing
              ...data, // ogg page contents
            ],
          });

          blockSamples += header.samplesPerFrame;

          return block;
        }),
      ],
    }).contents;

    this._sampleNumber += blockSamples;

    const data = new Uint8Array(cluster.length);
    data.set(cluster);

    return data;
  }
}
