import type { ModelProperties } from '@ditojs/server'
import { Model } from '@ditojs/server'

export interface Vault {
  id: number
  name: string
  // Loaded through the list's own resource, not stored with the vault.
  secrets?: never
}

export class Vault extends Model {
  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }
}
