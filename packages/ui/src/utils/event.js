import { asArray } from '@ditojs/utils'

export function addEvents(targets, events) {
  targets =
    targets instanceof NodeList
      ? Array.from(targets)
      : asArray(targets)

  for (const [type, handler] of Object.entries(events)) {
    for (const target of targets) {
      target.addEventListener(type, handler, false)
    }
  }

  return {
    remove() {
      for (const [type, handler] of Object.entries(events)) {
        for (const target of targets) {
          target.removeEventListener(type, handler, false)
        }
      }
    }
  }
}

export function combineEvents(...events) {
  return {
    remove() {
      for (const event of events) {
        event.remove()
      }
    }
  }
}

export function getKey(event) {
  return {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    13: 'enter'
  }[event?.keyCode]
}

export function getKeyNavigation(event) {
  const key = getKey(event)
  return {
    hor: { left: -1, right: 1 }[key] || 0,
    ver: { up: -1, down: 1 }[key] || 0,
    enter: key === 'enter'
  }
}
