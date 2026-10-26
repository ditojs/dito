<template lang="pug">
slot(name="prepend")
.dito-schema(
  :class=`{
    'dito-scroll-parent': scrollable,
    'dito-schema--open': opened,
    'dito-schema--bordered': bordered
  }`
  v-bind="$attrs"
)
  Teleport(
    v-if="dataContext.hasData && panelEntries.length > 0"
    to=".dito-sidebar__teleport"
  )
    DitoPanels(
      v-show="active"
      :panels="panelEntries"
      :data="data"
      :store="store"
      :disabled="disabled"
    )
  Teleport(
    v-if="hasHeader"
    to=".dito-header__teleport"
    :disabled="!isTopLevelSchema"
  )
    .dito-schema-header(
      v-if="active"
      :class="{ 'dito-schema-header--teleported': isTopLevelSchema }"
    )
      DitoLabel(
        v-if="hasLabel"
        :label="label"
        :context="context"
        :info="info"
        :collapsible="collapsible"
        :collapsed="!opened"
        @toggle="collapsed => (opened = !collapsed)"
      )
      Transition(
        v-if="tabs"
        name="dito-fade"
      )
        DitoTabs.dito-schema-header__tabs(
          v-if="opened"
          :class=`{
            'dito-tabs--header': isTopLevelSchema,
            'dito-tabs--inlined': inlined
          }`
          :modelValue="selectedTab"
          :tabs="renderedTabs"
          :context="context"
          @update:modelValue="selectTab"
        )
      DitoClipboard.dito-schema-header__buttons(
        v-if="clipboard"
        :class="{ 'dito-clipboard--header': isTopLevelSchema }"
        :idle="idle"
        :clipboard="clipboard"
        :name="clipboardName"
        :label="clipboardLabel"
        :hasData="hasData"
        :getData="getClipboardData"
        :getUploadEntries="getClipboardUploadEntries"
        :createContext="createContext"
        @paste="pasteData"
      )
      slot.dito-schema-header__buttons(
        name="edit-buttons"
        :idle="idle"
      )
  //- Only collapsible schemas open and close their content, the others don't
  //- need the components of a transition:
  TransitionHeight(:enabled="inlined && collapsible")
    .dito-schema-content(
      v-if="opened || hasErrors || isClaimingRoute()"
      v-show="opened"
      ref="content"
      :class="{ 'dito-scroll': scrollable }"
    )
      template(
        v-if="hasTabs"
      )
        template(
          v-for="(tabSchema, tab) in tabs"
          :key="tab"
        )
          DitoSchemaPane.dito-pane__tab(
            v-if="shouldRenderTab(tab)"
            v-show="isTabSelected(tab)"
            :tab="tab"
            :selected="isTabSelected(tab)"
            :schema="tabSchema"
            :dataPath="dataPath"
            :data="data"
            :store="store"
            :padding="padding"
            :single="single && !inlined && !hasMainPane"
            :disabled="disabled"
            :compact="compact"
            :generateLabels="generateLabels"
          )
      DitoSchemaPane.dito-pane__main(
        v-if="hasMainPane"
        :schema="schema"
        :dataPath="dataPath"
        :data="data"
        :store="store"
        :padding="padding"
        :single="single && !inlined && !hasTabs"
        :disabled="disabled"
        :compact="compact"
        :generateLabels="generateLabels"
        :layout="layout"
      )
      slot(
        v-if="!inlined && dataContext.hasData"
        name="buttons"
      )
  slot(
    v-if="inlined && !hasHeader"
    name="edit-buttons"
  )
slot(name="append")
</template>

<script>
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  toRef,
  unref,
  useTemplateRef,
  watch
} from 'vue'
import { useRouter } from 'vue-router'
import { isFunction, clone, equals } from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useSchemaEvents } from '../composables/useSchemaEvents.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { useStore } from '../composables/useStore.ts'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { isPanel } from '../utils/schema/structure.js'
import {
  cloneItem,
  getSchemaSource,
  walkData
} from '../utils/schema/walk.js'
import {
  getNamedSchemas,
  getPanelEntries,
  getItemFormSchema,
  isEmptySchema
} from '../utils/schema/lookup.js'
import { getClipboardName } from '../utils/clipboard.js'
import { fromClipboard } from '../utils/fromClipboard.ts'
import { mergeData } from '../utils/mergeData.ts'
import { toClipboard } from '../utils/toClipboard.ts'
import { getUploadEntries } from '../utils/interchange.ts'
import {
  accumulatedBasisKey,
  panelTabKey,
  schemaContextKey,
  schemaEventsKey,
  schemaLayoutKey,
  sourceSchemaKey
} from '../utils/keys.ts'

export default {
  components: { TransitionHeight },
  inheritAttrs: false,
  emits: ['toggle'],

  props: {
    schema: { type: Object, required: true },
    // Panels without own data display the data of another schema:
    dataSchema: { type: Object, default: props => props.schema },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    store: { type: Object, default: () => ({}) },
    label: { type: [String, Object], default: null },
    info: { type: [String, Object], default: null },
    single: { type: Boolean, default: false },
    padding: { type: String, default: null },
    active: { type: Boolean, default: true },
    inlined: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    scrollable: { type: Boolean, default: false },
    // Display the header above the content in a border:
    bordered: { type: Boolean, default: false },
    // Inlined items that are neither hovered nor focused, whose header only
    // keeps the space of the buttons other than edit and remove:
    idle: { type: Boolean, default: false },
    hasOwnData: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  setup(props, { emit, slots }) {
    const router = useRouter()
    const sourceSchema = inject(sourceSchemaKey, null)
    const panelTab = inject(panelTabKey, null)
    // The layout of the main pane: the schema's own slot, or the layout that
    // the component around it provides. The schemas inside get none:
    const providedLayout = inject(schemaLayoutKey, null)
    provide(schemaLayoutKey, null)
    const layout = computed(() =>
      slots.default
        ? () => slots.default()
        : (providedLayout?.value ?? null)
    )
    const { componentPath } = useComponentPath(() => props.dataPath)
    const schemaContext = useSchemaContext(props)
    const { services } = schemaContext
    const { adminContext } = services
    const getModel = () => services.dataContext.model

    const createContext = (values = {}) =>
      schemaContext.createContext({
        get formLabel() {
          return formLabel.value
        },
        ...values
      })
    const context = createContext()
    const { getSchemaValue, getLabelText, shouldRenderSchema } =
      useSchemaValue(context)
    const formLabel = computed(() =>
      getLabelText(getItemFormSchema(unref(sourceSchema), props.data, context))
    )

    const schemaEvents = useSchemaEvents(() => props.schema, {
      services,
      createContext,
      isolated: () => props.hasOwnData
    })
    const { emitEvent } = schemaEvents
    provide(schemaEventsKey, schemaEvents)
    // Panels read the data around them through the context of their schema:
    provide(schemaContextKey, context)
    if (!props.inlined) {
      // Inlined schemas share the width of their container:
      provide(accumulatedBasisKey, 1)
    }

    const content = useTemplateRef('content')
    const isTopLevelSchema = computed(
      () => !isPanel(props.schema) && !props.inlined
    )
    // The view state lives in the store, where the component tree reveals the
    // components inside. The tab of the schema of a view or form is the one of
    // its route:
    const { getStoreRef, getChildStore } = useStore(props)
    const { routeContext } = services
    const selectedTab =
      isTopLevelSchema.value && routeContext
        ? toRef(routeContext, 'selectedTab')
        : getStoreRef('selectedTab', () => null)
    // Selected or revealed tabs stay rendered:
    const mountedTabs = computed(() => getChildStore('mountedTabs'))
    // Follow `defaultTab` until a tab is selected or there is data:
    let shouldFollowDefaultTab = true
    const scrollPositions = {}

    const opened = getStoreRef('opened', () => !props.collapsed)
    // Collapsed content and tabs with errors render hidden, so that errors are
    // revealed in the components that display them:
    const hasErrors = computed(() => getModel().errors.hasWithin(props.data))
    // So does the content at `path` while the route continues below its form,
    // and the one that holds the source of the form below stays:
    const isClaimingRoute = (path = componentPath.value) => {
      const claim = routeContext?.childClaim
      return (
        !!routeContext &&
        !routeContext.isLastRoute &&
        !routeContext.isLeaving && (
          !claim ||
          getRelativeDataPath(claim.location.componentPath, path) !== null
        )
      )
    }
    // Fire the toggle events of the form, and of the component that holds it,
    // also when lists with `collapsible: 'all'` toggle it through its store:
    watch(opened, opened => {
      emitEvent('toggle', { context: { collapsed: !opened } })
      emit('toggle', !opened)
    })

    const tabs = computed(() => getNamedSchemas(props.schema.tabs))
    const hasTabs = computed(() => !!tabs.value)
    const hasData = computed(() => !!props.data)
    const hasLabel = computed(() => !!props.label || props.collapsible)

    // Evaluate the tabs' `if` once there is data, as their components do:
    const renderedTabs = computed(() =>
      tabs.value && props.data
        ? Object.fromEntries(
            Object.entries(tabs.value).filter(([, tab]) =>
              shouldRenderSchema(tab)
            )
          )
        : tabs.value
    )

    const defaultTab = computed(() => {
      let first = null
      if (renderedTabs.value) {
        for (const { name, defaultTab } of Object.values(renderedTabs.value)) {
          if (isFunction(defaultTab) ? defaultTab(context) : defaultTab) {
            return name
          }
          first ??= name
        }
      }
      return first
    })

    // The tab that the path names below the route, which the tabs claim:
    const routeTab = computed(() => routeContext?.routeTab ?? null)

    // The last route follows the tab in its path, and names its selected tab
    // there. Forms keep their tab while the forms of their items are open:
    const shouldFollowRouteTab = computed(
      () => (
        hasTabs.value &&
        isTopLevelSchema.value &&
        !!routeContext?.isLastRoute
      )
    )

    const isTabSelected = tab => selectedTab.value === tab

    const selectTab = tab => {
      selectedTab.value = tab
      shouldFollowDefaultTab = false
    }

    // Editing the data doesn't switch the tab:
    const selectDefaultTab = () => {
      selectedTab.value = defaultTab.value
      shouldFollowDefaultTab = !hasData.value
    }

    // Paths without a tab, e.g. after closing a form, keep the tab and name it:
    const followRouteTab = () => {
      if (shouldFollowRouteTab.value) {
        if (!routeTab.value) {
          replaceRouteTab(selectedTab.value)
        } else if (routeTab.value !== selectedTab.value) {
          selectTab(routeTab.value)
        }
      }
    }

    // Tabs that aren't rendered fall back to the default tab:
    const replaceRouteTab = tab => {
      const tabInRoute =
        !tab || tab in renderedTabs.value ? tab : defaultTab.value
      if (tabInRoute !== routeTab.value) {
        const { path } = routeContext
        router.replace({
          path: tabInRoute ? `${path}/${tabInRoute}` : path,
          query: router.currentRoute.value.query
        })
      }
    }

    // The schemas of forms can depend on the data that they load:
    watch(
      () => props.schema,
      schema => {
        if (!isEmptySchema(schema)) {
          emitEvent('initialize') // Not `'create'`, since that's for data.
        }
      },
      { immediate: true }
    )

    watch(routeTab, followRouteTab, {
      immediate: true,
      // https://github.com/vuejs/vue-router/issues/3393#issuecomment-1158470149
      flush: 'post'
    })

    // Returning from a nested form, the route may name a different tab:
    watch(shouldFollowRouteTab, shouldFollow => {
      if (shouldFollow) {
        followRouteTab()
      }
    })

    // `defaultTab()` and the tabs' `if` may depend on data loaded later:
    watch(hasData, hasData => {
      if (hasData && shouldFollowDefaultTab) {
        selectDefaultTab()
      }
    })

    watch(selectedTab, (newTab, oldTab) => {
      if (newTab) {
        mountedTabs.value[newTab] = true
      }
      // The route selects the tab before the content is mounted:
      const element = props.scrollable ? content.value : null
      if (element) {
        scrollPositions[oldTab] = element.scrollTop
        nextTick(() => {
          element.scrollTop = scrollPositions[newTab] ?? 0
        })
      }
      // The route of a nested form doesn't belong to this schema:
      if (shouldFollowRouteTab.value) {
        replaceRouteTab(newTab)
      }
    })

    // The scrollable schema of a route makes its page wide while it's mounted,
    // also when the type of the item changes its form:
    if (props.scrollable && routeContext) {
      watch(
        () => getSchemaValue('wide', { type: Boolean, default: false }),
        isWide => {
          routeContext.isWide = isWide
        },
        { immediate: true }
      )
      onUnmounted(() => {
        routeContext.isWide = false
      })
    }

    onMounted(() => {
      // The tab of a nested route belongs to the nested form, whose route
      // reveals the tab of its source, e.g. after a reload. Inlined schemas
      // keep their tab in their store:
      const tab = shouldFollowRouteTab.value
        ? routeTab.value
        : selectedTab.value
      if (tab && tab in renderedTabs.value) {
        selectTab(tab)
      } else {
        selectDefaultTab()
      }
    })

    onUnmounted(() => emitEvent('destroy'))

    return {
      context,
      createContext,
      dataContext: services.dataContext,
      opened,
      hasErrors,
      isClaimingRoute,
      tabs,
      hasTabs,
      hasData,
      hasLabel,
      renderedTabs,
      selectedTab,
      selectTab,
      isTopLevelSchema,
      isTabSelected,

      panelEntries: computed(() => {
        // Panels of schemas inlined in tabs only show with their tab:
        const entries = getPanelEntries(
          props.schema.panels,
          props.dataPath,
          componentPath.value,
          panelTab
        )
        // Inactive schemas render the panels that the route continues into:
        return props.active
          ? entries
          : entries.filter(({ componentPath }) =>
              isClaimingRoute(componentPath)
            )
      }),

      clipboard: computed(() => props.schema?.clipboard ?? null),

      clipboardName: computed(() =>
        getClipboardName(props.schema, unref(sourceSchema))
      ),

      // The item label of the form, as its header shows it, or the form label:
      clipboardLabel: computed(
        () => isTopLevelSchema.value && context.itemLabel || formLabel.value
      ),

      hasHeader: computed(
        () => hasLabel.value || hasTabs.value || !!props.schema?.clipboard
      ),

      layout,

      // Pages place their component without any fields:
      hasMainPane: computed(() => {
        const { fields } = props.schema
        return (
          !!layout.value ||
          !!fields && Object.keys(fields).length > 0
        )
      }),

      shouldRenderTab(tab) {
        return (
          isTabSelected(tab) ||
          !!mountedTabs.value[tab] ||
          hasErrors.value ||
          isClaimingRoute(appendDataPath(componentPath.value, tab))
        )
      },

      async pasteData(clipboardData) {
        const { data, unresolvedLabels } = await fromClipboard(
          props.dataSchema,
          clipboardData,
          { dataPath: props.dataPath, services, rootData: context.rootItem }
        )
        // Replace the data like loaded data, but keep the values of the item's
        // fields that the pasted data lacks, e.g. hidden ones. Values that
        // `computeValue()` derives are derived from the pasted ones instead:
        const item = { ...data }
        walkData(props.dataSchema, props.data, {
          dataPath: props.dataPath,
          services,
          rootData: context.rootItem,
          shouldWalk: () => false,
          visit: entry => {
            const { node, name } = entry
            if (
              name in props.data &&
              !(name in item) &&
              !node.getRecordedSchema(entry)?.schema.computeValue
            ) {
              item[name] = props.data[name]
            }
          }
        })
        // The item keeps what identifies it, also its position in its list:
        const source = unref(sourceSchema)
        if (source) {
          Object.assign(item, cloneItem(getSchemaSource(source), props.data))
        }
        // Only changes of the data that is saved are edits:
        const model = getModel()
        const previousData = clone(model.serializedData.value)
        mergeData(props.dataSchema, props.data, item, {
          services,
          shouldKeepSourcesWithResource: true
        })
        model.fields.writeComputedValues()
        if (!equals(model.serializedData.value, previousData)) {
          model.markEdited()
        }
        if (unresolvedLabels.length > 0) {
          adminContext.notify({
            type: 'warning',
            text: `Not found when pasting: ${unresolvedLabels.join(', ')}`
          })
        }
      },

      getClipboardData() {
        return toClipboard(
          props.dataSchema,
          unref(sourceSchema),
          props.data,
          props.dataPath,
          { rootData: context.rootItem, services }
        )
      },

      getClipboardUploadEntries(data) {
        return getUploadEntries(props.dataSchema, data, {
          dataPath: props.dataPath,
          services,
          rootData: context.rootItem
        })
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-schema {
  box-sizing: border-box;

  > .dito-schema-header + .dito-schema-content > .dito-pane {
    margin-top: $form-spacing-half;
  }

  &:has(> .dito-schema-content + .dito-edit-buttons) {
    // Display the inlined edit buttons to the right of the schema:
    display: flex;
    flex-direction: row;
    align-items: stretch;

    > .dito-edit-buttons {
      flex: 1 0 0%;
      margin-left: $form-spacing;
    }
  }

  > .dito-schema-content {
    flex: 0 1 100%;
    max-width: 100%;
    // So that schema buttons can be sticky to the bottom.
    // NOTE: We also need grid for `TransitionHeight` to work well. Switching
    // to flex box here causes jumpy collapsing transitions.
    display: grid;
    grid-template-rows: min-content;
    grid-template-columns: 100%;

    > :only-child {
      grid-row-end: none;
    }
  }

  // Collapsed schemas show that their hidden content contains errors:
  &:not(&--open):has(> .dito-schema-content .dito-container--has-errors)
    > .dito-schema-header
    > .dito-label {
    color: $color-error;
  }

  &--bordered {
    > .dito-schema-content {
      border: $border-style;
      border-radius: $border-radius;
      margin-top: $form-spacing-half;
    }

    > .dito-schema-header + .dito-schema-content > .dito-pane {
      // Inside the border, the content's margin replaces the spacing below the
      // header:
      margin-top: -$form-spacing-half;
    }
  }
}

.dito-schema-header {
  $self: &;

  display: flex;
  justify-content: space-between;
  // Let nested labels with ellipsis shrink below their content width.
  min-width: 0;

  &--teleported {
    // When teleported into main header.
    align-items: flex-end;
  }

  > .dito-label {
    margin-bottom: 0;
  }

  &__tabs {
    // Push clipboard to the right in the flex layout, see:
    // https://codepen.io/tholex/pen/hveBx/
    margin-left: auto;

    &:last-child {
      margin-right: auto;
    }
  }

  &__buttons {
    flex-shrink: 0;
    margin-left: var(--button-margin, 0);

    &.dito-clipboard {
      // Push clipboard to the right in the flex layout, see:
      // https://codepen.io/tholex/pen/hveBx/
      margin-left: auto;

      #{$self}--teleported > & {
        margin-left: $tab-margin;
      }
    }
  }
}
</style>
