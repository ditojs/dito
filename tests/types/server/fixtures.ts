import type { Model, Application } from '@ditojs/server'

// Test model types that don't narrow `id` from `Id` to avoid
// variance issues with QueryBuilder's PartialModelObject<M>.
export interface Item extends Model {
  title: string
  active: boolean
}

export interface User extends Model {
  name: string
  email: string
  items: Item[]
}

export const app = {} as Application<{
  Item: typeof Model
  User: typeof Model
}>
