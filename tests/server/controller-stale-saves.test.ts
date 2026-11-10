import type {
  ModelControllerActions,
  ModelControllerMemberActions,
  ModelProperties
} from '@ditojs/server'
import { Model, ModelController, TimestampedModel } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Step extends Model {
  declare id: number
  declare title: string
  declare planId: number | null
  declare noteId: number | null

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    planId: { type: 'integer', foreign: true, nullable: true },
    noteId: { type: 'integer', foreign: true, nullable: true }
  }
}

// Briefs keep their version hidden, which only the header shows:
class Brief extends Model {
  declare id: number
  declare text: string
  declare planId: number

  static override properties: ModelProperties = {
    text: { type: 'string', required: true },
    planId: { type: 'integer', foreign: true },
    revision: { type: 'integer', default: 0, version: true, hidden: true }
  }
}

// The pivot table of tags joins the queries of their relation members:
class Tag extends Model {
  declare id: number
  declare name: string

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    revision: { type: 'integer', default: 0, version: true }
  }
}

class Plan extends TimestampedModel {
  declare id: number
  declare name: string
  declare steps: Step[]

  static override properties: ModelProperties = {
    name: { type: 'string', required: true },
    updatedAt: { type: 'timestamp', default: 'now()', version: true }
  }

  static override relations: any = {
    steps: {
      relation: 'hasMany',
      from: 'Plan.id',
      to: 'Step.planId',
      owner: true
    },
    briefs: {
      relation: 'hasMany',
      from: 'Plan.id',
      to: 'Brief.planId',
      owner: true
    },
    tags: {
      relation: 'manyToMany',
      from: 'Plan.id',
      to: 'Tag.id',
      through: {
        from: 'PlanTag.planId',
        to: 'PlanTag.tagId'
      }
    }
  }

  static override scopes = {
    withSteps: (query: any) => query.withGraphFetched('steps'),
    nameOnly: (query: any) => query.select('id', 'name')
  }
}

class Note extends Model {
  declare id: number
  declare text: string
  declare revision: number
  declare steps: Step[]

  static override properties: ModelProperties = {
    text: { type: 'string', required: true },
    revision: { type: 'integer', default: 0, version: true }
  }

  static override relations: any = {
    steps: {
      relation: 'hasMany',
      from: 'Note.id',
      to: 'Step.noteId',
      owner: true
    }
  }

  static override scopes = {
    withSteps: (query: any) => query.withGraphFetched('steps')
  }
}

const memberActions = { allow: ['get', 'patch', 'put'] }

class Plans extends ModelController<Plan> {
  override modelClass = Plan
  override collection: ModelControllerActions<this> = { allow: ['post'] }
  override member: ModelControllerMemberActions<this> = memberActions as any
  override scope = ['^withSteps']
  override graph = true
}

class GraphlessPlans extends Plans {
  override graph = false
}

// A scope that leaves out the version:
class NamedPlans extends Plans {
  override scope = ['^nameOnly']
  override graph = false
}

class Notes extends ModelController<Note> {
  override modelClass = Note
  override member: ModelControllerMemberActions<this> = memberActions as any
}

class GraphNotes extends Notes {
  override scope = ['^withSteps']
  override graph = true
}

// Notes that their hook patches once more after each save:
class TouchedNotes extends Notes {
  static override hooks: any = {
    async 'after:member:patch'(ctx: any, note: Note) {
      await note.$query(ctx.transaction).patch({ text: `${note.text}!` })
    }
  }
}

class BriefedPlans extends ModelController<Plan> {
  override modelClass = Plan
  override relations: any = {
    briefs: {
      relation: { allow: ['get'] },
      member: memberActions
    },
    tags: {
      relation: { allow: ['get'] },
      member: memberActions
    }
  }
}

class Steps extends ModelController<Step> {
  override modelClass = Step
  override member: ModelControllerMemberActions<this> = memberActions as any
}

describe('Controllers with stale saves', () => {
  const app = createTestApp({
    models: { Plan, Step, Note, Brief, Tag },
    controllers: {
      Plans,
      GraphlessPlans,
      NamedPlans,
      Notes,
      GraphNotes,
      TouchedNotes,
      Steps,
      BriefedPlans
    },
    config: { app: { normalizePaths: true, helmet: false } }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.knex.schema.createTable('PlanTag', table => {
      table.integer('planId')
      table.integer('tagId')
      table.integer('revision')
    })
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex?.destroy()
  })

  afterEach(async () => {
    await app.knex('Step').del()
    await app.knex('Brief').del()
    await app.knex('PlanTag').del()
    await app.knex('Tag').del()
    await app.knex('Plan').del()
    await app.knex('Note').del()
  })

  async function insertPlan() {
    return Plan.query().insertGraphAndFetch({
      name: 'Plan',
      steps: [{ title: 'One' }, { title: 'Two' }]
    })
  }

  function getUrl(path: string, id: number) {
    return `${getAppUrl(app)}/${path}/${id}`
  }

  // The version of the loaded record, which its saves send back:
  async function loadVersion(url: string) {
    const { headers } = await fetch(url)
    return { 'Dito-Record-Version': headers.get('Dito-Record-Version')! }
  }

  function save(
    url: string,
    body: object,
    headers: Record<string, string>,
    method = 'PATCH'
  ) {
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    })
  }

  it('sends the version of records', async () => {
    const plan = await insertPlan()
    const { 'Dito-Record-Version': version } = await loadVersion(
      getUrl('plans', plan.id)
    )
    expect(version).toBe(JSON.stringify(plan.updatedAt.toISOString()))
    const response = await fetch(`${getAppUrl(app)}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' })
    })
    expect(response.headers.get('Dito-Record-Version')).toMatch(/^"\d{4}-/)
    // Models without a version send none:
    const [step] = plan.steps
    const { headers } = await fetch(getUrl('steps', step.id))
    expect(headers.get('Dito-Record-Version')).toBeNull()
  })

  it('refuses saves of records that changed since', async () => {
    const plan = await insertPlan()
    for (const path of ['plans', 'graphless-plans']) {
      const url = getUrl(path, plan.id)
      const headers = await loadVersion(url)
      const response = await save(url, { name: `A ${path}` }, headers)
      expect(response.status).toBe(200)
      expect((await save(url, { name: 'B' }, headers)).status).toBe(412)
      // The version of the response is that of the saved record:
      const saved = {
        'Dito-Record-Version': response.headers.get('Dito-Record-Version')!
      }
      expect(saved).toEqual(await loadVersion(url))
      expect((await save(url, { name: 'C' }, saved)).status).toBe(200)
    }
    expect((await Plan.query().findById(plan.id))!.name).toBe('C')
  })

  it('writes a new version when a save only changes relations', async () => {
    const plan = await insertPlan()
    const url = getUrl('plans', plan.id)
    const headers = await loadVersion(url)
    const steps = plan.steps.map(({ id, title }) => ({ id, title }))
    steps[0].title = 'Changed'
    const response = await save(url, { steps }, headers)
    expect(response.status).toBe(200)
    expect(response.headers.get('Dito-Record-Version')).not.toBe(
      headers['Dito-Record-Version']
    )
    expect((await save(url, { name: 'B' }, headers)).status).toBe(412)
  })

  it('ignores versions in the body', async () => {
    const plan = await insertPlan()
    const url = getUrl('plans', plan.id)
    const updatedAt = new Date(Date.now() + 86_400_000).toISOString()
    // Checked and unchecked saves write the next version in its place:
    const body = { ...plan.toJSON(), name: 'A', updatedAt }
    const checked = await save(url, body, await loadVersion(url), 'PUT')
    expect((await checked.json()).updatedAt).not.toBe(updatedAt)
    const unchecked = await save(url, { updatedAt }, {})
    expect((await unchecked.json()).updatedAt).not.toBe(updatedAt)
  })

  it('counts integer versions up, also on other updates', async () => {
    const note = await Note.query().insertAndFetch({ text: 'Note' })
    const url = getUrl('notes', note.id)
    expect(await loadVersion(url)).toEqual({ 'Dito-Record-Version': '0' })
    await Note.query().findById(note.id).patch({ text: 'Changed' })
    const headers = await loadVersion(url)
    expect(headers).toEqual({ 'Dito-Record-Version': '1' })
    const response = await save(url, { text: 'Saved' }, headers)
    expect(response.headers.get('Dito-Record-Version')).toBe('2')
    expect((await save(url, { text: 'B' }, headers)).status).toBe(412)
  })

  it('counts integer versions up once when a save only changes relations', async () => {
    const note = await Note.query().insertGraphAndFetch({
      text: 'Note',
      steps: [{ title: 'One' }]
    })
    const url = getUrl('graph-notes', note.id)
    const headers = await loadVersion(url)
    const steps = [{ id: note.steps[0].id, title: 'Changed' }]
    const response = await save(url, { steps }, headers)
    expect(response.status).toBe(200)
    expect(response.headers.get('Dito-Record-Version')).toBe('1')
    expect((await save(url, { steps }, headers)).status).toBe(412)
  })

  it('sends the version that hooks write after saves', async () => {
    const note = await Note.query().insertAndFetch({ text: 'Note' })
    const url = getUrl('touched-notes', note.id)
    const response = await save(url, { text: 'Saved' }, await loadVersion(url))
    expect(response.headers.get('Dito-Record-Version')).toBe('2')
    expect(await response.json()).toMatchObject({
      text: 'Saved!',
      revision: 2
    })
  })

  it('refuses stale saves of relation members', async () => {
    const plan = await insertPlan()
    const brief = await Brief.query().insertAndFetch({
      text: 'Brief',
      planId: plan.id
    })
    const url = `${getUrl('briefed-plans', plan.id)}/briefs/${brief.id}`
    const headers = await loadVersion(url)
    expect(headers).toEqual({ 'Dito-Record-Version': '0' })
    const response = await save(url, { text: 'A' }, headers)
    expect(response.headers.get('Dito-Record-Version')).toBe('1')
    // The version stays hidden in the body:
    expect(await response.json()).not.toHaveProperty('revision')
    expect((await save(url, { text: 'B' }, headers)).status).toBe(412)
  })

  it('refuses stale saves of many-to-many relation members', async () => {
    const plan = await insertPlan()
    const tag = await Tag.query().insertAndFetch({ name: 'Tag' })
    await app.knex('PlanTag').insert({
      planId: plan.id,
      tagId: tag.id,
      revision: 7
    })
    const url = `${getUrl('briefed-plans', plan.id)}/tags/${tag.id}`
    const headers = await loadVersion(url)
    expect(headers).toEqual({ 'Dito-Record-Version': '0' })
    const response = await save(url, { name: 'A' }, headers)
    expect(response.status).toBe(200)
    expect(response.headers.get('Dito-Record-Version')).toBe('1')
    expect((await save(url, { name: 'B' }, headers)).status).toBe(412)
  })

  it('reads versions that the scope leaves out', async () => {
    const plan = await insertPlan()
    const url = getUrl('named-plans', plan.id)
    const headers = await loadVersion(url)
    expect(headers['Dito-Record-Version']).toBe(
      JSON.stringify(plan.updatedAt.toISOString())
    )
    expect((await save(url, { name: 'A' }, headers)).status).toBe(200)
    expect((await save(url, { name: 'B' }, headers)).status).toBe(412)
  })

  it('checks no saves without a version', async () => {
    const plan = await insertPlan()
    const url = getUrl('plans', plan.id)
    expect((await save(url, { name: 'A' }, {})).status).toBe(200)
    expect((await save(url, { name: 'B' }, {})).status).toBe(200)
  })

  it('writes no version when unchecked saves change nothing', async () => {
    const plan = await insertPlan()
    const url = getUrl('plans', plan.id)
    const loaded = await (await fetch(url)).json()
    const response = await save(url, loaded, {})
    expect((await response.json()).updatedAt).toBe(loaded.updatedAt)
  })

  it('responds to saves of missing records with 404', async () => {
    const plan = await insertPlan()
    const headers = await loadVersion(getUrl('plans', plan.id))
    const url = getUrl('plans', plan.id + 1000)
    expect((await save(url, { name: 'A' }, headers)).status).toBe(404)
  })
})
