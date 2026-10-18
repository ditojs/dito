export async function deleteExpiredRecords(app) {
  await app.setup()
  await app.deleteExpiredRecords()
  return true
}
