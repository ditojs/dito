export async function deleteExpiredRecords(app) {
  await app.setup()
  let hasErrors = false
  app.on('error', () => {
    hasErrors = true
  })
  await app.deleteExpiredRecords()
  return !hasErrors
}
