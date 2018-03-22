export function authorize(authorize) {
  return (target, key, descriptor) => {
    descriptor.value.authorize = authorize
  }
}
