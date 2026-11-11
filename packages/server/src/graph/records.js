import { modelGraphToExpression } from './expression.js'
import { createControlPropError } from './graph.js'

// Controllers with `delta = true`, whose model has a version, send the model's
// record graph in the `Dito-Record-Graph` header: for graph controllers the
// relations that it holds, like `{ chapters: { pages: {} } }`, else `{}`. Forms
// then patch only their delta, a body with `'#delta': true` at its root. Its
// lists of records hold only the rows that changed, and removed rows are
// `{ id, '#removed': true }`.
export const recordGraphHeader = 'Dito-Record-Graph'
export const deltaProp = '#delta'
export const removedProp = '#removed'

export function setRecordGraph(ctx, model) {
  ctx.set(
    recordGraphHeader,
    JSON.stringify(modelGraphToExpression(model) ?? {})
  )
}

export function isDelta(body) {
  return body?.[deltaProp] !== undefined
}

// Only the member `patch` action of controllers that take deltas reads them,
// with `'#delta': true`:
export function rejectDelta() {
  throw createControlPropError(deltaProp)
}
