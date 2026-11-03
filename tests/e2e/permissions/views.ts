import type { EntityDTO } from '@mikro-orm/core'
import type { Secret } from './models/Secret.js'
import type { Vault } from './models/Vault.js'
import { createWidgetView } from '../../utils/views.js'

// The secrets are loaded through the list's own resource, not stored with the
// vault.
type VaultItem = EntityDTO<Vault> & { secrets?: never }

// The vault's form contains a list that loads the secrets from their own
// resource, which the user may not access.
export const vaults = createWidgetView<VaultItem>('Vault', 'vaults', {
  name: { type: 'text', label: 'Name' },
  secrets: {
    type: 'list',
    label: 'Secrets',
    resource: { path: '/secrets' },
    columns: { name: { label: 'Name' } }
  }
})

export const secrets = createWidgetView<Secret>('Secret', 'secrets', {
  name: { type: 'text', label: 'Name' }
})
