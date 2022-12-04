import { ResponseError } from './ResponseError.js'

export class RelationError extends ResponseError {
  constructor(error) {
    super(
      error,
      { message: 'Relation error', status: 400 },
      error instanceof Error ? getFormattedOverrides(error) : null
    )
  }
}

function getFormattedOverrides(error) {
  // Adjust Objection.js error messages to point to the right property.
  const format = str => str?.replace(/\brelationMappings\b/g, 'relations')
  const { message, stack } = error
  return {
    message: format(message),
    stack: format(stack)
  }
}
