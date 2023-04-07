export function scrollTo(element, to, duration) {
  const requestAnimationFrame = (
    window.requestAnimationFrame ||
    function () {
      return setTimeout(arguments[0], 10)
    }
  )
  if (duration <= 0) {
    element.scrollTop = to
  } else {
    const difference = to - element.scrollTop
    const perTick = difference / duration * 10
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollTop + perTick
      if (element.scrollTop === to) return
      scrollTo(element, to, duration - 10)
    })
  }
}
