// Optional peer dependencies are only imported once they're used, with a clear
// error when they aren't installed:
export function importPeer(owner, module) {
  return import(module).catch(err => {
    throw err.code === 'ERR_MODULE_NOT_FOUND'
      ? new Error(
          `Unable to use '${owner.constructor.name}' without '${module}'.`
        )
      : err
  })
}
