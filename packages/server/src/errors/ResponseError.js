import { isPlainObject, isString } from '@ditojs/utils'

export class ResponseError extends Error {
  constructor(
    error,
    defaults = { message: 'Response error', status: 500 },
    overrides
  ) {
    const object = isPlainObject(error)
      ? error
      : error instanceof Error
        ? getErrorObject(error)
        : isString(error)
          ? { message: error }
          : error || {}
    const { message, status, stack, cause, ...data } = {
      ...defaults,
      ...object,
      ...overrides
    }
    super(message, cause ? { cause } : {})
    this.status = status
    this.data = data
    // Allow `stack` overrides, e.g. for `RelationError`.
    if (stack != null) {
      this.stack = stack
    }
  }

  toJSON() {
    return {
      // Include the message in the JSON data sent back.
      message: this.message,
      ...this.data
    }
  }
}

function getErrorObject(error) {
  const object = {
    // For generic errors, explicitly copy message.
    message: error.message,
    ...error.toJSON?.()
  }
  // Additionally copy status and code if present.
  if (error.status != null) {
    object.status = error.status
  }
  if (error.code != null) {
    object.code = error.code
  }
  object.cause = error
  return object
}
