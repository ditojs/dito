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
        :clipboard="clipboard"
        :schema="schema"
        :label="clipboardLabel"
        :hasData="hasData"
        :getData="getClipboardData"
        :getUploadEntries="getClipboardUploadEntries"
        :createContext="createContext"
        @paste="pasteData"
      )
      slot.dito-schema-header__buttons(name="edit-buttons")
  TransitionHeight(:enabled="inlined")
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
      )
        //- The component of sections that lay out their components:
        template(
          v-if="$slots.default"
          #default
        )
          slot
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
  reactive,
  ref,
  toRef,
  unref,
  useTemplateRef,
  watch
} from 'vue'
import { useRouter } from 'vue-router'
import { isFunction, parseDataPath } from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import { useSchemaContext } from '../composables/useSchemaContext.ts'
import { useSchemaValue } from '../composables/useSchemaValue.ts'
import { useSchemaEvents } from '../composables/useSchemaEvents.ts'
import { useComponentPath } from '../composables/useComponentPath.ts'
import { useStore } from '../composables/useStore.ts'
import { appendDataPath, getRelativeDataPath } from '../utils/data.js'
import { isPanel } from '../utils/schema/structure.js'
import {
  getNamedSchemas,
  getPanelEntries,
  getItemFormSchema,
  isEmptySchema
} from '../utils/schema/lookup.js'
import { fromClipboard } from '../utils/fromClipboard.ts'
import { toClipboard } from '../utils/toClipboard.ts'
import { getUploadEntries } from '../utils/interchange.ts'
import {
  accumulatedBasisKey,
  panelTabKey,
  schemaContextKey,
  schemaEventsKey,
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
    hasOwnData: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  setup(props, { emit, slots }) {
    const router = useRouter()
    const sourceSchema = inject(sourceSchemaKey, null)
    const panelTab = inject(panelTabKey, null)
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
    // The tab of the schema of a view or form is the one of its route:
    const { routeContext } = services
    const selectedTab =
      isTopLevelSchema.value && routeContext
        ? toRef(routeContext, 'selectedTab')
        : ref(null)
    // Selected or revealed tabs stay rendered:
    const mountedTabs = reactive({})
    // Follow `defaultTab` until a tab is selected or there is data:
    let shouldFollowDefaultTab = true
    const scrollPositions = {}

    const opened = useStore(props).getStoreRef('opened', () => !props.collapsed)
    // Collapsed content and tabs with errors render hidden, so that errors are
    // revealed in the components that display them:
    const hasErrors = computed(() => getModel().hasErrorsWithin(props.data))
    // So does the content at `path` while the route continues below its form,
    // so that its components can claim it, and the one that claimed it stays:
    const isClaimingRoute = (path = componentPath.value) => {
      const claim = routeContext?.childClaim
      return (
        !!routeContext &&
        !routeContext.isLastRoute &&
        !routeContext.isLeaving && (
          !claim ||
          getRelativeDataPath(claim.source.componentPath, path) !== null
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

    // The tab that holds the source that claimed the nested route:
    const nestedRouteTab = computed(() => {
      const source = (
        hasTabs.value &&
        isTopLevelSchema.value &&
        routeContext?.childClaim?.source
      )
      const path = source
        ? getRelativeDataPath(source.componentPath, componentPath.value)
        : null
      const [tab] = parseDataPath(path ?? '')
      return tab && tab in renderedTabs.value ? tab : null
    })

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

    // Show the source of the nested form, to return to it when it closes:
    watch(nestedRouteTab, tab => {
      if (tab) {
        selectTab(tab)
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
        mountedTabs[newTab] = true
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

    const unregisterUi = adminContext.ui.register(() => componentPath.value, {
      dataContext: services.dataContext,
      // The tabs of the route's schema claim their names below its path:
      claimRoute(path) {
        const tab =
          isTopLevelSchema.value && routeContext
            ? getRelativeDataPath(path, routeContext.path)
            : null
        return tab && renderedTabs.value?.[tab] ? { tab } : null
      },
      async reveal(path, { focus }) {
        const [tab] = parseDataPath(
          getRelativeDataPath(path, componentPath.value)
        )
        if (renderedTabs.value?.[tab]) {
          mountedTabs[tab] = true
          if (focus) {
            selectTab(tab)
          }
        }
        const isOpening = !opened.value
        opened.value = true
        await nextTick()
        if (focus && isOpening) {
          // `TransitionHeight` hides the content while it measures it, until
          // its next timeout, and hidden fields can't be focused:
          await new Promise(resolve => setTimeout(resolve))
        }
      }
    })
    const isWidePage = (
      props.scrollable &&
      getSchemaValue('wide', { type: Boolean, default: false })
    )
    if (isWidePage) {
      // Views stay mounted while the forms of their items show, so they only
      // make the page wide while they're active:
      watch(
        () => props.active,
        active => adminContext.setWideSchema(context, active),
        { immediate: true }
      )
    }

    onMounted(() => {
      // The tab of a nested route belongs to the nested form, which names the
      // tab of its source in its route, e.g. after a reload:
      const tab = shouldFollowRouteTab.value
        ? routeTab.value
        : nestedRouteTab.value
      if (tab && tab in renderedTabs.value) {
        selectTab(tab)
      } else {
        selectDefaultTab()
      }
    })

    onUnmounted(() => {
      emitEvent('destroy')
      unregisterUi()
      if (isWidePage) {
        adminContext.setWideSchema(context, false)
      }
    })

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

      // The item label of the form, as its header shows it, or the form label:
      clipboardLabel: computed(
        () => isTopLevelSchema.value && context.itemLabel || formLabel.value
      ),

      hasHeader: computed(
        () => hasLabel.value || hasTabs.value || !!props.schema?.clipboard
      ),

      // Pages place their component without any fields:
      hasMainPane: computed(() => {
        const { fields } = props.schema
        return (
          !!slots.default ||
          !!fields && Object.keys(fields).length > 0
        )
      }),

      shouldRenderTab(tab) {
        return (
          isTabSelected(tab) ||
          !!mountedTabs[tab] ||
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
        // The item keeps its position in its list:
        const orderKey = unref(sourceSchema)?.orderKey
        for (const [name, value] of Object.entries(data)) {
          if (name in props.data && name !== orderKey) {
            getModel().set(
              {
                data: props.data,
                name,
                dataPath: appendDataPath(props.dataPath, name)
              },
              value
            )
          }
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
