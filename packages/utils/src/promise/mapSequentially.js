export async function mapSequentially(input, callback) {
  const array = await input
  const results = []
  let index = 0
  for (const item of array) {
    results.push(await callback(item, index++))
  }
  return results
}
