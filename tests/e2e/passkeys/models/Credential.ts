import { CredentialModel } from '@ditojs/server'

export class Credential extends CredentialModel {
  declare id: number
  declare name: string | null
  declare userId: string
}
