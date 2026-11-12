import type {
  ModelControllerActions,
  ModelControllerMemberActions,
  ModelProperties
} from '@ditojs/server'
import { ModelController, TimestampedModel } from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Step extends TimestampedModel {
  declare id: number
  declare title: string
  declare planId: number | null

  static override properties: ModelProperties = {
    title: { type: 'string', required: true },
    planId: { type: 'integer', foreign: true, nullable: true }
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
    }
  }

  static override scopes = {
    withSteps: (query: any) => query.withGraphFetched('steps')
  }
}

class Plans extends ModelController<Plan> {
  override modelClass = Plan
  override collection: ModelControllerActions<this> = { allow: ['get'] }
  override member: ModelControllerMemberActions<this> = {
    allow: ['get', 'patch']
  }

  override scope = ['^withSteps']
  override graph = true
  override delta = true
}

// A controller whose `patch` handler reads whole plans:
class WholePlans extends Plans {
  override member: ModelControllerMemberActions<this> = {
    allow: ['get', 'patch'],
    patch: {
      delta: false,
      handler(ctx: any) {
        return super.patch(ctx)
      }
    }
  } as any
}

class PlainPlans extends Plans {
  override graph = false
}

// Steps have no version, so their controllers take no deltas:
class Steps extends ModelController<Step> {
  override modelClass = Step
  override member: ModelControllerMemberActions<this> = {
    allow: ['get', 'patch']
  }

  override graph = true
  override delta = true
}

describe('Controllers with deltas', () => {
  const app = createTestApp({
    models: { Plan, Step },
    controllers: { Plans, WholePlans, PlainPlans, Steps },
    config: { app: { normalizePaths: true, helmet: false } }
  })

  beforeAll(async () => {
    await createTestDatabase(app)
    await app.start()
  })

  afterAll(async () => {
    await app.stop()
    await app.knex?.destroy()
  })

  afterEach(async () => {
    await app.knex('Step').del()
    await app.knex('Plan').del()
  })

  async function insertPlan() {
    return Plan.query().insertGraphAndFetch({
      name: 'Plan',
      steps: [{ title: 'One' }, { title: 'Two' }]
    })
  }

  function getPlanUrl(plan: Plan, path = 'plans') {
    return `${getAppUrl(app)}/${path}/${plan.id}`
  }

  // Patch with the version of the loaded plan, unless `version` is false:
  async function patch(url: string, body: object, version = true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (version) {
      headers['Dito-Record-Version'] = (await fetch(url)).headers.get(
        'Dito-Record-Version'
      )!
    }
    return fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) })
  }

  it('sends the record graph of members', async () => {
    const plan = await insertPlan()
    const response = await fetch(getPlanUrl(plan))
    expect(JSON.parse(response.headers.get('Dito-Record-Graph')!)).toEqual({
      steps: {}
    })
    const { headers } = await fetch(getPlanUrl(plan, 'whole-plans'))
    expect(headers.get('Dito-Record-Graph')).toBeNull()
    // Controllers without `graph` write no relations:
    const plainResponse = await fetch(getPlanUrl(plan, 'plain-plans'))
    expect(plainResponse.headers.get('Dito-Record-Graph')).toBe('{}')
    const listResponse = await fetch(`${getAppUrl(app)}/plans`)
    expect(listResponse.headers.get('Dito-Record-Graph')).toBeNull()
  })

  it('applies deltas against the plan that was loaded', async () => {
    const plan = await insertPlan()
    const [one] = plan.steps
    const url = getPlanUrl(plan)
    const version = (await fetch(url)).headers.get('Dito-Record-Version')!
    const send = (body: object) =>
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Dito-Record-Version': version
        },
        body: JSON.stringify({ '#delta': true, ...body })
      })
    const response = await send({
      steps: [{ 'id': one.id, '#removed': true }, { title: 'Three' }]
    })
    expect(response.status).toBe(200)
    const saved = await response.json()
    expect(saved.steps.map((step: Step) => step.title).sort()).toEqual([
      'Three',
      'Two'
    ])
    expect(saved.name).toBe('Plan')
    // Deltas of only relations still write the next version:
    expect(response.headers.get('Dito-Record-Version')).not.toBe(version)
    expect((await send({ name: 'A' })).status).toBe(412)
  })

  it('refuses deltas for handlers that read whole plans', async () => {
    const plan = await insertPlan()
    const url = getPlanUrl(plan, 'whole-plans')
    const response = await patch(url, { '#delta': true, 'name': 'A' })
    expect(response.status).toBe(400)
    expect((await Plan.query().findById(plan.id))!.name).toBe('Plan')
  })

  it('applies deltas without `graph` as patches', async () => {
    const plan = await insertPlan()
    const url = getPlanUrl(plan, 'plain-plans')
    const version = (await fetch(url)).headers.get('Dito-Record-Version')
    const unchanged = await patch(url, { '#delta': true })
    expect(unchanged.status).toBe(200)
    expect(unchanged.headers.get('Dito-Record-Version')).toBe(version)
    const response = await patch(url, { '#delta': true, 'name': 'A' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Dito-Record-Version')).not.toBe(version)
    expect((await Plan.query().findById(plan.id))!.name).toBe('A')
  })

  it('keeps the version for deltas without changes', async () => {
    const plan = await insertPlan()
    const url = getPlanUrl(plan)
    const version = (await fetch(url)).headers.get('Dito-Record-Version')
    const response = await patch(url, { '#delta': true })
    expect(response.status).toBe(200)
    expect(response.headers.get('Dito-Record-Version')).toBe(version)
  })

  it('refuses deltas that are not true', async () => {
    const plan = await insertPlan()
    const response = await patch(getPlanUrl(plan), {
      '#delta': false,
      'name': 'A'
    })
    expect(response.status).toBe(400)
    expect((await Plan.query().findById(plan.id))!.name).toBe('Plan')
  })

  it('refuses deltas without the version of the plan', async () => {
    const plan = await insertPlan()
    const response = await patch(
      getPlanUrl(plan),
      { '#delta': true, 'name': 'A' },
      false
    )
    expect(response.status).toBe(428)
    expect((await Plan.query().findById(plan.id))!.name).toBe('Plan')
  })

  it('takes no deltas for models without a version', async () => {
    const plan = await insertPlan()
    const url = `${getAppUrl(app)}/steps/${plan.steps[0].id}`
    const { headers } = await fetch(url)
    expect(headers.get('Dito-Record-Graph')).toBeNull()
    const response = await patch(url, { '#delta': true, 'title': 'A' }, false)
    expect(response.status).toBe(400)
  })
})
