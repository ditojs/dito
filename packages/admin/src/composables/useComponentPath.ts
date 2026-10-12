import { computed, inject, provide, reactive } from 'vue'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { componentPathKey } from '../utils/keys.ts'

export interface ComponentPath {
  readonly path: string
  // The data path that `path` corresponds to, `null` above the views:
  readonly dataPath: string | null
}

// The names of components through views, tabs, panels and forms, with the item
// indices of the data path, e.g. `main/chapters/0/title`, tell apart the
// components that display the same data:
export function useComponentPath(
  getDataPath: () => string,
  getPath: (parent: ComponentPath) => string = parent =>
    continueComponentPath(parent, getDataPath())
) {
  const parent = inject(componentPathKey, {
    path: '',
    dataPath: null
  })
  const componentPath = computed(() => getPath(parent))
  provide(
    componentPathKey,
    reactive({ path: componentPath, dataPath: computed(getDataPath) })
  )
  return { componentPath, parentComponentPath: computed(() => parent.path) }
}

export function continueComponentPath(
  parent: ComponentPath,
  dataPath: string
): string {
  const relativeDataPath = getRelativeDataPath(dataPath, parent.dataPath)
  return relativeDataPath
    ? appendDataPath(parent.path, relativeDataPath)
    : parent.path
}
