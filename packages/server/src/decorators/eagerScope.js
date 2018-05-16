import { createDecorator } from '@/utils'

export function eagerScope(...scopes) {
  return createDecorator(value => {
    const eagerScope = value.eagerScope = value.eagerScope || []
    eagerScope.push(...scopes)
  })
}
