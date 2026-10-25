import { computed, inject, provide, reactive } from 'vue'
import { getRelativeDataPath } from '../utils/data.js'
import { componentPathKey, dataContextKey } from '../utils/keys.ts'
import type { ComponentNode } from '../utils/ComponentTree.ts'

export interface ComponentPath {
  readonly node: ComponentNode
  // The data path of the component, which its children continue:
  readonly dataPath: string
}

// The names of components through views, tabs, panels and forms, with the item
// indices of the data path, e.g. `main/chapters/0/title`, tell apart the
// components that display the same data. Components take their path from their
// node in the component tree of their data, which by default continues the
// parent's node with the data path. The first component in the data of a
// dialog, panel or form starts at the root of its tree:
export function useComponentPath(
  getDataPath: () => string,
  getNode?: (parent: ComponentPath) => ComponentNode
) {
  const parent = inject(componentPathKey, null)
  const tree = inject(dataContextKey, null)?.componentTree
  const node = computed(() =>
    getNode
      ? getNode(parent!)
      : parent?.node.tree === tree
        ? continueComponentNode(parent!, getDataPath())
        : tree!.root
  )
  provide(componentPathKey, reactive({ node, dataPath: computed(getDataPath) }))
  return {
    node,
    componentPath: computed(() => node.value.componentPath),
    parentComponentPath: computed(() => parent?.node.componentPath ?? '')
  }
}

// The node that `dataPath` leads to from the parent's:
export function continueComponentNode(
  parent: ComponentPath,
  dataPath: string
): ComponentNode {
  return parent.node.getNode(
    getRelativeDataPath(dataPath, parent.dataPath) ?? ''
  )
}
