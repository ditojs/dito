export function addEvent(target, type, callback) {
  target.addEventListener(type, callback, false)
  return {
    remove() {
      target.removeEventListener(type, callback, false)
    }
  }
}

export function addEvents(target, events) {
  const remove = []
  for (const type in events) {
    remove.push(addEvent(target, type, events[type]))
  }
  return {
    remove() {
      remove.forEach(remove => remove())
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
