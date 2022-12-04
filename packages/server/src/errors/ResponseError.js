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
  // For generic errors, explicitly copy message.
  const object = error.toJSON?.() ?? { message: error.message }
  // Additionally copy status and code if present.
  if (error.status != null) {
    object.status = error.status
  }
  if (error.code != null) {
    object.code = error.code
  }
  // Preserve the cause if already set in the original error, and set it to the
  // error itself otherwise.
  object.cause = error.cause ?? error
  return object
}
