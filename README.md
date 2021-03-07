# MSE (Media Source Extensions) Audio Wrapper

`mse-audio-wrapper` is a library to enable Media Source Extensions API playback for unsupported audio containers and raw codecs. MSE Audio Wrapper uses both WEBM and the ISO Base Media File Format (MPEG-4 Part 12) (commonly referred to as Fragmented MP4 or fmp4).

 * [**API**](#mse-audio-wrapper)
   * [**MSEAudioWrapper**](#MSEAudioWrapper)
     * Takes in audio (MP3, AAC, Ogg Flac, Ogg Opus, Ogg Vorbis)
     * Outputs
       * ISOBMFF (fMP4) (MP3, AAC, Flac, Opus)
       * WEBM (Opus, Vorbis)
 * [**Demo**](#demo)
   * React application that demonstrates MSEAudioWrapper being used to support `icecast-metadata-js`
   * Checkout the demo [here](https://eshaz.github.io/icecast-metadata-js/)!

---

# API

## [`MSEAudioWrapper`](https://github.com/eshaz/mse-audio-wrapper/tree/master/src/MSEAudioWrapper.js)

A class that takes in audio (MP3, AAC, Ogg Flac, Ogg Opus, or Ogg Vorbis) and outputs ISOBMFF or WEBM.

### Usage

1. To use `MSEAudioWrapper`, create a new instance of the class by passing in the mimetype of your audio data.

    *Note: For directly converting from a HTTP response, use the mimetype contained in the `Content-Type` header*
    
    ```
    import MSEAudioWrapper from "mse-audio-wrapper";
    
    const headers = myHTTPResponse.headers;
    const mimeType = headers.get('Content-Type');
    
    const audioWrapper = new MSEAudioWrapper(mimeType);
    ```
    
1. To begin processing audio data, pass in the audio data into the instance's `.iterator()`. This method returns an iterator that can be consumed using a `for ...of` or `for await...of` loop. Repeat this step until all audio data has been read.

    ```
    const audioData = response.body;
    
    for (const wrappedAudio of audioWrapper.iterator(audioData)) {
      // Do something with the wrapped data
    }
    ```

  * MSEAudioWrapper will store any partial data until at least one full audio frame can be processed.

    *Note: Any data that does not conform to the instance's mimetype will be discarded.*

  * Once enough data has been received to form at least 4 complete audio frames, and 1022 bytes of audio data, the initial segment will be returned along with a media segment containing the audio data. These values are user configurable using the `options` parameter in the constructor.

    * 1st Iteration

      ```
      "initial segment"
      --ftyp [file type]
      --moov [movie]
      "media segment"
      --moof [movie fragment]
      --mdat [audio data]
      ```

  * Subsequent iterations will only return media segments.
    * *n*th Iteration

      ```
      "media segment"
      --moof [movie fragment]
      --mdat [audio data]
      ```

### Methods

`const wrapper = new MSEAudioWrapper("audio/mpeg", {minFramesPerSegment: 2, minBytesPerSegment: 576, preferredContainer: "webm"});`
* `constructor`
  * Creates a new instance of MSEAudioWrapper that can be used to wrap audio for a given mimetype.
  * Parameters:
    * `mimetype` *required* Incoming audio codec or container
      * MP3 - `audio/mpeg`
      * AAC - `audio/aac`, `audio/aacp`
      * Ogg FLAC - `application/ogg`, `audio/ogg`
      * Ogg Opus - `application/ogg`, `audio/ogg`
      * Ogg Vorbis - `application/ogg`, `audio/ogg`
    * `options` *optional*
      ### Options
      * `options.minFramesPerSegment` *optional* Minimum audio frames to store before returning a segment
        * Accepts an integer greater than 0
        * Defaults to `4`
      * `options.minBytesPerSegment` *optional* Minimum audio bytes to store before returning a segment
        * Accepts an integer greater than 0
        * Defaults to `1022`
      * `options.maxFramesPerSegment` *optional* Maximum audio frames to group in a single segment
        * Accepts an integer greater than 0
        * Defaults to `50`
      * `options.preferredContainer` *optional* Preferred output container when there are multiple supported containers
        * Accepts `"webm"`, `"fmp4"`
        * Defaults to `"webm"`
      ### Callbacks
      * `options.onMimeType(mimeType)` *optional* Called when the output mimeType is determined.
        * See `wrapper.mimeType` for a list of the possible output mimetypes
      * `options.onCodecUpdate(codecInfo)` *optional* Called when there is a change in the codec header.
        * `codecInfo` is an object containing information about the codec such as `bitrate`, `sampleRate`, etc.
* `wrapper.iterator(data)`
  * Returns an Iterator that can be used in a `for ...of` loop to return wrapped audio
  * Parameters:
    * `data` Uint8Array of audio data to wrap
* `wrapper.inputMimeType`
  * Getter that returns the mime-type of the incoming audio data
  * Examples:
    * MP3 - `audio/mpeg`
    * AAC - `audio/aac`
    * Ogg FLAC - `application/ogg`, `audio/ogg`
    * Ogg Opus - `application/ogg`, `audio/ogg`
    * Ogg Vorbis - `application/ogg`, `audio/ogg`
* `wrapper.mimeType`
  * Getter that returns the mime-type of the wrapped audio data
    * **Note: For Ogg streams, the mime-type will only be available after the first media segment is returned.**
  * Examples:
    * MP3 - `audio/mp4;codecs="mp3"`
    * AAC - `audio/mp4;codecs="mp4a.40.2"`
    * FLAC - `audio/mp4;codecs="flac"`
    * OPUS (ISOBMFF) - `audio/mp4;codecs="opus"`
    * OPUS (WEBM) - `audio/webm;codecs="opus"`
    * Vorbis - `audio/webm;codecs="vorbis"`
---


# Demo

`mse-audio-wrapper` is used in the demo for `icecast-metadata-js` to allow for Icecast metadata support in Firefox (mp3, aac, flac) and Chrome (flac) by wrapping the streaming audio in ISOBMFF so it can be used with the [MediaSource API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource).

https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo

## View the live demo here: https://eshaz.github.io/icecast-metadata-js/