import imageSize from 'image-size'
import { Transform } from 'stream'

// Code based on two libraries, and further streamlined:
// https://github.com/shinnn/image-size-stream
// https://github.com/tremez/passthrough-imagesize

export class ImageSizeTransform extends Transform {
  constructor(options = {}) {
    super(options)
    // Use the same default limit as https://github.com/shinnn/image-size-stream
    const { limit = 128 * 1024 } = options
    this.limit = limit
    this.done = false
    this.length = 0
    this.buffer = null
    this.error = null
  }

  _transform(chunk, encoding, callback) {
    this.length += chunk.length
    if (!this.done) {
      if (this.limit && this.length >= this.limit) {
        this.error = new Error('Unable do determine image size: Limit reached')
        this.done = true
      } else {
        this.buffer = this.buffer
          ? Buffer.concat([this.buffer, chunk])
          : chunk
        try {
          this.emit('size', imageSize(this.buffer))
          this.error = null
          this.done = true
        } catch (err) {
          // Do not emit the error right away. Instead keep trying when new
          // data is received until either the image size can be determined,
          // or the end of the stream is reached and `_flush()` is called.
          this.error = err
        }
      }
    }
    this.push(chunk)
    callback()
  }

  _flush(callback) {
    if (!this.done && !this.error) {
      this.error = new Error('Unable do determine image size.')
    }
    if (this.error) {
      this.emit('error', this.error)
    }
    callback()
  }
}
