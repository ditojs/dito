import type { ModelProperties } from '@ditojs/server'
import {
  Controller,
  Model,
  ModelController,
  UserModel
} from '@ditojs/server'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createTestDatabase } from '../utils/database.js'

class Member extends UserModel {
  declare id: number
  declare username: string
  declare roles: string[]

  static override properties: ModelProperties = {
    roles: {
      type: 'array',
      items: { type: 'string' }
    }
  }
}

class Recipe extends Model {
  declare id: number
  declare title: string
  declare ownerId: number

  static override properties: ModelProperties = {
    title: {
      type: 'string',
      required: true
    },
    ownerId: {
      type: 'integer'
    }
  }

  $hasOwner(user: Member) {
    return this.ownerId === user.id
  }
}

class Members extends ModelController<any> {
  override modelClass = Member

  override collection: any = {
    allow: ['get'],
    authorize: 'admin'
  }

  override member: any = {
    allow: ['get', 'patch'],
    authorize: ['$self', 'admin']
  }
}

class Recipes extends ModelController<any> {
  override modelClass = Recipe

  // Controller-level fallback for all actions without their own setting.
  override authorize: any = 'cook'

  override collection: any = {
    'allow': ['get', 'post'],
    'authorize': {
      get: true
    },

    'get secret': {
      authorize: false,
      handler() {
        return 'never'
      }
    },

    'get chef-only': {
      // Functions can return any other supported authorize setting.
      authorize: (ctx: any) => (ctx.query.as === 'chef' ? 'chef' : true),
      handler() {
        return 'cooked'
      }
    },

    'get forgetful': {
      // Functions that don't return a value deny access.
      authorize: () => {},
      handler() {
        return 'never'
      }
    }
  }

  override member: any = {
    'allow': ['get', 'patch', 'delete'],
    'authorize': {
      patch: '$owner',
      delete: async (ctx: any, recipe: any) => (
        ctx.state.user?.$hasRole('admin') ?? false
      )
    },

    'post rename': {
      authorize: '$owner',
      parameters: {
        recipe: {
          from: 'member'
        },
        title: {
          type: 'string',
          required: true
        }
      },
      async handler(ctx: any, { recipe, title }: any) {
        return recipe.$query().patchAndFetch({ title })
      }
    }
  }
}

describe('Controller authorization', () => {
  const app = createTestApp({
    models: { Member, Recipe },
    controllers: { Members, Recipes },
    // Resolve the requesting user from a header, in place of a session.
    async middleware(ctx: any, next: any) {
      const id = ctx.get('x-member-id')
      if (id) {
        ctx.state.user = await Member.query().findById(id)
      }
      await next()
    }
  })

  let url: string
  let admin: Member
  let cook: Member
  let guest: Member

  const request = async (
    path: string,
    user: Member | null,
    { method = 'GET', body }: { method?: string; body?: any } = {}
  ) => {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        ...(user && { 'x-member-id': `${user.id}` })
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    const isJson = response.headers
      .get('content-type')
      ?.startsWith('application/json')
    return {
      status: response.status,
      data: isJson ? await response.json() : await response.text()
    }
  }

  beforeAll(async () => {
    await createTestDatabase(app)
    // The computed `password` property isn't stored in the database.
    await app.knex.schema.alterTable('Member', table => {
      table.dropColumn('password')
    })
    await app.start()
    url = getAppUrl(app)
    ;[admin, cook, guest] = await Member.query().insert([
      { username: 'admin', roles: ['admin'] },
      { username: 'cook', roles: ['cook'] },
      { username: 'guest', roles: [] }
    ] as any[])
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  afterEach(async () => {
    await app.knex('Recipe').del()
  })

  describe('role-based authorization', () => {
    it('denies role-protected actions without a user', async () => {
      const response = await request('/members', null)
      expect(response.status).toBe(401)
      expect(response.data.message).toBe('Unauthorized Access')
    })

    it('denies role-protected actions to users without the role', async () => {
      expect((await request('/members', guest)).status).toBe(401)
    })

    it('allows role-protected actions to users with the role', async () => {
      const response = await request('/members', admin)
      expect(response.status).toBe(200)
      expect(response.data).toHaveLength(3)
    })

    it('falls back to the controller-level `authorize` setting', async () => {
      const body = { title: 'Soup' }
      const denied = await request('/recipes', guest, { method: 'POST', body })
      expect(denied.status).toBe(401)
      const created = await request('/recipes', cook, {
        method: 'POST',
        body
      })
      expect(created.status).toBe(201)
    })

    it('prefers action-level over controller-level settings', async () => {
      expect((await request('/recipes', null)).status).toBe(200)
    })
  })

  describe('`$self` authorization', () => {
    it('allows users to access their own member', async () => {
      const response = await request(`/members/${guest.id}`, guest)
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ username: 'guest' })
      // The password hash is hidden from the response.
      expect(response.data).not.toHaveProperty('hash')
    })

    it('denies users access to other members', async () => {
      const response = await request(`/members/${cook.id}`, guest)
      expect(response.status).toBe(401)
    })

    it('allows other roles listed next to `$self`', async () => {
      const response = await request(`/members/${cook.id}`, admin, {
        method: 'PATCH',
        body: { roles: ['cook', 'chef'] }
      })
      expect(response.status).toBe(200)
      expect(response.data.roles).toEqual(['cook', 'chef'])
    })
  })

  describe('`$owner` authorization', () => {
    it('fetches the member to ask it for its owner', async () => {
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        ownerId: cook.id
      })
      const denied = await request(`/recipes/${recipe.id}`, admin, {
        method: 'PATCH',
        body: { title: 'Stew' }
      })
      expect(denied.status).toBe(401)
      const patched = await request(`/recipes/${recipe.id}`, cook, {
        method: 'PATCH',
        body: { title: 'Stew' }
      })
      expect(patched.status).toBe(200)
      expect(patched.data.title).toBe('Stew')
    })

    it('uses the member resolved by the action parameters', async () => {
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        ownerId: cook.id
      })
      const denied = await request(`/recipes/${recipe.id}/rename`, guest, {
        method: 'POST',
        body: { title: 'Broth' }
      })
      expect(denied.status).toBe(401)
      const renamed = await request(`/recipes/${recipe.id}/rename`, cook, {
        method: 'POST',
        body: { title: 'Broth' }
      })
      expect(renamed.status).toBe(200)
      expect(renamed.data.title).toBe('Broth')
    })

    it('responds with 404 for missing members before authorizing', async () => {
      const response = await request('/recipes/999999', cook, {
        method: 'PATCH',
        body: { title: 'Stew' }
      })
      expect(response.status).toBe(404)
    })
  })

  describe('boolean and function authorization', () => {
    it('always denies actions with `authorize: false`', async () => {
      expect((await request('/recipes/secret', admin)).status).toBe(401)
    })

    it('passes the result of authorize functions on as settings', async () => {
      expect((await request('/recipes/chef-only', null)).data).toBe('cooked')
      const denied = await request('/recipes/chef-only?as=chef', guest)
      expect(denied.status).toBe(401)
    })

    it('denies access when authorize functions return nothing', async () => {
      expect((await request('/recipes/forgetful', admin)).status).toBe(401)
    })

    it('supports async authorize functions', async () => {
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        ownerId: cook.id
      })
      const path = `/recipes/${recipe.id}`
      expect((await request(path, cook, { method: 'DELETE' })).status).toBe(
        401
      )
      const deleted = await request(path, admin, { method: 'DELETE' })
      expect(deleted.status).toBe(200)
      expect(deleted.data).toEqual({ count: 1 })
    })
  })
})

describe('Controller authorize settings', () => {
  it('rejects unsupported authorize settings during setup', async () => {
    class Kitchen extends Controller {
      override actions: any = {
        'authorize': 42,
        'get stove'() {
          return 'hot'
        }
      }
    }
    const app = createTestApp({ controllers: { Kitchen } })
    await expect(app.setup()).rejects.toThrow(
      `Controller Kitchen: Unsupported authorize setting: '42'`
    )
    await app.knex.destroy()
  })

  it('rejects actions without a handler during setup', async () => {
    class Kitchen extends Controller {
      override actions: any = {
        'get stove': {
          authorize: true
        }
      }
    }
    const app = createTestApp({ controllers: { Kitchen } })
    await expect(app.setup()).rejects.toThrow(
      /Controller Kitchen: Missing handler in 'get stove' action/
    )
    await app.knex.destroy()
  })
})
