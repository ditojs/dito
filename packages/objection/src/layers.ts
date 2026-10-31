import type {
  ActionDefinition,
  Actions,
  Authorize,
  FeatureDefinition
} from '@ditojs/server-next'
import { isPlainObject } from '@ditojs/utils'

// The layers of a controller as the core's `compose.ts` resolves them, for
// the settings of actions that the core doesn't pass to handlers: the base,
// the features of `use` depth-first, and the definition itself. A later
// layer wins over an earlier one.

export type On = 'collection' | 'member'

export function getLayers(
  definition: FeatureDefinition,
  base?: FeatureDefinition
) {
  const layers: FeatureDefinition[] = []
  const add = (def: FeatureDefinition) => {
    if (layers.includes(def)) return
    for (const feature of def.use ?? []) add(feature)
    layers.push(def)
  }
  if (base) add(base)
  for (const feature of definition.use ?? []) add(feature)
  layers.push(definition)
  return layers
}

// A setting of an action's definitions, from the last layer that sets it.
export function getActionSetting<K extends keyof ActionDefinition>(
  layers: FeatureDefinition[],
  on: On,
  name: string,
  key: K
): ActionDefinition[K] | undefined {
  return findLast(
    layers.map(layer => {
      const value = layer[on]?.[name as keyof Actions]
      return isPlainObject(value)
        ? (value as ActionDefinition)[key]
        : undefined
    })
  )
}

// The `authorize` of an action: the action's own, or else the last layer's.
export function getAuthorize(
  layers: FeatureDefinition[],
  on: On,
  name: string
): Authorize | undefined {
  return (
    getActionSetting(layers, on, name, 'authorize') ??
    findLast(layers.map(layer => layer.authorize))
  )
}

export function findLast<T>(values: (T | undefined)[]) {
  return values.findLast(value => value !== undefined)
}
