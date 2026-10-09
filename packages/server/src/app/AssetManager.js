import fs from 'fs/promises'
import pico from 'picocolors'
import { ref } from 'objection'
import {
  asArray,
  equals,
  flatten,
  groupBy,
  getValueAtDataPath,
  mapConcurrently
} from '@ditojs/utils'
import { AssetError } from '../errors/index.js'
import { getDuration, subtractDuration } from '../utils/duration.js'
import { resolveFileUrl } from '../utils/asset.js'

// Owns the lifecycle of the asset files referenced by model data: diffing the
// files before and after writes, reference counting and garbage collection
// through the `Asset` model, importing of foreign files, and the handling of
// rolled back transactions. Without an `Asset` model, there is nothing to keep
// track of, and all methods resolve to empty arrays.
//
// `Application` exposes the steps as overridable methods: `createAssets()`,
// `handleAddedAndRemovedAssets()`, `addForeignAssets()`,
// `handleModifiedAssets()` and `releaseUnusedAssets()`. Only these delegate to
// the implementations here, and the manager always calls them through
// `this.app`, so that app overrides also apply to the asset handling of model
// writes.
export class AssetManager {
  constructor(app) {
    this.app = app
  }

  get assetModelClass() {
    return this.app.getModel('Asset')
  }

  async handleAssetFileChanges({
    assets,
    dataPaths,
    beforeItems,
    afterItems,
    transaction
  }) {
    const beforeFilesPerDataPath = getFilesPerAssetDataPath(
      beforeItems,
      dataPaths
    )
    const afterFilesPerDataPath = getFilesPerAssetDataPath(
      afterItems,
      dataPaths
    )

    const importedFiles = []
    const modifiedFiles = []
    // Install the handler before processing the files, so that files already
    // imported are removed again when a later data path fails.
    this.#installRollbackHandler(transaction, importedFiles, modifiedFiles)

    for (const dataPath of dataPaths) {
      const storage = this.app.getStorage(assets[dataPath].storage)
      const beforeFiles = beforeFilesPerDataPath[dataPath]
      const afterFiles = afterFilesPerDataPath[dataPath]
      const beforeByKey = mapFilesByKey(beforeFiles)
      const afterByKey = mapFilesByKey(afterFiles)
      const addedFiles = afterFiles.filter(file => !beforeByKey[file.key])
      const removedFiles = beforeFiles.filter(file => !afterByKey[file.key])
      const changedFiles = afterFiles.filter(file => {
        const beforeFile = beforeByKey[file.key]
        return beforeFile && !equals(file, beforeFile)
      })
      // Also handle files where the data property is changed before update /
      // patch, meaning the file's content is replaced.
      // NOTE: This will change the content for all the references to it,
      // and so should only really be used when there's only one reference.
      const filesWithChangedData = afterFiles.filter(
        file => file.data && beforeByKey[file.key]
      )
      importedFiles.push(
        ...(await this.app.handleAddedAndRemovedAssets(
          storage,
          addedFiles,
          removedFiles,
          changedFiles,
          transaction
        ))
      )
      modifiedFiles.push(
        ...(await this.app.handleModifiedAssets(
          storage,
          filesWithChangedData,
          transaction
        ))
      )
    }
  }

  #installRollbackHandler(transaction, importedFiles, modifiedFiles) {
    // The 'rollback' event is emitted by the `createTransaction()` middleware,
    // see there.
    if (!transaction?.rollback) return
    // Prevent wrong memory leak error messages when installing more than
    // 10 'rollback' handlers, which can happen with more complex queries.
    transaction.setMaxListeners(0)
    transaction.on('rollback', async error => {
      if (importedFiles.length > 0) {
        console.info(
          `Received '${error}', removing imported files again: ${
            importedFiles.map(file => `'${file.name}'`)
          }`
        )
        await mapConcurrently(
          importedFiles,
          file => file.storage.removeFile(file)
        )
      }
      if (modifiedFiles.length > 0) {
        // TODO: `modifiedFiles` should be restored as well, but that's
        // far from trivial since no backup is kept in `handleModifiedAssets()`
        console.warn(
          `Unable to restore these already modified files: ${
            modifiedFiles.map(file => `'${file.name}'`)
          }`
        )
      }
    })
  }

  async createAssets(storage, files, count = 0, transaction = null) {
    const AssetModel = this.assetModelClass
    if (!AssetModel) return []
    // Shallow-clone file objects to avoid mutating the originals, since
    // $parseJson() → convertAssetFile() deletes the signature.
    // The originals may still be needed (e.g. sent as upload response).
    // Shallow clone is sufficient as file objects are flat (scalar values).
    const assets = files.map(file => ({
      key: file.key,
      file: { ...file },
      storage: storage.name,
      count
    }))
    return AssetModel.query(transaction).insert(assets)
  }

  async handleAddedAndRemovedAssets(
    storage,
    addedFiles,
    removedFiles,
    changedFiles,
    transaction = null
  ) {
    const AssetModel = this.assetModelClass
    if (!AssetModel) return []
    const importedFiles = await this.app.addForeignAssets(
      storage,
      [...addedFiles, ...changedFiles],
      transaction
    )
    if (addedFiles.length > 0 || removedFiles.length > 0) {
      const changeCount = async (files, increment) => {
        if (files.length > 0) {
          await AssetModel.query(transaction)
            .whereIn(
              'key',
              files.map(file => file.key)
            )
            .increment('count', increment)
        }
      }
      await Promise.all([
        changeCount(addedFiles, 1),
        changeCount(removedFiles, -1)
      ])
      const cleanupTimeThreshold = getDuration(
        this.app.config.assets.cleanupTimeThreshold
      )
      if (cleanupTimeThreshold > 0) {
        setTimeout(
          // Don't pass `transaction` here, as we want this delayed execution
          // to create its own transaction.
          () => this.app.releaseUnusedAssets(),
          cleanupTimeThreshold
        )
      }
    }
    // Also execute releaseUnusedAssets() immediately in the same
    // transaction, to potentially clean up other pending assets.
    await this.app.releaseUnusedAssets({ transaction })
    return importedFiles
  }

  async addForeignAssets(storage, files, transaction = null) {
    const AssetModel = this.assetModelClass
    if (!AssetModel) return []
    const importedFiles = []
    // Find missing assets (copied from another system), and add them.
    const filesByKey = groupBy(files, file => file.key)
    await mapConcurrently(
      Object.entries(filesByKey),
      async ([key, files]) => {
        const asset = await AssetModel.query(transaction).findOne('key', key)
        if (!asset) {
          const [file] = files // Pick the first file
          if (file.data || file.url) {
            let { data } = file
            if (!data) {
              const { url } = file
              if (!storage.isImportSourceAllowed(url)) {
                throw new AssetError(
                  `Unable to import asset from foreign source: '${
                    file.name
                  }' ('${
                    url
                  }'): The source needs to be explicitly allowed.`
                )
              }
              this.app.logger.info(
                `Asset ${
                  pico.green(`'${file.name}'`)
                } is from a foreign source, fetching from ${
                  pico.green(`'${url}'`)
                } and adding to storage ${
                  pico.green(`'${storage.name}'`)
                }...`
              )
              if (url.startsWith('file://')) {
                data = await fs.readFile(new URL(resolveFileUrl(url)))
              } else {
                const response = await fetch(url)
                const arrayBuffer = await response.arrayBuffer()
                // `fs.writeFile()` expects a Buffer, not an ArrayBuffer.
                data = Buffer.from(arrayBuffer)
              }
            }
            const importedFile = await storage.addFile(file, data)
            // Sign the imported foreign file so it passes verification when
            // createAssets() triggers $parseJson() → convertAssetFile().
            storage.signAssetFile(importedFile)
            await this.app.createAssets(
              storage,
              [importedFile],
              0,
              transaction
            )
            importedFiles.push(importedFile)
            // Merge back the changed file properties into the actual file
            // objects, so that the data from the static model hook can be
            // used directly for the actual running query.
            for (const file of files) {
              Object.assign(file, importedFile)
            }
          } else {
            throw new AssetError(
              `Unable to import asset from foreign source: '${
                file.name
              }' ('${
                file.key
              }')`
            )
          }
        } else {
          // Asset is from a foreign source, but was already imported and can
          // be reused. See above for an explanation of this merge.
          for (const file of files) {
            Object.assign(file, asset.file)
          }
          // NOTE: No need to add `file` to `importedFiles`, since it's
          // already been imported to the storage before.
        }
      },
      { concurrency: storage.concurrency }
    )
    return importedFiles
  }

  async handleModifiedAssets(storage, files, transaction = null) {
    const AssetModel = this.assetModelClass
    if (!AssetModel) return []
    const modifiedFiles = []
    await mapConcurrently(
      files,
      async file => {
        if (file.data) {
          const asset = await AssetModel.query(transaction).findOne(
            'key',
            file.key
          )
          if (asset) {
            const changedFile = await storage.addFile(file, file.data)
            // Merge back the changed file properties into the actual files
            // object, so that the data from the static model hook can be used
            // directly for the actual running query.
            Object.assign(file, changedFile)
            modifiedFiles.push(changedFile)
          } else {
            throw new AssetError(
              `Unable to update modified asset from memory source: '${
                file.name
              }' ('${
                file.key
              }')`
            )
          }
        }
      },
      { concurrency: storage.concurrency }
    )
    return modifiedFiles
  }

  async releaseUnusedAssets({
    timeThreshold = null,
    transaction = null,
    concurrency = 8
  } = {}) {
    const AssetModel = this.assetModelClass
    if (!AssetModel) return []
    const { assets } = this.app.config
    const cleanupTimeThreshold = getDuration(
      timeThreshold ?? assets.cleanupTimeThreshold
    )
    const danglingTimeThreshold = getDuration(
      timeThreshold ?? assets.danglingTimeThreshold
    )
    return AssetModel.transaction(transaction, async trx => {
      // Calculate the date math in JS instead of SQL, as there is no easy
      // cross-SQL way to do `now() - interval X hours`:
      const now = new Date()
      const cleanupDate = subtractDuration(now, cleanupTimeThreshold)
      const danglingDate = subtractDuration(now, danglingTimeThreshold)
      const orphanedAssets = await AssetModel.query(trx)
        .where('count', 0)
        .andWhere(query =>
          query
            .where('updatedAt', '<=', cleanupDate)
            .orWhere(
              // Protect freshly created assets from being deleted again
              // right away, when `config.assets.cleanupTimeThreshold = 0`
              query =>
                query
                  .where('updatedAt', '=', ref('createdAt'))
                  .andWhere('updatedAt', '<=', danglingDate)
            )
        )
      if (orphanedAssets.length > 0) {
        const orphanedKeys = await mapConcurrently(
          orphanedAssets,
          async asset => {
            try {
              await this.app.getStorage(asset.storage).removeFile(asset.file)
            } catch (error) {
              this.app.emit('error', error)
              asset.error = error
            }
            return asset.key
          },
          { concurrency }
        )
        await AssetModel.query(trx).delete().whereIn('key', orphanedKeys)
      }
      return orphanedAssets
    })
  }
}

function getFilesPerAssetDataPath(items, dataPaths) {
  return dataPaths.reduce(
    (allFiles, dataPath) => {
      allFiles[dataPath] = asArray(items).reduce(
        (files, item) => {
          // Ignore data paths that don't resolve, e.g. missing parents.
          const data = asArray(getValueAtDataPath(item, dataPath, () => {}))
          // Use flatten() as dataPath may contain wildcards, resulting in
          // nested files arrays.
          files.push(...flatten(data).filter(file => !!file))
          return files
        },
        []
      )
      return allFiles
    },
    {}
  )
}

function mapFilesByKey(files) {
  return files.reduce(
    (map, file) => {
      map[file.key] = file
      return map
    },
    {}
  )
}
