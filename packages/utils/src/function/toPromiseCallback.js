export function toPromiseCallback(resolve, reject) {
  return (err, res) => {
    if (err) {
      reject(err)
    } else {
      resolve(res)
    }
  }
}
