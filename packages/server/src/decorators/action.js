import { createDecorator } from '@/utils'

export function action(verb, path) {
  return createDecorator(value => {
    value.verb = verb
    value.path = path
  })
}
