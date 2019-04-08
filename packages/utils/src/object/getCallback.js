import { isFunction } from '@/base'

export function getCallback(iteratee) {
  return isFunction(iteratee)
    ? iteratee
    : object => object[iteratee]
}
