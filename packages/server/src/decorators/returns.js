export function returns(returns) {
  return (target, key, descriptor) => {
    descriptor.value.returns = returns
  }
}
