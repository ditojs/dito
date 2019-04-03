export function addEvents(target, events) {
  for (const type in events) {
    target.addEventListener(type, events[type], false)
  }
  return {
    remove() {
      for (const type in events) {
        target.removeEventListener(type, events[type], false)
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
  }[event.keyCode]
}

export function getKeyNavigation(event) {
  const key = getKey(event)
  return {
    hor: { left: -1, right: 1 }[key] || 0,
    ver: { up: -1, down: 1 }[key] || 0,
    enter: key === 'enter'
  }
}
