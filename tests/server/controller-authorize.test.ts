import type { ModelProperties, ModelScopes } from '@ditojs/server'
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

  static override relations: any = {
    recipes: {
      relation: 'hasMany',
      from: 'Member.id',
      to: 'Recipe.ownerId'
    }
  }
}

class Cookbook extends Model {
  declare id: number
  declare title: string
  declare ownerId: number
  declare published: boolean

  static override properties: ModelProperties = {
    title: {
      type: 'string',
      required: true
    },
    ownerId: {
      type: 'integer'
    },
    published: {
      type: 'boolean',
      default: false
    }
  }

  static override scopes: ModelScopes<Cookbook> = {
    published: query => query.where('published', true)
  }

  static override relations: any = {
    recipes: {
      relation: 'hasMany',
      from: 'Cookbook.id',
      to: 'Recipe.cookbookId'
    }
  }

  $hasOwner(user: Member) {
    return this.ownerId === user.id
  }
}

// The related model of the `review` relation holds its foreign key, different
// from `Cookbook`, which the `cookbook` relation references.
class Review extends Model {
  declare id: number
  declare text: string
  declare ownerId: number
  declare recipeId: number

  static override properties: ModelProperties = {
    text: {
      type: 'string',
      required: true
    },
    ownerId: {
      type: 'integer'
    },
    recipeId: {
      type: 'integer'
    }
  }

  $hasOwner(user: Member) {
    return this.ownerId === user.id
  }
}

class Recipe extends Model {
  declare id: number
  declare title: string
  declare ownerId: number
  declare cookbookId: number | null

  static override properties: ModelProperties = {
    title: {
      type: 'string',
      required: true
    },
    ownerId: {
      type: 'integer'
    },
    cookbookId: {
      type: 'integer',
      nullable: true
    }
  }

  static override relations: any = {
    cookbook: {
      relation: 'belongsTo',
      from: 'Recipe.cookbookId',
      to: 'Cookbook.id'
    },
    review: {
      relation: 'hasOne',
      from: 'Recipe.id',
      to: 'Review.recipeId'
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

  // Relations are authorized for their parent member first, here through the
  // member-level `$self` setting.
  override relations: any = {
    recipes: {
      relation: {
        allow: ['get']
      }
    }
  }
}

// Selects only some columns in `member.get`, which must not affect queries of
// the relations.
class RecipeTitles extends ModelController<any> {
  override modelClass = Recipe
  override authorize: any = 'cook'

  override member: any = {
    allow: ['get'],
    get(this: any, ctx: any, modify: any) {
      return this.controller.fetchMember(ctx, {
        id: ctx.memberId,
        modify: (query: any) => {
          query.select('id', 'title', 'ownerId')
          modify?.(query)
        }
      })
    }
  }

  override relations: any = {
    cookbook: {
      relation: {
        'allow': [],
        'get published-title': {
          parameters: {
            cookbook: {
              from: 'member'
            }
          },
          handler(ctx: any, { cookbook }: any) {
            return { title: cookbook.title }
          }
        }
      }
    }
  }
}

class Cookbooks extends ModelController<any> {
  override modelClass = Cookbook

  // Members of hidden parents also hide their relations.
  override scope = 'published'

  // `$owner` is checked against the cookbook, also for its relations.
  override authorize: any = ['$owner', 'admin']

  override collection: any = {
    allow: ['get'],
    authorize: 'admin'
  }

  override member: any = {
    allow: ['get', 'patch'],
    authorize: {
      patch: 'admin'
    }
  }

  override relations: any = {
    recipes: {
      relation: {
        allow: ['get', 'post']
      },
      member: {
        allow: ['get']
      }
    }
  }
}

// Authorizes relating recipes itself, so that relating only requires the
// cookbook's `get` authorization, not its `patch` authorization.
class SharedCookbooks extends ModelController<any> {
  override modelClass = Cookbook
  override scope = 'published'
  override authorize: any = ['$owner', 'admin']

  override member: any = {
    allow: ['get', 'patch'],
    authorize: {
      patch: 'admin'
    }
  }

  override relations: any = {
    recipes: {
      relation: {
        allow: ['get', 'post'],
        authorize: {
          post: 'cook'
        }
      }
    }
  }
}

// Only routes and authorizes `member.get`, so its `patch` authorization is
// open, which must not open the changes of its relations.
class ReadOnlyCookbooks extends ModelController<any> {
  override modelClass = Cookbook

  override member: any = {
    allow: ['get'],
    authorize: {
      get: 'admin'
    }
  }

  override relations: any = {
    recipes: {
      relation: {
        allow: ['get', 'post']
      }
    }
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

  // One-to-one relations have no member actions, so their member is the
  // related model, resolved without a `member.get` override.
  override relations: any = {
    cookbook: {
      relation: {
        'allow': ['get'],
        'authorize': {
          get: '$owner'
        },

        'get title': {
          authorize: '$owner',
          parameters: {
            cookbook: {
              from: 'member'
            }
          },
          handler(ctx: any, { cookbook }: any) {
            return { title: cookbook.title }
          }
        },

        'get published-title': {
          scope: 'published',
          parameters: {
            cookbook: {
              from: 'member'
            }
          },
          handler(ctx: any, { cookbook }: any) {
            return { title: cookbook.title }
          }
        },

        // Fetches the related model by an explicit id, as overrides may.
        'get by-id': {
          parameters: {
            id: {
              type: 'integer',
              required: true
            }
          },
          async handler(this: any, ctx: any, { id }: any) {
            const cookbook = await this.controller.fetchMember(ctx, { id })
            return { title: cookbook.title }
          }
        }
      }
    },

    review: {
      relation: {
        'allow': ['get'],
        'authorize': {
          get: '$owner'
        },

        'get text': {
          authorize: '$owner',
          parameters: {
            review: {
              from: 'member'
            }
          },
          handler(ctx: any, { review }: any) {
            return { text: review.text }
          }
        }
      }
    }
  }
}

class Pantry extends Controller {
  override authorize: any = false

  override actions: any = {
    'get stock'() {
      return 'flour'
    }
  }
}

// Authorizes through its own fields, which sub-classes can override:
class Staff extends ModelController<any> {
  override modelClass = Member

  managerRole = 'admin'

  override collection: any = {
    allow: ['get'],
    authorize: {
      get(this: Staff) {
        return this.managerRole
      }
    }
  }

  override member: any = {
    allow: ['get', 'patch'],
    authorize: {
      get(this: Staff) {
        return ['$self', this.managerRole]
      },
      patch(this: Staff) {
        return this.managerRole
      }
    }
  }

  // In relations, `this` is the relation controller, below its `parent`:
  override relations: any = {
    recipes: {
      relation: {
        allow: ['get'],
        authorize: {
          get(this: any) {
            return this.parent.managerRole
          }
        }
      }
    }
  }
}

// Inherits the authorization of `get`, and overrides the one of `patch`:
class Kitchen extends Staff {
  override managerRole = 'cook'

  override member: any = {
    authorize: {
      patch() {
        return '$self'
      }
    }
  }
}

// Authorizes its actions on the actions themselves, which sub-classes inherit
// when they redefine them:
class Bakery extends Controller {
  override authorize: any = 'admin'

  override actions: any = {
    'get bread': {
      authorize: 'cook',
      handler() {
        return 'bread'
      }
    },

    'get cake': {
      authorize: true,
      handler() {
        return 'cake'
      }
    },

    'get pie': {
      authorize: 'cook',
      handler() {
        return 'pie'
      }
    },

    'get tart': {
      authorize: true,
      handler() {
        return 'tart'
      }
    },

    'get roll'() {
      return 'roll'
    },

    'get crumb': {
      authorize: false,
      handler() {
        return 'crumb'
      }
    }
  }
}

function bagel() {
  return 'bagel'
}
bagel.authorize = 'cook'

// Settings on actions objects rank above the actions of base classes:
class Bakehouse extends Bakery {
  override actions: any = {
    'authorize': true,
    'get bagel': bagel
  }
}

class Breadhouse extends Bakehouse {
  override actions: any = {
    'authorize': {
      'get crumb': true
    },

    'get bagel'(ctx: any) {
      return `fresh ${super['get bagel'](ctx)}`
    }
  }
}

class Patisserie extends Bakery {
  override actions: any = {
    'authorize': {
      'get pie': 'admin'
    },

    'get bread'(ctx: any) {
      return `fresh ${super['get bread'](ctx)}`
    },

    'get cake'(ctx: any) {
      return `fresh ${super['get cake'](ctx)}`
    },

    'get tart': {
      authorize: 'cook',
      handler(ctx: any) {
        return `fresh ${super['get tart'](ctx)}`
      }
    }
  }
}

class Confectionery extends Patisserie {
  override actions: any = {
    'get bread'(ctx: any) {
      return `sweet ${super['get bread'](ctx)}`
    },

    'get pie'(ctx: any) {
      return `sweet ${super['get pie'](ctx)}`
    }
  }
}

class Cookshelves extends ModelController<any> {
  override modelClass = Cookbook
  override authorize: any = 'admin'

  override member: any = {
    allow: ['get'],
    get: {
      authorize: true,
      handler(ctx: any, modify: any) {
        return super.get(ctx, modify)
      }
    }
  }

  override relations: any = {
    recipes: {
      authorize: 'admin',
      relation: {
        'allow': [],
        'get count': {
          authorize: 'cook',
          handler() {
            return 'count'
          }
        },
        'get size': {
          authorize: true,
          handler() {
            return 'size'
          }
        }
      },
      member: {
        'allow': [],
        'get label': {
          authorize: 'cook',
          handler() {
            return 'label'
          }
        }
      }
    }
  }
}

// Redefine the member and relation actions without their own `authorize`:
class MemberCookshelves extends Cookshelves {
  override member: any = {
    get(ctx: any, modify: any) {
      return super.get(ctx, modify)
    }
  }
}

class RelationCookshelves extends Cookshelves {
  override relations: any = {
    recipes: {
      relation: {
        'get count'(ctx: any) {
          return super['get count'](ctx)
        }
      },
      member: {
        'get label'(ctx: any) {
          return super['get label'](ctx)
        }
      }
    }
  }
}

describe('Controller authorization', () => {
  const app = createTestApp({
    models: { Member, Cookbook, Recipe, Review },
    controllers: {
      Members,
      Recipes,
      RecipeTitles,
      Cookbooks,
      SharedCookbooks,
      ReadOnlyCookbooks,
      Pantry,
      Staff,
      Kitchen,
      Bakery,
      Patisserie,
      Confectionery,
      Bakehouse,
      Breadhouse,
      MemberCookshelves,
      RelationCookshelves
    },
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
    await app.knex('Review').del()
    await app.knex('Recipe').del()
    await app.knex('Cookbook').del()
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

    it('resolves the related model of one-to-one relations', async () => {
      const cookbook = await Cookbook.query().insert({
        title: 'Soups',
        ownerId: cook.id
      })
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        cookbookId: cookbook.id
      })
      const path = `/recipes/${recipe.id}/cookbook`
      expect((await request(path, guest)).status).toBe(401)
      const response = await request(path, cook)
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ title: 'Soups' })
    })

    it("resolves `from: 'member'` in one-to-one relations", async () => {
      const cookbook = await Cookbook.query().insert({
        title: 'Soups',
        ownerId: cook.id
      })
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        cookbookId: cookbook.id
      })
      const path = `/recipes/${recipe.id}/cookbook/title`
      expect((await request(path, guest)).status).toBe(401)
      const response = await request(path, cook)
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ title: 'Soups' })
    })

    it('responds with 404 for empty one-to-one relations', async () => {
      const recipe = await Recipe.query().insert({ title: 'Soup' })
      const path = `/recipes/${recipe.id}/cookbook`
      expect((await request(path, cook)).status).toBe(404)
      expect((await request(`${path}/title`, cook)).status).toBe(404)
    })

    it('resolves the related model of hasOne relations', async () => {
      const recipe = await Recipe.query().insert({ title: 'Soup' })
      await Review.query().insert({
        text: 'Tasty',
        ownerId: cook.id,
        recipeId: recipe.id
      })
      const path = `/recipes/${recipe.id}/review`
      expect((await request(path, guest)).status).toBe(401)
      expect((await request(`${path}/text`, guest)).status).toBe(401)
      const response = await request(path, cook)
      expect(response.status).toBe(200)
      expect(response.data).toMatchObject({ text: 'Tasty' })
      const textResponse = await request(`${path}/text`, cook)
      expect(textResponse.status).toBe(200)
      expect(textResponse.data).toEqual({ text: 'Tasty' })
    })

    it('applies action scopes to one-to-one members', async () => {
      const cookbook = await Cookbook.query().insert({
        title: 'Soups',
        ownerId: cook.id
      })
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        cookbookId: cookbook.id
      })
      const path = `/recipes/${recipe.id}/cookbook/published-title`
      expect((await request(path, cook)).status).toBe(404)
      await cookbook.$query().patch({ published: true })
      const response = await request(path, cook)
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ title: 'Soups' })
    })

    it('respects explicit ids when fetching one-to-one members', async () => {
      const [cookbook, other] = await Cookbook.query().insert([
        { title: 'Soups', ownerId: cook.id },
        { title: 'Salads', ownerId: cook.id }
      ] as any[])
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        cookbookId: cookbook.id
      })
      const path = `/recipes/${recipe.id}/cookbook/by-id`
      const response = await request(`${path}?id=${cookbook.id}`, cook)
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ title: 'Soups' })
      expect((await request(`${path}?id=${other.id}`, cook)).status).toBe(404)
    })
  })

  describe('relation authorization', () => {
    const createCookbook = async (published = true) => {
      const cookbook = await Cookbook.query().insert({
        title: 'Soups',
        ownerId: cook.id,
        published
      })
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        ownerId: cook.id,
        cookbookId: cookbook.id
      })
      return { cookbook, recipe }
    }

    it('authorizes relations like the `get` action of their parent', async () => {
      await Recipe.query().insert({ title: 'Stew', ownerId: guest.id })
      const path = `/members/${guest.id}/recipes`
      expect((await request(path, null)).status).toBe(401)
      expect((await request(path, cook)).status).toBe(401)
      const own = await request(path, guest)
      expect(own.status).toBe(200)
      expect(own.data).toMatchObject([{ title: 'Stew' }])
      expect((await request(path, admin)).status).toBe(200)
    })

    it('falls back to the controller-level `authorize` setting', async () => {
      const { recipe } = await createCookbook()
      const path = `/recipes/${recipe.id}/cookbook/published-title`
      expect((await request(path, null)).status).toBe(401)
      expect((await request(path, guest)).status).toBe(401)
      expect((await request(path, cook)).status).toBe(200)
    })

    it('checks `$owner` against the parent member', async () => {
      const { cookbook, recipe } = await createCookbook()
      const path = `/cookbooks/${cookbook.id}/recipes`
      expect((await request(path, guest)).status).toBe(401)
      const list = await request(path, cook)
      expect(list.status).toBe(200)
      expect(list.data).toMatchObject([{ title: 'Soup' }])
      const member = await request(`${path}/${recipe.id}`, cook)
      expect(member.status).toBe(200)
      expect((await request(path, admin)).status).toBe(200)
    })

    it('authorizes relation changes like the `patch` action of their parent', async () => {
      const { cookbook } = await createCookbook()
      const stew = await Recipe.query().insert({
        title: 'Stew',
        ownerId: cook.id
      })
      const path = `/cookbooks/${cookbook.id}/recipes`
      const body = [{ id: stew.id }]
      const denied = await request(path, cook, { method: 'POST', body })
      expect(denied.status).toBe(401)
      expect((await Recipe.query().findById(stew.id))!.cookbookId).toBe(null)
      const related = await request(path, admin, { method: 'POST', body })
      expect(related.status).toBe(201)
      expect((await Recipe.query().findById(stew.id))!.cookbookId).toBe(
        cookbook.id
      )
    })

    it('authorizes changes that relations authorize themselves like the `get` action of their parent', async () => {
      const { cookbook } = await createCookbook()
      const stew = await Recipe.query().insert({
        title: 'Stew',
        ownerId: cook.id
      })
      const body = [{ id: stew.id }]
      // The owner may read the cookbook but not patch it, and is a cook.
      const path = `/shared-cookbooks/${cookbook.id}/recipes`
      const related = await request(path, cook, { method: 'POST', body })
      expect(related.status).toBe(201)
      expect((await Recipe.query().findById(stew.id))!.cookbookId).toBe(
        cookbook.id
      )
      // Users who may not read the cookbook still can't relate.
      expect(
        (await request(path, guest, { method: 'POST', body })).status
      ).toBe(
        401
      )
    })

    it('also requires the parent `get` authorization for changes', async () => {
      const { cookbook } = await createCookbook()
      const stew = await Recipe.query().insert({
        title: 'Stew',
        ownerId: cook.id
      })
      const path = `/read-only-cookbooks/${cookbook.id}/recipes`
      const body = [{ id: stew.id }]
      expect((await request(path, null)).status).toBe(401)
      expect((await request(path, null, { method: 'POST', body })).status).toBe(
        401
      )
      expect((await Recipe.query().findById(stew.id))!.cookbookId).toBe(null)
      const related = await request(path, admin, { method: 'POST', body })
      expect(related.status).toBe(201)
    })

    it('authorizes the parent before looking it up', async () => {
      const path = '/cookbooks/999999/recipes'
      expect((await request(path, null)).status).toBe(401)
      expect((await request(path, admin)).status).toBe(404)
    })

    it('queries relations independently of the parent `member.get`', async () => {
      const { cookbook, recipe } = await createCookbook()
      // `RecipeTitles.member.get` only selects the ids and titles, without the
      // foreign key of the `cookbook` relation.
      const response = await request(
        `/recipe-titles/${recipe.id}/cookbook/published-title`,
        cook
      )
      expect(response.status).toBe(200)
      expect(response.data).toEqual({ title: cookbook.title })
    })

    it('hides the relations of parents hidden by their scope', async () => {
      const { cookbook } = await createCookbook(false)
      const path = `/cookbooks/${cookbook.id}/recipes`
      expect((await request(path, admin)).status).toBe(404)
    })
  })

  describe('inherited action authorization', () => {
    it('inherits the `authorize` of redefined actions', async () => {
      const response = await request('/patisserie/bread', cook)
      expect(response.status).toBe(200)
      expect(response.data).toBe('fresh bread')
      // The controller-level fallback ranks below the inherited setting.
      expect((await request('/patisserie/bread', admin)).status).toBe(401)
    })

    it('keeps redefined actions with `authorize: true` open', async () => {
      const response = await request('/patisserie/cake', null)
      expect(response.status).toBe(200)
      expect(response.data).toBe('fresh cake')
    })

    it('prefers map entries of sub-classes over parent actions', async () => {
      expect((await request('/patisserie/pie', cook)).status).toBe(401)
      expect((await request('/patisserie/pie', admin)).status).toBe(200)
    })

    it('prefers the own `authorize` of redefined actions', async () => {
      expect((await request('/patisserie/tart', null)).status).toBe(401)
      expect((await request('/patisserie/tart', cook)).status).toBe(200)
    })

    it('inherits across several levels', async () => {
      const bread = await request('/confectionery/bread', cook)
      expect(bread.status).toBe(200)
      expect(bread.data).toBe('sweet fresh bread')
      expect((await request('/confectionery/bread', admin)).status).toBe(401)
      expect((await request('/confectionery/pie', cook)).status).toBe(401)
      expect((await request('/confectionery/pie', admin)).status).toBe(200)
    })

    it('falls back to the controller-level `authorize` setting', async () => {
      expect((await request('/patisserie/roll', cook)).status).toBe(401)
      expect((await request('/patisserie/roll', admin)).status).toBe(200)
    })

    it('prefers values of sub-classes for all actions over parent actions', async () => {
      expect((await request('/bakehouse/bread', null)).status).toBe(200)
    })

    it('inherits the `authorize` of function-form actions', async () => {
      const bagel = await request('/breadhouse/bagel', cook)
      expect(bagel.status).toBe(200)
      expect(bagel.data).toBe('fresh bagel')
      expect((await request('/breadhouse/bagel', null)).status).toBe(401)
    })

    it('lets map entries of sub-classes open parent actions with `authorize: false`', async () => {
      expect((await request('/bakery/crumb', admin)).status).toBe(401)
      expect((await request('/breadhouse/crumb', null)).status).toBe(200)
    })

    it('authorizes relations like the inherited `get` action of their parent', async () => {
      const cookbook = await Cookbook.query().insert({ title: 'Soups' })
      const path = `/member-cookshelves/${cookbook.id}/recipes/size`
      expect((await request(path, null)).status).toBe(200)
    })

    it('inherits the `authorize` of redefined relation actions', async () => {
      const cookbook = await Cookbook.query().insert({ title: 'Soups' })
      const recipe = await Recipe.query().insert({
        title: 'Soup',
        cookbookId: cookbook.id
      })
      const path = `/relation-cookshelves/${cookbook.id}/recipes`
      for (const action of ['count', `${recipe.id}/label`]) {
        expect((await request(`${path}/${action}`, cook)).status).toBe(200)
        expect((await request(`${path}/${action}`, admin)).status).toBe(401)
      }
    })
  })

  describe('boolean and function authorization', () => {
    it('always denies actions with `authorize: false`', async () => {
      // The cook has the role of the controller-level fallback.
      expect((await request('/recipes/secret', cook)).status).toBe(401)
    })

    it('denies all actions of controllers with `authorize: false`', async () => {
      expect((await request('/pantry/stock', admin)).status).toBe(401)
    })

    it('passes the result of authorize functions on as settings', async () => {
      expect((await request('/recipes/chef-only', null)).data).toBe('cooked')
      const denied = await request('/recipes/chef-only?as=chef', guest)
      expect(denied.status).toBe(401)
    })

    it('denies access when authorize functions return nothing', async () => {
      expect((await request('/recipes/forgetful', admin)).status).toBe(401)
    })

    it('calls authorize functions with the controller as `this`', async () => {
      expect((await request('/staff', admin)).status).toBe(200)
      expect((await request('/staff', cook)).status).toBe(401)
      expect((await request(`/staff/${guest.id}`, guest)).status).toBe(200)
      expect((await request(`/staff/${guest.id}`, cook)).status).toBe(401)
    })

    it('calls inherited authorize functions with the sub-class', async () => {
      expect((await request('/kitchen', cook)).status).toBe(200)
      expect((await request('/kitchen', admin)).status).toBe(401)
      expect((await request(`/kitchen/${guest.id}`, cook)).status).toBe(200)
      const patch = (user: Member) =>
        request(`/kitchen/${guest.id}`, user, {
          method: 'PATCH',
          body: { roles: [] }
        })
      expect((await patch(cook)).status).toBe(401)
      expect((await patch(guest)).status).toBe(200)
    })

    it('calls relation authorize functions with the relation', async () => {
      const path = (controller: string) => `/${controller}/${guest.id}/recipes`
      expect((await request(path('staff'), admin)).status).toBe(200)
      expect((await request(path('staff'), cook)).status).toBe(401)
      expect((await request(path('kitchen'), cook)).status).toBe(200)
      expect((await request(path('kitchen'), admin)).status).toBe(401)
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
