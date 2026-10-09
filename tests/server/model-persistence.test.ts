import type { ModelProperties } from '@ditojs/server'
import {
  Model,
  DatabaseError,
  NotFoundError,
  ResponseError
} from '@ditojs/server'
import {
  createTestApp,
  createTestDatabase,
  destroyTestApp
} from './setup.js'

const hookCalls: string[] = []
const foundBeforeDelete: unknown[] = []

class Member extends Model {
  declare id: number
  declare name: string
  declare email: string | null
  declare joinedOn: Date | null
  declare active: boolean
  declare teamId: number | null
  declare team?: Team

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    email: { type: 'string', nullable: true },
    joinedOn: { type: 'date', nullable: true },
    active: { type: 'boolean', default: true }
  }

  static override relations = {
    team: {
      relation: 'belongsTo' as const,
      from: 'Member.teamId',
      to: 'Team.id'
    }
  }

  static override scopes = {
    // Only list active members, unless the scope is ignored.
    default: (query: any) => query.where('active', true)
  } as any

  static override hooks = {
    // Trim submitted string properties before writing them.
    'before:insert, before:update'({ inputItems }: any) {
      for (const item of inputItems) {
        for (const [key, value] of Object.entries(item)) {
          if (typeof value === 'string') {
            item[key] = value.trim()
          }
        }
      }
    },
    async 'before:delete'({ asFindQuery }: any) {
      foundBeforeDelete.push(await asFindQuery())
    },
    'after:insert'(this: typeof Member) {
      hookCalls.push(`${this.name} inserted`)
    },
    'after:find'({ result }: any) {
      // Sort found members by name, without changing the query.
      return [...result].sort((a: Member, b: Member) =>
        a.name.localeCompare(b.name)
      )
    }
  } as any
}

class Team extends Model {
  declare id: number
  declare name: string
  declare members?: Member[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true }
  }

  static override relations = {
    members: {
      relation: 'hasMany' as const,
      from: 'Team.id',
      to: 'Member.teamId'
    }
  }
}

describe('Model persistence', () => {
  const app = createTestApp({ models: { Team, Member } })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.setup()
  })

  afterAll(async () => {
    await destroyTestApp(app)
  })

  afterEach(async () => {
    hookCalls.length = 0
    foundBeforeDelete.length = 0
    await app.knex('Member').del()
    await app.knex('Team').del()
  })

  async function createTeam(name: string, memberNames: string[]) {
    return Team.query().insertGraphAndFetch({
      name,
      members: memberNames.map(name => ({ name }))
    } as any)
  }

  describe('hooks', () => {
    it('lets before hooks modify the input items', async () => {
      const member = await Member.query().insertAndFetch({
        name: '  Ada  ',
        email: ' ada@example.com'
      } as any)
      expect(member.name).toBe('Ada')
      expect(member.email).toBe('ada@example.com')
      await Member.query().findById(member.id).patch({ name: ' Grace ' })
      const patched = await Member.query().findById(member.id)
      expect(patched!.name).toBe('Grace')
    })

    it('runs after hooks with the model class as this', async () => {
      await Member.query().insert({ name: 'Ada' } as any)
      expect(hookCalls).toEqual(['Member inserted'])
    })

    it('finds the affected models with asFindQuery()', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      // The `runAfter()` callbacks of the delete query apply to its result,
      // not to the models found by `asFindQuery()`, see objection#2093:
      const result = await Member.query()
        .deleteById(member.id)
        .runAfter(result => `deleted ${result}`)
      expect(result).toBe('deleted 1')
      expect(foundBeforeDelete).toHaveLength(1)
      const [found] = foundBeforeDelete as Member[][]
      expect(found).toHaveLength(1)
      expect(found[0]).toBeInstanceOf(Member)
      expect(found[0].name).toBe('Ada')
    })

    it('finds no models with asFindQuery() for empty first() queries', async () => {
      await Member.query().findById(999).delete()
      expect(foundBeforeDelete).toEqual([[]])
    })

    it('returns results replaced by after:find hooks', async () => {
      await Member.query().insert([
        { name: 'Grace' },
        { name: 'Ada' },
        { name: 'Linus' }
      ] as any)
      const members = await Member.query().orderBy('name', 'desc')
      expect(members.map(member => member.name)).toEqual([
        'Ada',
        'Grace',
        'Linus'
      ])
    })
  })

  describe('scopes', () => {
    it('applies the default scope to find queries', async () => {
      await Member.query().insert([
        { name: 'Ada' },
        { name: 'Grace', active: false }
      ] as any)
      expect((await Member.query()).map(member => member.name)).toEqual([
        'Ada'
      ])
      const all = await Member.query().ignoreScope('default')
      expect(all).toHaveLength(2)
    })
  })

  describe('Model#$emit()', () => {
    it('emits events on the model class with the instance', async () => {
      const received: unknown[] = []
      const listener = function (this: unknown, ...args: unknown[]) {
        received.push(this, ...args)
        return 'handled'
      }
      ;(Member as any).on('promoted', listener)
      try {
        const member = Member.fromJson({ name: 'Ada' })
        expect(await (member as any).$emit('promoted', 'captain')).toEqual([
          'handled'
        ])
        expect(received).toEqual([Member, member, 'captain'])
      } finally {
        ;(Member as any).off('promoted', listener)
      }
    })
  })

  describe('Model.count()', () => {
    it('counts all rows and returns 0 for empty tables', async () => {
      expect(await Member.count()).toBe(0)
      await Member.query().insert([{ name: 'Ada' }, { name: 'Grace' }] as any)
      expect(await Member.count()).toBe(2)
    })

    it('counts the passed column', async () => {
      await Member.query().insert([
        { name: 'Ada', email: 'ada@example.com' },
        { name: 'Grace' }
      ] as any)
      expect(await Member.count('email')).toBe(1)
    })
  })

  describe('Model#$patch() and Model#$update()', () => {
    it('patches the row and sets the values on the model', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      const result = await member.$patch({ email: 'ada@example.com' })
      expect(result).toBe(member)
      expect(member.email).toBe('ada@example.com')
      const stored = await Member.query().findById(member.id)
      expect(stored!.email).toBe('ada@example.com')
    })

    it('updates the row and sets the values on the model', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      const result = await member.$update({ name: 'Ada Lovelace' } as any)
      expect(result).toBe(member)
      expect(member.name).toBe('Ada Lovelace')
      const stored = await Member.query().findById(member.id)
      expect(stored!.name).toBe('Ada Lovelace')
    })

    it('validates updates as complete models', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      await expect(
        member.$update({ email: 'ada@example.com' } as any)
      ).rejects.toThrow('The provided data for the Member model is not valid')
    })

    it('returns the query result when the patch is turned into a find', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      const result = await (member.$patch({ name: 'Grace' }) as any)
        .toFindQuery()
        .first()
      expect(result).toBeInstanceOf(Member)
      expect(result).not.toBe(member)
      expect(result.name).toBe('Ada')
      expect(member.name).toBe('Ada')
    })

    it('returns the query result when the update is turned into a find', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      const result = await (member.$update({ name: 'Grace' } as any) as any)
        .toFindQuery()
        .first()
      expect(result).not.toBe(member)
      expect(result.name).toBe('Ada')
    })

    it('returns the query result when the patch operation is cleared', async () => {
      // Unlike `toFindQuery()`, clearing the operation keeps `runAfter()`.
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      const result = await (member.$patch({ name: 'Grace' }) as any).clear(
        'patch'
      )
      expect(result).toBeInstanceOf(Member)
      expect(result).not.toBe(member)
      expect(result.name).toBe('Ada')
      expect(member.name).toBe('Ada')
    })

    it('returns the query result when the update operation is cleared', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada'
      } as any)
      const result = await (
        member.$update({ name: 'Grace' } as any) as any
      ).clear('update')
      expect(result).toBeInstanceOf(Member)
      expect(result).not.toBe(member)
      expect(result.name).toBe('Ada')
      expect(member.name).toBe('Ada')
    })
  })

  describe('graph helpers', () => {
    it('removes relations that are not in the expression', async () => {
      const team = Team.fromJson({
        name: 'Blue',
        members: [{ name: 'Ada' }]
      }) as Team
      expect(team.$filterGraph(team, 'members')).toBe(team)
      expect(team.members).toHaveLength(1)
      const [filtered] = Team.filterGraph([team], '[]') as any
      expect(filtered).toBe(team)
      expect(team).not.toHaveProperty('members')
    })

    it('populates references with the referenced data', async () => {
      const { id } = await createTeam('Blue', [])
      const options = { skipValidation: true }
      const member = Member.fromJson(
        { name: 'Ada', team: { id } },
        options
      ) as Member
      await Member.populateGraph(member, 'team')
      expect(member.team!.name).toBe('Blue')
      const other = Member.fromJson(
        { name: 'Grace', team: { id } },
        options
      ) as Member
      await other.$populateGraph(other, 'team')
      expect(other.team!.name).toBe('Blue')
    })
  })

  describe('dates', () => {
    it('stores dates as plain dates and returns them as such', async () => {
      const member = await Member.query().insertAndFetch({
        name: 'Ada',
        joinedOn: '2026-05-14'
      } as any)
      expect(member.joinedOn).toEqual(new Date(2026, 4, 14))
      expect(member.toJSON().joinedOn).toBe('2026-05-14')
      const [row] = await app
        .knex('Member')
        .select(app.knex.raw('"joinedOn"::text as "joinedOn"'))
      expect(row.joinedOn).toBe('2026-05-14')
    })
  })

  describe('Model.transaction()', () => {
    it('commits the handler queries', async () => {
      await Member.transaction(async trx => {
        await Member.query(trx).insert({ name: 'Ada' } as any)
      })
      expect(await Member.count()).toBe(1)
    })

    it('rolls back when the handler throws', async () => {
      await expect(
        Member.transaction(async trx => {
          await Member.query(trx).insert({ name: 'Ada' } as any)
          throw new Error('abort')
        })
      ).rejects.toThrow('abort')
      expect(await Member.count()).toBe(0)
    })

    it('returns a transaction without a handler', async () => {
      const trx = await Member.transaction()
      try {
        await Member.query(trx).insert({ name: 'Ada' } as any)
        expect(await Member.query(trx).resultSize()).toBe(1)
      } finally {
        await trx.rollback()
      }
      expect(await Member.count()).toBe(0)
    })
  })

  describe('query errors', () => {
    it('converts database errors to DatabaseError', async () => {
      const promise = Member.query().where('nickname', 'Ada')
      const error = await promise.catch(error => error)
      expect(error).toBeInstanceOf(DatabaseError)
      expect(error.message).toMatch(/column "nickname" does not exist/)
      // The SQL is only included with the `log.errors.sql` setting.
      expect(error.message).not.toMatch(/^select/)
    })

    it('throws NotFoundError for missing models', async () => {
      const error = await Member.query()
        .findById(42)
        .throwIfNotFound()
        .catch(error => error)
      expect(error).toBeInstanceOf(NotFoundError)
      expect(error.status).toBe(404)
    })

    it('reports the requested id in NotFoundError', async () => {
      const error = await Member.query()
        .findById(42)
        .throwIfNotFound()
        .catch(error => error)
      expect(error.message).toBe(`'Member' model with id 42 not found`)
    })

    it('wraps other errors in ResponseError', async () => {
      const promise = Member.query().runBefore(() => {
        throw new Error('broken')
      })
      const error = await promise.catch(error => error)
      expect(error).toBeInstanceOf(ResponseError)
      expect(error.message).toBe('broken')
    })
  })

  describe('relation accessors', () => {
    it('queries related models of instances', async () => {
      const team = await createTeam('Blue', ['Ada', 'Grace'])
      const members = await (team as any).$members.query()
      expect(members.map((member: Member) => member.name)).toEqual([
        'Ada',
        'Grace'
      ])
    })

    it('queries related models of the class', async () => {
      const team = await createTeam('Blue', ['Ada'])
      const members = await (Team as any).$members.query().for(team.id)
      expect(members.map((member: Member) => member.name)).toEqual(['Ada'])
    })

    it('loads related models into instances', async () => {
      const { id } = await createTeam('Blue', ['Ada'])
      const team = (await Team.query().findById(id))!
      await (team as any).$members.load()
      expect(team.members!.map(member => member.name)).toEqual(['Ada'])
    })

    it('loads related models into multiple instances', async () => {
      await createTeam('Blue', ['Ada'])
      await createTeam('Red', ['Grace', 'Linus'])
      const teams = await Team.query().orderBy('name')
      await (Team as any).$members.load(teams)
      expect(
        teams.map(team => [team.name, team.members!.length])
      ).toEqual([
        ['Blue', 1],
        ['Red', 2]
      ])
    })
  })

  describe('loadDataPath()', () => {
    it('loads relations at the end of the data path', async () => {
      await createTeam('Blue', ['Ada'])
      const [member] = await Member.query().loadDataPath('team')
      expect(member.team!.name).toBe('Blue')
    })

    it('loads properties of relations', async () => {
      await createTeam('Blue', ['Ada'])
      const [member] = await Member.query().loadDataPath('team/name')
      expect(member.team!.name).toBe('Blue')
    })
  })
})
