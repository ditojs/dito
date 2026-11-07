import { defineEntity, p } from '@mikro-orm/core'
import { createApi, createHono } from '@ditojs/server'
import { createMikroAdapter, defineModelController } from './index.ts'
import { createTestDatabase } from '../../../tests/utils/database.ts'
import { createClient } from '../../../tests/utils/client.ts'

// Members of clubs, with getters that read columns and formulas of their row.
// `initials` and `memberCount` are formulas, `visits` is a lazy one.
// `Club.label` is a getter of a related row.

const ClubSchema = defineEntity({
  name: 'Club',
  properties: {
    id: p.integer().primary(),
    name: p.string(),
    city: p.string(),
    memberCount: p
      .integer()
      .formula(
        cols =>
          `(select count(*)::int from member where member.club_id = ${cols.id})`
      ),
    label: p.string().persist(false).getter(),
    members: () => p.oneToMany(Member).mappedBy('club')
  }
})
class Club extends ClubSchema.class {
  get label() {
    return `${this.name}, ${this.city} (${this.memberCount})`
  }
}
ClubSchema.setClass(Club)

const MemberSchema = defineEntity({
  name: 'Member',
  properties: {
    id: p.integer().primary(),
    firstName: p.string(),
    lastName: p.string(),
    email: p.string().nullable(),
    initials: p
      .string()
      .formula(
        cols => `left(${cols.firstName}, 1) || left(${cols.lastName}, 1)`
      ),
    visits: p
      .integer()
      .formula(cols => `(${cols.id} * 10)`)
      .lazy(),
    fullName: p.string().persist(false).getter(),
    badge: p.string().persist(false).getter(),
    club: () => p.manyToOne(Club).nullable()
  }
})
class Member extends MemberSchema.class {
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  get badge() {
    return `${this.initials}-${this.id}`
  }
}
MemberSchema.setClass(Member)

const { orm, sql, drop } = await createTestDatabase([Club, Member])

beforeAll(async () => {
  await sql(`insert into club (id, name, city) values (1, 'Chess', 'Basel')`)
  await sql(
    `insert into member (id, first_name, last_name, email, club_id) values ` +
    `(1, 'Ada', 'Lovelace', 'ada@example.com', 1), ` +
    `(2, 'Alan', 'Turing', null, null)`
  )
})

afterAll(drop)

// Lists the members in the shape of `fields`, with the queries that it runs.
async function list(fields: string[]) {
  const api = createHono().route(
    '/api',
    createApi({
      controllers: [
        defineModelController({
          path: 'members',
          authorize: true,
          entity: Member,
          find: { fields, orderBy: { id: 'asc' } },
          actions: { get: true }
        })
      ],
      adapter: createMikroAdapter(orm),
      onError: () => {}
    })
  )
  const queries: string[] = []
  const logger = orm.config.getLogger()
  const spy = vi
    .spyOn(logger, 'logQuery')
    .mockImplementation(({ query }) => void queries.push(query ?? ''))
  const debug = orm.config.get('debug')
  orm.config.set('debug', ['query'])
  try {
    const { data } = await createClient(api.fetch).request(
      'GET',
      '/api/members'
    )
    return { rows: data, queries }
  } finally {
    orm.config.set('debug', debug)
    spy.mockRestore()
  }
}

describe('`fields`', () => {
  it('loads the columns that a getter reads', async () => {
    const { rows } = await list(['fullName'])
    expect(rows).toEqual([
      { id: 1, fullName: 'Ada Lovelace' },
      { id: 2, fullName: 'Alan Turing' }
    ])
  })

  it('selects a formula only where `fields` names it', async () => {
    const plain = await list(['firstName'])
    expect(plain.rows[0]).toEqual({ id: 1, firstName: 'Ada' })
    expect(plain.queries.join()).not.toMatch(/left\(/)
    const named = await list(['firstName', 'initials'])
    expect(named.rows[0]).toEqual({ id: 1, firstName: 'Ada', initials: 'AL' })
    expect(named.queries.join()).toMatch(/left\(/)
  })

  it('loads the formulas of the row of a getter', async () => {
    const { rows, queries } = await list(['badge', 'club.name'])
    expect(rows[0]).toEqual({
      id: 1,
      badge: 'AL-1',
      club: { id: 1, name: 'Chess' }
    })
    // Neither lazy formulas nor those of other rows:
    expect(queries.join()).not.toMatch(/\* 10|count\(/)
  })

  it('loads only the relations that `fields` reaches', async () => {
    const plain = await list(['firstName', 'club'])
    expect(plain.rows[0]).toEqual({ id: 1, firstName: 'Ada', club: { id: 1 } })
    expect(plain.queries.join()).not.toMatch(/"club"/)
    const reached = await list(['firstName', 'club.city'])
    expect(reached.rows[0]).toEqual({
      id: 1,
      firstName: 'Ada',
      club: { id: 1, city: 'Basel' }
    })
    expect(reached.queries.join()).toMatch(/"club"/)
  })

  it('loads the named columns of a related row', async () => {
    const { rows, queries } = await list(['firstName', 'club.name'])
    expect(rows[0]).toEqual({
      id: 1,
      firstName: 'Ada',
      club: { id: 1, name: 'Chess' }
    })
    expect(queries.join()).not.toMatch(/"city"/)
  })

  it('loads the columns and formulas of a related row for its getter', async () => {
    const { rows } = await list(['firstName', 'club.label'])
    expect(rows[0]).toEqual({
      id: 1,
      firstName: 'Ada',
      club: { id: 1, label: 'Chess, Basel (1)' }
    })
  })

  it('sends each field alone as in the full row', async () => {
    const fields = [
      'firstName',
      'lastName',
      'email',
      'initials',
      'visits',
      'fullName',
      'badge',
      'club.name',
      'club.memberCount',
      'club.label'
    ]
    const full = (await list(fields)).rows
    for (const field of fields) {
      const [key, nested] = field.split('.')
      const { rows } = await list([field])
      expect(rows).toEqual(
        full.map((row: Record<string, any>) => ({
          id: row.id,
          [key!]:
            nested && row[key!]
              ? { id: row[key!].id, [nested]: row[key!][nested] }
              : row[key!]
        }))
      )
    }
  })
})
