export async function deleteExpiredRecords(app) {
  await app.setup()
  let hasErrors = false
  app.on('error', error => {
    hasErrors = true
    app.logError(error)
  })
  await app.deleteExpiredRecords()
  return !hasErrors
}
