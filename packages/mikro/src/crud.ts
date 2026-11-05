import { defineMixin, type Actions, type Handler } from '@ditojs/server'
import { checkFind, type FindShape } from './find.ts'
import { getModelRequest, type ModelRequest } from './ModelRequest.ts'
import { assignRecord, createRecord } from './write.ts'

// The default handlers of a model controller. An action gets one by setting
// its key, in `actions` or through the mixin `crud`.
export const defaults: Actions = {
  'get': ({ list }) => list(),

  // The new row becomes the request's record.
  async 'post'({ body, c }) {
    const modelRequest = getModelRequest(c)!
    const { em, entity } = modelRequest
    const data = await deserialize(modelRequest, body)
    const row = await createRecord(em, entity, data)
    modelRequest.setRecord(row)
    return row
  },

  'get :id': ({ getRecord }) => getRecord(),

  async 'patch :id'({ body, getRecord, c }) {
    const modelRequest = getModelRequest(c)!
    const row = await getRecord()
    const data = await deserialize(modelRequest, body, row)
    return assignRecord(modelRequest.em, row, data)
  },

  async 'delete :id'({ getRecord, c }) {
    const { em } = getModelRequest(c)!
    em.remove(await getRecord())
    await em.flush()
    return { count: 1 }
  }
}

// A mixin that routes the five default handlers. Writes still need `authorize`.
export const crud = defineMixin({
  actions: {
    'get': true,
    'post': true,
    'get :id': true,
    'patch :id': true,
    'delete :id': true
  }
})

// The handler of a list, see `c.var.list`.
export function defineListHandler<T extends object = any>(
  find: FindShape<T> = {}
): Handler {
  checkFind(find)
  return ({ list }) => list(find)
}

// A mixin with the list `get choices`, for the options of a select, such as
// `defineChoices({ fields: ['id', 'name'], orderBy: { name: 'asc' } })`.
// A select shows all rows, so its list has no row limit unless `find` sets one.
export function defineChoices<T extends object = any>(find: FindShape<T>) {
  return defineMixin({
    actions: {
      'get choices': defineListHandler({ maxRows: Infinity, ...find })
    }
  })
}

// Runs `deserialize` of each layer on the body of a write.
async function deserialize(
  { c, definition }: ModelRequest,
  json: unknown,
  record?: unknown
) {
  let data = json
  for (const layer of definition.deserializers) {
    data = await layer(c, data, record)
  }
  return data
}
