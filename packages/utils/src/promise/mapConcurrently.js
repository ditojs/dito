export async function mapConcurrently(
  input,
  callback,
  { concurrency = 0 } = {}
) {
  const array = await input
  if (!concurrency) {
    return Promise.all(array.map(callback))
  } else {
    const promises = []
    const results = []
    let index = 0

    function next() {
      if (index < array.length) {
        const i = index++
        return Promise.resolve(callback(array[i], i, array)).then(result => {
          results[i] = result
          return next()
        })
      }
    }

    while (concurrency-- > 0) {
      const promise = next()
      if (!promise) break
      promises.push(promise)
    }

    return Promise.all(promises).then(() => results)
  }
}
