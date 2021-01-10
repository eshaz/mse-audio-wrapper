const EBML = require("simple-ebml-builder");

const EBML_HEADER = EBML.build(
  EBML.element(EBML.ID.EBML, [
    EBML.element(EBML.ID.EBMLVersion, EBML.number(1)),
    EBML.element(EBML.ID.EBMLReadVersion, EBML.number(1)),
    EBML.element(EBML.ID.EBMLMaxIDLength, EBML.number(4)),
    EBML.element(EBML.ID.EBMLMaxSizeLength, EBML.number(8)),
    EBML.element(EBML.ID.DocType, EBML.string("webm")),
    EBML.element(EBML.ID.DocTypeVersion, EBML.number(4)),
    EBML.element(EBML.ID.DocTypeReadVersion, EBML.number(2)),
  ])
);

class WEBMWrapper {
  constructor(codec) {
    switch (codec) {
      case "opus": {
        this._codecId = "A_OPUS";
        this._getCodecSpecificTrack = (header) => [
          EBML.element(EBML.ID.CodecDelay, EBML.number(0x632ea0)), // OPUS codec delay
          EBML.element(EBML.ID.SeekPreRoll, EBML.number(0x4c4b400)), // OPUS codec delay
        ];
        this._getCodecPrivate = (header) =>
          EBML.element(EBML.ID.CodecPrivate, EBML.bytes(header.bytes)); // OpusHead bytes
        break;
      }
      case "vorbis": {
        this._codecId = "A_VORBIS";
        this._getCodecSpecificTrack = () => {};
        break;
      }
    }

    this._timestamp = 0x18621d;
  }

  getInitializationSegment(header) {
    const segment = EBML.build(
      EBML.unknownSizeElement(EBML.ID.Segment, [
        EBML.element(EBML.ID.Info, [
          EBML.element(EBML.ID.TimecodeScale, EBML.number(1000000)), // timescale
          EBML.element(EBML.ID.Title, EBML.string("WAUG EDM Fest Spring 2015")),
          EBML.element(EBML.ID.MuxingApp, EBML.string("Lavf58.29.100")),
          EBML.element(EBML.ID.WritingApp, EBML.string("Lavf58.29.100")),
          // prettier-ignore
          EBML.bytes([0xEC, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00]), //void
        ]),
        EBML.element(
          EBML.ID.Tracks,
          EBML.element(EBML.ID.TrackEntry, [
            EBML.element(EBML.ID.TrackNumber, EBML.number(1)),
            EBML.element(EBML.ID.TrackUID, EBML.number(1)),
            EBML.element(EBML.ID.FlagLacing, EBML.bytes([0x00])),
            EBML.element(EBML.ID.Language, EBML.string("und")),
            EBML.element(EBML.ID.CodecID, EBML.string(this._codecId)),
            ...this._getCodecSpecificTrack(header),
            EBML.element(EBML.ID.TrackType, EBML.number(2)), // audio
            EBML.element(EBML.ID.Audio, [
              EBML.element(EBML.ID.Channels, EBML.number(header.channels)),
              // prettier-ignore
              EBML.bytes([0xb5,0x88,0x40,0xe7,0x70,0x00,0x00,0x00,0x00,0x00]), // SamplingFrequency
              EBML.element(EBML.ID.BitDepth, EBML.number(header.bitDepth)),
            ]),
            this._getCodecPrivate(header),
          ])
        ),
      ])
    );

    const buffer = new Uint8Array(EBML_HEADER.length + segment.length);
    buffer.set(EBML_HEADER);
    buffer.set(segment, EBML_HEADER.length);

    return buffer;
  }

  static concatBuffers(buffers) {
    const length = buffers.reduce((acc, val) => acc + val.length, 0);
    const buf = new Uint8Array(length);
    let offset = 0;

    for (const buffer of buffers) {
      buf.set(buffer, offset);
      offset += buffer.length;
    }

    return buf;
  }

  getMediaSegment(frames) {
    let blockTimestamp = 0;

    const cluster = EBML.build(
      EBML.element(EBML.ID.Cluster, [
        EBML.element(EBML.ID.Timecode, EBML.number(this._timestamp)), // Absolute timecode of the cluster
        ...frames.map(({ data, header }) => {
          const block = EBML.element(EBML.ID.SimpleBlock, [
            EBML.bytes([0x81]), // track number
            EBML.bytes(WEBMWrapper.getInt16(blockTimestamp)), // timestamp relative to cluster Int16
            EBML.bytes([0b10000000]), // No lacing
            EBML.bytes(data), // ogg page contents
          ]);
          blockTimestamp += header.packet.config.frameSize;

          return block;
        }),
      ])
    );

    this._timestamp += blockTimestamp;
    return cluster;
  }

  static getInt16(number) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setInt16(0, number);
    return bytes;
  }
}

module.exports = WEBMWrapper;
