// Shims for broken third-party types, only used by `tsconfig.types.json`.

import 'worker_threads'

declare module 'worker_threads' {
  // `thread-stream` (used by pino) still references `TransferListItem`, which
  // @types/node 26 removed in favor of `Transferable`.
  type TransferListItem = Transferable
}
