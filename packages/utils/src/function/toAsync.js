import { toPromiseCallback } from './toPromiseCallback.js'

export function toAsync(callbackFunction) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      callbackFunction(...args, toPromiseCallback(resolve, reject))
    })
  }
}
