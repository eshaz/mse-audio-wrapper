# ISOBMFF Audio

`isobmff-audio` is a library that wraps audio into the ISO Base Media File Format (MPEG-4 Part 12) (commonly referred to as Fragmented MP4 or fmp4).

 * [**API**](#isobmffaudio)
   * [**ISOBMFFAudioWrapper**](#ISOBMFFAudioWrapper)
     * Takes in audio (MP3, AAC, or OGG Flac) and outputs fragmented ISOBMFF
 * [**Demo**](#demo)
   * React application that demonstrates ISOBMFFAudioWrapper being used to support the MediaSource Extensions API with `icecast-metadata-js`
   * Checkout the demo [here](https://eshaz.github.io/icecast-metadata-js/)!

---

# API

## `ISOBMFFAudioWrapper`

https://github.com/eshaz/isobmff-audio/tree/master/src/ISOBMFFAudioWrapper.js

A class that takes in audio (MP3, AAC, or OGG Flac) and outputs fragmented ISOBMFF.

### Usage

1. To use `ISOBMFFAudioWrapper`, create a new instance of the class by passing in the mimetype of your audio data.

    *Note: For directly converting from an HTTP response, use the mimetype contained in the `Content-Type` header*
    
    <pre>
    import ISOBMFFAudioWrapper from "isobmff-audio";
    
    const headers = myHTTPResponse.headers;
    const mimeType = headers.get('Content-Type');
    
    const fmp4Wrapper = new ISOBMFFAudioWrapper(mimeType);
    </pre>
    
1. To wrap audio into ISOBMFF, pass in the raw audio data into the instance's `.iterator()`. Iterate over this iterator using a `for ...of` or `for await...of` loop. Repeat this step until all audio data has been read.

    <pre>
    const audioData = response.body;
    
    for (const fMP4 of fmp4Wrapper.iterator(audioData)) {
      // Do something with the wrapped data
    }
    </pre>

  * ISOBMFFAudioWrapper will store any partial data until a full audio frame can be appended as ISOBMFF.

    *Note: Any data that does not conform to the instance's mimetype will be discarded.*

  * Once enough data has been received to form at least 4 complete audio frames, and 1022 bytes of audio data, the initial segment will be returned along with a movie fragment containing the audio data. These values are user configurable using the `options` parameter in the constructor.

    * 1st Iteration
    
      <pre>
      "initial segment"
      --ftyp [file type]
      --moov [movie]
      "fragment"
      --moof [movie fragment]
      --mdat [audio data]
      </pre>

  * Subsequent iterations will only return movie fragments.
    * *n*th Iteration

      <pre>
      "fragment"
      --moof [movie fragment]
      --mdat [audio data]
      </pre>

### Methods

`const wrapper = new ISOBMFFAudioWrapper("audio/mpeg", {minFramesPerFragment: 2, minBytesPerFragment: 576});`
* `constructor`
  * Creates a new instance of ISOMBFFAudioWrapper that can be used to wrap audio for a given mimetype.
  * Parameters:
    * `mimetype` *required* Format of the audio to wrap into ISOBMFF
      * MP3 - `audio/mpeg`
      * AAC - `audio/aac`, `audio/aacp`
      * FLAC - `audio/flac`
      * Ogg FLAC - `application/ogg`, `audio/ogg`
    * `options` *optional*
      * `options.minFramesPerFragment` *optional* Minimum audio frames to store before returning a fragment
        * Accepts an integer greater than 0
        * Defaults to `4`
      * `options.minBytesPerFragment` *optional* Minimum audio bytes to store before returning a fragment
        * Accepts an integer greater than 0
        * Defaults to `1022`
* `wrapper.iterator(data)`
  * Returns an Iterator that can be used in a `for ...of` loop to return ISOBMFF
  * Parameters:
    * `data` Uint8Array of audio data to wrap
* `wrapper.mimeType`
  * Getter that returns the mimeType of the wrapped audio data
  * Examples:
    * MP3 - `audio/mp4;codecs="mp3"`
    * AAC - `audio/mp4;codecs="mp4a.40.2"`
    * FLAC - `audio/mp4;codecs="flac"`
---


# Demo

`isobmff-audio` is used in the demo for `icecast-metadata-js` to allow for Icecast metadata support in Firefox (mp3, aac, flac) and Chrome (flac) by wrapping the streaming audio in ISOBMFF so it can be used with the [MediaSource API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource).

https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo

## View the live demo here: https://eshaz.github.io/icecast-metadata-js/