import { Readable } from 'stream'

// Based on:
// https://github.com/levansuper/readable-stream-clone
// https://stackoverflow.com/questions/19553837#comment90794237_19561718

export class ReadableClone extends Readable {
  constructor(stream, options) {
    super(options)
    this.stream = stream
    this.events = {
      data: chunk => {
        this.push(chunk)
      },
      end: () => {
        this.push(null)
      },
      error: err => {
        this.emit('error', err)
      }
    }
    for (const [event, callback] of Object.entries(this.events)) {
      this.stream.on(event, callback)
    }
  }

  _destroy() {
    for (const [event, callback] of Object.entries(this.events)) {
      this.stream.off(event, callback)
    }
  }

  _read() {
    // Do nothing
  }
}
