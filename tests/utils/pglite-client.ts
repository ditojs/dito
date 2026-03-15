// Inlined PGlite Knex dialect, based on:
// https://github.com/czeidler/knex-pglite
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRequire } from 'module'
import { PGlite } from '@electric-sql/pglite'
import { Knex } from 'knex'

const require = createRequire(import.meta.url)
const Client_PG: any =
  require('knex/lib/dialects/postgres/index.js')

type KnexPGliteConfig = Knex.Config & {
  connection?: { pglite?: PGlite } | (() => { pglite?: PGlite })
}

class ClientPGLiteImpl extends Client_PG {
  constructor(config: KnexPGliteConfig) {
    super({
      ...config,
      pool: { min: 1, max: 1 }
    } satisfies Knex.Config)
  }

  _driver() {
    const connection =
      this.config.connection as any
    const pglite =
      typeof connection === 'function'
        ? connection().pglite
        : connection?.pglite

    this.pglite =
      pglite ??
      new PGlite(
        connection?.filename ??
        connection?.connectionString
      )
  }

  async _acquireOnlyConnection() {
    const connection = this.pglite
    await connection.waitReady
    return connection
  }

  async destroyRawConnection(connection: PGlite) {
    await connection.close()
  }

  async setSchemaSearchPath(
    connection: PGlite,
    searchPath: string
  ): Promise<boolean> {
    let path: string | string[] =
      searchPath || this.searchPath

    if (!path) {
      return true
    }

    if (
      !Array.isArray(path) &&
      typeof path !== 'string'
    ) {
      throw new TypeError(
        `knex: Expected searchPath to be ` +
        `Array/String, got: ${typeof path}`
      )
    }

    if (typeof path === 'string') {
      if (path.includes(',')) {
        const parts = path.split(',')
        const arraySyntax = `[${parts
          .map(p => `'${p}'`)
          .join(', ')}]`
        ;(this as any).logger?.warn?.(
          `Detected comma in searchPath "${path}".` +
          `If you are trying to specify multiple ` +
          `schemas, use Array syntax: ${arraySyntax}`
        )
      }
      path = [path]
    }

    const formatted = path
      .map(s => `"${s}"`)
      .join(',')
    await connection.query(
      `set search_path to ${formatted}`
    )
    return true
  }

  async checkVersion(connection: PGlite) {
    const resp = await connection.query(
      'select version();'
    )
    return this._parseVersion(
      (resp.rows[0] as any).version
    )
  }

  async _query(connection: PGlite, obj: any) {
    if (!obj.sql) throw new Error('The query is empty')
    obj.response = await connection.query(
      obj.sql, obj.bindings, obj.options
    )
    return obj
  }

  processResponse(obj: any, runner: any) {
    const command =
      obj.method === 'first' || obj.method === 'pluck'
        ? 'SELECT'
        : (obj.method as string)?.toUpperCase() ?? ''

    const response = {
      ...obj.response,
      rowCount: obj.response.affectedRows,
      command
    }
    return super.processResponse(
      { ...obj, response }, runner
    )
  }

  _stream(connection: PGlite, obj: any, stream: any) {
    return new Promise((resolve, reject) => {
      stream.on('error', reject)
      stream.on('end', resolve)

      this._query(connection, obj)
        .then((obj: any) => obj.response.rows)
        .then((rows: any[]) =>
          rows.forEach(row => stream.write(row))
        )
        .catch((err: any) =>
          stream.emit('error', err)
        )
        .then(() => stream.end())
    })
  }
}

const ClientPGLite: typeof Knex.Client =
  ClientPGLiteImpl as any
export default ClientPGLite
