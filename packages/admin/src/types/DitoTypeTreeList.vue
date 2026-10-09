<template lang="pug">
.dito-tree-list
  DitoScopes(
    v-if="scopes"
    :query="query"
    :scopes="scopes"
  )
  .dito-tree-panel
    //- Objects that are `null` have no tree, as tree items can't create them.
    DitoTreeItem(
      v-if="treeData"
      :schema="treeSchema"
      :dataPath="treeDataPath"
      :data="treeData"
      :draggable="draggable"
      :open="true"
      @change-children="changeChildren"
    )
    .dito-tree-form-container(
      v-if="editPath && hasEditableForms"
    )
      //- Include a router-view for the optional DitoFormInlined
      DitoRouterView(:routeLevel="routeComponent.routeLevel + 1")
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import SourceMixin from '../mixins/SourceMixin.js'
import { resolveSchemaComponents } from '../utils/schema/setup.js'
import { hasFormSchema, getFormSchemas } from '../utils/schema/lookup.js'
import { updateOrder } from '../utils/schema/data.js'
import { getParentDataPath } from '../utils/data.js'

export default DitoTypeComponent.register(
  ['tree-list', 'tree-object'],
  // @vue/component
  {
    mixins: [SourceMixin],

    getSourceType(type) {
      return type === 'tree-object' ? 'object' : 'list'
    },

    computed: {
      path() {
        // Accessed from DitoTreeItem through `sourceComponent.path`:
        return this.formComponent?.path
      },

      editPath() {
        // Accessed from DitoTreeItem through `sourceComponent.editPath`:
        const path = this.$route.path.slice(this.path?.length)
        return path.startsWith(`/${this.schema.path}`) ? path : ''
      },

      treeData() {
        return this.isListSource
          ? { [this.name]: this.value }
          : this.value
      },

      treeDataPath() {
        // Remove `name` from `dataPath`, as it is added
        // to `treeData` and `treeSchema`
        return this.isListSource
          ? getParentDataPath(this.dataPath)
          : this.dataPath
      },

      treeSchema() {
        return this.isListSource
          ? {
              children: {
                name: this.name,
                ...this.schema
              }
            }
          : this.schema
      },

      hasEditableForms() {
        const hasEditableForms = schema => {
          return (
            hasFormSchema(schema) && (
              this.getSchemaValue('editable', {
                type: Boolean,
                default: false,
                schema
              }) || (
                schema.children &&
                hasEditableForms(schema.children)
              )
            )
          )
        }
        return hasEditableForms(this.schema)
      }
    },

    methods: {
      // Replaces the children of the tree item that holds them in `data`, as
      // the only writer of the tree, see `DitoTreeItem.changeChildren()`.
      changeChildren({ data, childrenSchema, path, children }) {
        const previousChildren = data[childrenSchema.name]
        updateOrder(childrenSchema, children)
        if (data === this.treeData && this.isListSource) {
          // The root item of tree lists holds the list in a wrapper object,
          // see `treeData`.
          this.value = children
        } else {
          data[childrenSchema.name] = children
        }
        this.followEditedChild({
          childrenPath: childrenSchema.path && `${path}/${childrenSchema.path}`,
          previousChildren,
          children
        })
        this.onChange()
      },

      // Keeps the form of an edited child or of one of its descendants open
      // at the child's new index, or closes it if the child was removed.
      followEditedChild({ childrenPath, previousChildren, children }) {
        const prefix = `${childrenPath}/`
        const { editPath } = this
        if (childrenPath && editPath.startsWith(prefix)) {
          const [index, ...rest] = editPath.slice(prefix.length).split('/')
          const newIndex = children.indexOf(previousChildren?.[index])
          if (newIndex !== +index) {
            const path =
              newIndex >= 0
                ? [`${this.path}${prefix}${newIndex}`, ...rest].join('/')
                : this.path
            this.$router.push({ path, query: this.$route.query })
          }
        }
      }
    },

    async processSchema(
      api,
      schema,
      name,
      routes,
      level,
      nested = true,
      flatten = false,
      process = null
    ) {
      await Promise.all([
        resolveSchemaComponents(schema.properties),
        SourceMixin.processSchema(
          api,
          schema,
          name,
          routes,
          level,
          nested,
          flatten,
          // Pass process() to add more routes to childRoutes:
          (childRoutes, level) => {
            const { children } = schema
            if (children) {
              // Add `type` to the nested tree list.
              children.type = 'tree-list'
              // Recursively call `processSchema()` for the nested tree list:
              return this.processSchema(
                api,
                children,
                children.name,
                childRoutes,
                level,
                nested,
                true, // Pass `true` for `flatten` in tree lists.
                process
              )
            }
          }
        )
      ])
    },

    getFormSchemasForProcessing(schema, context) {
      // Convert nested children schema to stand-alone schema component,
      // present in each of the forms, as required by `processSchemaData()`
      const { children } = schema
      return getFormSchemas(
        schema,
        context,
        children
          ? form => ({
              ...form,
              components: {
                ...form.components,
                [children.name]: children
              }
            })
          : null
      )
    }
  }
)
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-tree-list {
  @extend %field;

  .dito-tree-panel {
    display: flex;
    justify-content: space-between;

    > .dito-tree-item {
      flex: 1 1 25%;
    }

    > .dito-tree-form-container {
      flex: 0 1 75%;
      align-self: stretch;
      background: $content-color-background;
      border-left: $border-style;
      border-top-right-radius: $border-radius - 1;
      border-bottom-right-radius: $border-radius - 1;
      margin: (-$input-padding-ver) (-$input-padding-hor);
      margin-left: $input-padding-hor;
    }
  }
}
</style>
