import { Readable } from 'stream'

// Based on:
// https://github.com/levansuper/readable-stream-clone
// https://stackoverflow.com/questions/19553837#comment90794237_19561718

export class CloneableReadable extends Readable {
  constructor(stream, options) {
    super(options)
    stream.on('data', chunk => {
      this.push(chunk)
    })
    stream.on('end', () => {
      this.push(null)
    })
    stream.on('error', err => {
      this.emit('error', err)
    })
  }

  _read() {
    // Do nothing
  }
}
