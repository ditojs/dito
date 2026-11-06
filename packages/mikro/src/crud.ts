import { defineMixin, type Actions, type Handler } from '@ditojs/server'
import { isFunction } from '@ditojs/utils'
import { checkFind, resolveFind, type Find, type FindShape } from './find.ts'
import { getModelRequest, type ModelRequest } from './ModelRequest.ts'
import { assignRecord, createRecord } from './records.ts'

// An action gets its default handler by setting its key, in `actions` or
// through the mixin `crud`.
export const defaultActions: Actions = {
  'get': ({ list }) => list(),

  // The new row becomes the request's record, also for the handlers above.
  async 'post'({ body, c }) {
    const request = getModelRequest(c)!
    const { em, entity } = request
    const data = await deserialize(request, body)
    const row = await createRecord(em, entity, data)
    request.setRecord(row)
    return row
  },

  'get :id': ({ getRecord }) => getRecord(),

  async 'patch :id'({ body, getRecord, c }) {
    const request = getModelRequest(c)!
    const row = await getRecord()
    const data = await deserialize(request, body, row)
    return assignRecord(request.em, row, data)
  },

  async 'delete :id'({ getRecord, c }) {
    const { em } = getModelRequest(c)!
    em.remove(await getRecord())
    await em.flush()
    return { count: 1 }
  }
}

// Writes still need `authorize`.
export const crud = defineMixin({
  actions: {
    'get': true,
    'post': true,
    'get :id': true,
    'patch :id': true,
    'delete :id': true
  }
})

export function defineList<T extends object = any>(
  find: Find<T> = {}
): Handler {
  if (!isFunction(find)) checkFind(find)
  return async ({ list, c }) => list(await resolveFind(find, c))
}

// A select shows all rows, so its list has no row limit unless `find` sets one.
export function defineChoices<T extends object = any>(find: Find<T>) {
  const addMaxRows = (shape: FindShape<T>) => ({ maxRows: Infinity, ...shape })
  return defineMixin({
    actions: {
      'get choices': defineList(
        isFunction(find)
          ? async context => addMaxRows(await find(context))
          : addMaxRows(find)
      )
    }
  })
}

async function deserialize(
  { c, definition }: ModelRequest,
  json: unknown,
  record?: unknown
) {
  let data = json
  for (const layer of definition.deserializers) {
    data = await layer({ json: data, record, c })
  }
  return data
}
