import { createDecorator } from '../utils/decorator.js'

export function scope(...scopes) {
  return createDecorator(value => {
    const scope = value.scope = value.scope || []
    scope.push(...scopes)
  })
}
