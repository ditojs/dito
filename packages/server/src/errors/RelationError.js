import { ResponseError } from './ResponseError.js'

export class RelationError extends ResponseError {
  constructor(error) {
    super(
      error,
      { message: 'Relation error', status: 400 },
      error instanceof Error ? getParsedOverrides(error) : null
    )
  }
}

function getParsedOverrides(error) {
  // Adjust Objection.js error messages to point to the right property.
  const parse = str => str?.replace(/\brelationMappings\b/g, 'relations')
  const { message, stack } = error
  return {
    message: parse(message),
    stack: parse(stack)
  }
}
