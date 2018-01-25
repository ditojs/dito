export function action(verb, path) {
  return (target, key, descriptor) => {
    descriptor.value.verb = verb
    descriptor.value.path = path
  }
}
