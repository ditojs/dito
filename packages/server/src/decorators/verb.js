export function verb(verb) {
  return (target, key, descriptor) => {
    descriptor.value.verb = verb
  }
}
