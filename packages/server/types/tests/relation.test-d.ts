import { assertType, describe, it } from 'vitest'
import type { ModelRelation, QueryBuilder } from '../index.d.ts'

describe('ModelRelation', () => {
  it('accepts basic belongsTo relation', () => {
    assertType<ModelRelation>({
      relation: 'belongsTo',
      from: 'Item.userId',
      to: 'User.id'
    })
  })

  it('accepts hasMany with scope and filter string', () => {
    assertType<ModelRelation>({
      relation: 'hasMany',
      from: 'User.id',
      to: 'Item.userId',
      scope: 'active',
      filter: 'published'
    })
  })

  it('accepts filter as object with args', () => {
    assertType<ModelRelation>({
      relation: 'hasMany',
      from: 'User.id',
      to: 'Item.userId',
      filter: { recent: [30], active: [] }
    })
  })

  it('accepts modify as function', () => {
    assertType<ModelRelation>({
      relation: 'hasMany',
      from: 'User.id',
      to: 'Item.userId',
      modify: query => {
        query.withScope('active')
      }
    })
  })

  it('accepts modify as find-filter object', () => {
    assertType<ModelRelation>({
      relation: 'hasMany',
      from: 'User.id',
      to: 'Item.userId',
      modify: { active: true }
    })
  })

  it('accepts through relation with extra', () => {
    assertType<ModelRelation>({
      relation: 'manyToMany',
      from: 'User.id',
      to: 'Tag.id',
      through: {
        from: 'UserTag.userId',
        to: 'UserTag.tagId',
        extra: ['role']
      },
      inverse: true
    })
  })

  it('accepts owner and nullable options', () => {
    assertType<ModelRelation>({
      relation: 'belongsTo',
      from: 'Item.userId',
      to: 'User.id',
      owner: true,
      nullable: true
    })
  })

  it('rejects invalid relation type', () => {
    // @ts-expect-error - relation is required
    assertType<ModelRelation>({
      from: 'Item.userId',
      to: 'User.id'
    })
  })
})
