import { SQLiteClient } from './SQLiteClient.js'
import { PostgreSQLClient } from './PostgreSQLClient.js'

// Map knex client names to dito's own client classes:
export const drivers = {
  'better-sqlite3': SQLiteClient,
  'postgresql': PostgreSQLClient
}
