import ID from "./ebml-ids";
import EBML from "./EBML";

const EBML_HEADER = new EBML(ID.EBML, {
  children: [
    new EBML(ID.EBMLVersion, { contents: [1] }),
    new EBML(ID.EBMLReadVersion, { contents: [1] }),
    new EBML(ID.EBMLMaxIDLength, { contents: [4] }),
    new EBML(ID.EBMLMaxSizeLength, { contents: [8] }),
    new EBML(ID.DocType, { contents: EBML.stringToByteArray("webm") }),
    new EBML(ID.DocTypeVersion, { contents: [4] }),
    new EBML(ID.DocTypeReadVersion, { contents: [2] }),
  ],
}).contents;

export default class WEBMWrapper {
  constructor(codec) {
    switch (codec) {
      case "opus": {
        this._codecId = "A_OPUS";
        this._getCodecSpecificTrack = () => [
          new EBML(ID.CodecDelay, { contents: [0x63, 0x2e, 0xa0] }), // OPUS codec delay
          new EBML(ID.SeekPreRoll, { contents: [0x04, 0xc4, 0xb4, 0x00] }), // OPUS codec delay
        ];
        this._getCodecPrivate = (header) =>
          new EBML(ID.CodecPrivate, { contents: [...header.bytes] }); // OpusHead bytes
        break;
      }
      case "vorbis": {
        this._codecId = "A_VORBIS";
        this._getCodecSpecificTrack = () => {};
        break;
      }
    }

    this._timestamp = 0;
  }

  getInitializationSegment(header) {
    const segment = new EBML(ID.Segment, {
      isUnknownLength: true,
      children: [
        new EBML(ID.Info, {
          children: [
            new EBML(ID.TimecodeScale, {
              contents: [0x0f, 0x42, 0x40],
            }),
            new EBML(ID.MuxingApp, {
              contents: EBML.stringToByteArray("isobmff-audio"),
            }),
            new EBML(ID.WritingApp, {
              contents: EBML.stringToByteArray("isobmff-audio"),
            }),
          ],
        }),
        new EBML(ID.Tracks, {
          children: [
            new EBML(ID.TrackEntry, {
              children: [
                new EBML(ID.TrackNumber, { contents: [1] }),
                new EBML(ID.TrackUID, { contents: [1] }),
                new EBML(ID.FlagLacing, { contents: [0] }),
                new EBML(ID.CodecID, {
                  contents: EBML.stringToByteArray(this._codecId),
                }),
                ...this._getCodecSpecificTrack(header),
                new EBML(ID.TrackType, { contents: [2] }), // audio
                new EBML(ID.Audio, {
                  children: [
                    new EBML(ID.Channels, { contents: [header.channels] }),
                    new EBML(ID.SamplingFrequency, {
                      contents: [...EBML.getFloat64(header.sampleRate)],
                    }),
                    new EBML(ID.BitDepth, { contents: [header.bitDepth] }),
                  ],
                }),
                this._getCodecPrivate(header),
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
    let blockTimestamp = 0;

    const cluster = new EBML(ID.Cluster, {
      children: [
        new EBML(ID.Timecode, {
          contents: [...EBML.getVint(this._timestamp)], // Absolute timecode of the cluster
        }),
        ...frames.map(({ data, header }) => {
          const block = new EBML(ID.SimpleBlock, {
            contents: [
              0x81, // track number
              ...EBML.getInt16(blockTimestamp), // timestamp relative to cluster Int16
              0b10000000, // No lacing
              ...data, // ogg page contents
            ],
          });
          blockTimestamp += header.packet.config.frameSize;

          return block;
        }),
      ],
    }).contents;

    this._timestamp += blockTimestamp;

    const data = new Uint8Array(cluster.length);
    data.set(cluster);

    return data;
  }
}
