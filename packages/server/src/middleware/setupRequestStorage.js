export function setupRequestStorage(requestStorage) {
  return (ctx, next) =>
    requestStorage.run(
      {
        get transaction() {
          return ctx.transaction
        },
        get logger() {
          return ctx.logger
        }
      },
      next
    )
}
