<template lang="pug">
slot(name="prepend")
.dito-schema(
  :class="{ 'dito-scroll-parent': scrollable, 'dito-schema--open': opened }"
  v-bind="$attrs"
)
  Teleport(
    v-if="container.hasData && panelEntries.length > 0"
    to=".dito-sidebar__teleport"
  )
    DitoPanels(
      v-if="active"
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
    )
      DitoLabel(
        v-if="hasLabel"
        :label="label"
        :context="context"
        :info="info"
        :collapsible="collapsible"
        :collapsed="!opened"
        @open="onOpen"
      )
      Transition(
        v-if="tabs"
        name="dito-fade"
      )
        DitoTabs(
          v-if="opened"
          :modelValue="selectedTab"
          :tabs="renderedTabs"
          :context="context"
          @update:modelValue="selectTab"
        )
      DitoClipboard(
        v-if="clipboard"
        :clipboard="clipboard"
        :schema="schema"
        :hasData="hasData"
        :getData="() => processData('clipboard')"
        :createContext="createContext"
        @paste="pasteData"
      )
      slot(name="edit-buttons")
  TransitionHeight(:enabled="inlined")
    .dito-schema-content(
      v-if="opened"
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
          DitoPane.dito-pane__tab(
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
      DitoPane.dito-pane__main(
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
      slot(
        v-if="!inlined && container.hasData"
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
  unref,
  useTemplateRef,
  watch
} from 'vue'
import { useRouter } from 'vue-router'
import {
  isFunction,
  isEmpty,
  parseDataPath,
  normalizeDataPath,
  labelize
} from '@ditojs/utils'
import { TransitionHeight } from '@ditojs/ui/src'
import appState from '../appState.js'
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
import {
  processData,
  getComponentPathByDataPath
} from '../utils/schema/data.js'
import { fromClipboard } from '../utils/fromClipboard.ts'
import {
  getDataValidationErrors,
  getMatchingValidationErrors
} from '../utils/schema/validation.js'

export default {
  name: 'DitoSchema',
  components: { TransitionHeight },
  inheritAttrs: false,
  emits: ['update:selectedTab'],

  props: {
    schema: { type: Object, required: true },
    // `dataSchema` is only provided for panels, where the panel schema
    // is different from the data schema for panels without own data.
    dataSchema: { type: Object, default: props => props.schema },
    dataPath: { type: String, default: '' },
    data: { type: Object, default: null },
    store: { type: Object, default: () => ({}) },
    label: { type: [String, Object], default: null },
    info: { type: String, default: null },
    single: { type: Boolean, default: false },
    padding: { type: String, default: null },
    active: { type: Boolean, default: true },
    inlined: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    scrollable: { type: Boolean, default: false },
    hasOwnData: { type: Boolean, default: false },
    generateLabels: { type: Boolean, default: false }
  },

  setup(props, { emit }) {
    const router = useRouter()
    // The schema of the source whose item the schema displays:
    const sourceSchema = inject('sourceSchema', null)
    // The tab of the pane that the schema is in, see `DitoPane`:
    const panelTab = inject('panelTab', null)
    const { componentPath } = useComponentPath(() => props.dataPath)
    const schemaContext = useSchemaContext(props)
    const { services } = schemaContext
    const { admin } = services
    const getModel = () => services.container.model

    // The contexts of the schema hold the label of its form:
    const createContext = (values = {}) =>
      schemaContext.createContext({
        get formLabel() {
          return formLabel.value
        },
        ...values
      })
    const context = createContext()
    const { getSchemaValue, getLabel, shouldRenderSchema } =
      useSchemaValue(context)
    const formLabel = computed(() =>
      getLabel(getItemFormSchema(unref(sourceSchema), props.data, context))
    )

    // The events of the components bubble to the schema, and on to the schema
    // above, unless it has its own data:
    const schemaEvents = useSchemaEvents(() => props.schema, {
      services,
      createContext: values => createContext({ nested: true, ...values }),
      isolated: () => props.hasOwnData
    })
    const { emitEvent } = schemaEvents
    provide('schemaEvents', schemaEvents)
    // Panels read the data around them through the context of their schema:
    provide('schemaContext', context)
    if (!props.inlined) {
      // Inlined schemas share the width of their container, all others take
      // the full width, e.g. panels in the sidebar:
      provide('accumulatedBasis', 1)
    }

    const content = useTemplateRef('content')
    const selectedTab = ref(null)
    // The tabs that were selected or revealed, which stay rendered:
    const mountedTabs = reactive({})
    // Whether the selected tab follows `defaultTab`, until a tab is selected or
    // the data that it's evaluated with is there:
    let shouldFollowDefaultTab = true
    const scrollPositions = {}

    const opened = useStore(props).getStoreRef('opened', () => !props.collapsed)

    const tabs = computed(() => getNamedSchemas(props.schema.tabs))
    const hasTabs = computed(() => !!tabs.value)
    const hasData = computed(() => !!props.data)
    const hasLabel = computed(() => !!props.label || props.collapsible)

    // Evaluate the tabs' `if` with the schema's context, and only once there
    // is data to evaluate it with, as their components do too.
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

    const routeTab = computed(
      () => router.currentRoute.value.hash?.slice(1) || null
    )

    // Panels are displayed in the sidebar, inlined schemas in their parents.
    const isTopLevelSchema = computed(
      () => !isPanel(props.schema) && !props.inlined
    )

    // The route's hash belongs to the tabs of the last route only, so forms
    // keep their tab while the forms of their items are open:
    const shouldFollowRouteTab = computed(
      () => (
        hasTabs.value &&
        isTopLevelSchema.value &&
        !!services.route?.isLastRoute
      )
    )

    const isTabSelected = tab => selectedTab.value === tab

    // Selects the tab chosen by the route or the user, and tells the form,
    // e.g. for `context.selectedTab`:
    const selectTab = tab => {
      selectedTab.value = tab
      shouldFollowDefaultTab = false
      emit('update:selectedTab', tab)
    }

    // Selects `defaultTab`, and keeps following it until there is data, but
    // not after that, so that editing the data doesn't switch the tab.
    const selectDefaultTab = () => {
      selectedTab.value = defaultTab.value
      shouldFollowDefaultTab = !hasData.value
      emit('update:selectedTab', selectedTab.value)
    }

    // Selects the tab of the route's hash. A route without a hash, e.g. after
    // closing the form of an item, keeps the selected tab.
    const followRouteTab = () => {
      if (
        shouldFollowRouteTab.value &&
        routeTab.value &&
        routeTab.value !== selectedTab.value
      ) {
        selectTab(routeTab.value)
      }
    }

    // Puts the tab into the route's hash, falling back to the default tab for
    // tabs that aren't rendered:
    const replaceRouteTab = tab => {
      const tabInRoute =
        !tab || tab in renderedTabs.value ? tab : defaultTab.value
      if (tabInRoute !== routeTab.value) {
        router.replace({
          query: router.currentRoute.value.query,
          hash: tabInRoute ? `#${tabInRoute}` : null
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

    // Returning from a nested form, e.g. through the browser's history, the
    // route may carry a different tab.
    watch(shouldFollowRouteTab, shouldFollow => {
      if (shouldFollow) {
        followRouteTab()
      }
    })

    // `defaultTab()` and the tabs' `if` may depend on data that is only
    // available after mounting, e.g. the item of a form once it's loaded.
    watch(hasData, hasData => {
      if (hasData && shouldFollowDefaultTab) {
        selectDefaultTab()
      }
    })

    watch(selectedTab, (newTab, oldTab) => {
      if (newTab) {
        mountedTabs[newTab] = true
      }
      if (props.scrollable) {
        const element = content.value
        scrollPositions[oldTab] = element.scrollTop
        nextTick(() => {
          element.scrollTop = scrollPositions[newTab] ?? 0
        })
      }
      // The route of a nested form doesn't belong to this schema.
      if (shouldFollowRouteTab.value) {
        replaceRouteTab(newTab)
      }
    })

    // Reveal the components of the schema by opening it and rendering the tab
    // that leads to them, which focusing them also selects:
    const unregisterUi = admin.ui.register(() => componentPath.value, {
      container: services.container,
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
        opened.value = true
        await nextTick()
      }
    })
    const isWidePage = (
      props.scrollable &&
      getSchemaValue('wide', { type: Boolean, default: false })
    )
    if (isWidePage) {
      appState.pageClass = 'dito-page--wide'
    }

    onMounted(() => {
      // The tab of a nested route, e.g. after reloading the form of an item of
      // a list in a tab, belongs to the nested form:
      const tab = routeTab.value
      if (shouldFollowRouteTab.value && tab && tab in renderedTabs.value) {
        selectTab(tab)
      } else {
        selectDefaultTab()
      }
    })

    onUnmounted(() => {
      emitEvent('destroy')
      unregisterUi()
      if (isWidePage) {
        appState.pageClass = null
      }
    })

    // Replaces the errors of validation, or of the `server`, within `dataPath`,
    // reveals them, and notifies them with the ones that no field displays:
    const showErrors = async (
      errors,
      { dataPath = props.dataPath, server = false } = {}
    ) => {
      const unmatchedErrors = getModel().replaceErrors(errors, {
        dataPath,
        server
      })
      await revealErrors(
        Object.keys(errors).filter(dataPath => !unmatchedErrors?.[dataPath])
      )
      if (!isEmpty(errors)) {
        const messages = Object.entries(unmatchedErrors ?? {}).flatMap(
          ([dataPath, errs]) => {
            const field = labelize(parseDataPath(dataPath).pop())
            const prefix = field
              ? `The field ${field}`
              : `The ${formLabel.value}`
            return errs.map(({ message }) => `${prefix} ${message}`)
          }
        )
        admin.notify({
          type: 'error',
          title: 'Validation Errors',
          text: messages.join('\n') || 'Please correct the highlighted errors.'
        })
      }
    }

    // Reveals the fields with errors at `dataPaths` and focuses the first one.
    // If it's in the form of a nested route, that form opens and reveals the
    // errors that it takes over from its item instead.
    const revealErrors = async (
      dataPaths = getModel().getErrorDataPaths(props.dataPath)
    ) => {
      const { container, route } = services
      const [firstDataPath] = dataPaths
      // Only the data of route components is part of routes, unlike the data
      // of dialogs and panels with their own data:
      const formRoute =
        firstDataPath && container === route?.container
          ? route.getFormRoute(firstDataPath)
          : null
      if (formRoute) {
        // The form may be open already, e.g. a nested form, which displays in
        // the form of its parent:
        const failure =
          router.currentRoute.value.path !== formRoute.path
            ? await router.push({ path: formRoute.path })
            : null
        if (!failure) {
          await nextTick()
          const level = router.currentRoute.value.matched.length - 1
          await admin.ui.routes[level].container.revealErrors()
        }
      } else {
        for (const dataPath of dataPaths) {
          const path = getComponentPathByDataPath(
            props.schema,
            props.data,
            dataPath,
            {
              dataPath: props.dataPath,
              componentPath: componentPath.value,
              services,
              rootData: context.rootItem
            }
          )
          await admin.ui.reveal(container, path, {
            focus: dataPath === firstDataPath
          })
        }
      }
    }

    // Validates the data, not the mounted components, so that fields in
    // collapsed schemas and closed nested forms are validated too.
    const validateAll = (match, notify = true) => {
      const dataValidationErrors = hasData.value
        ? getDataValidationErrors(props.schema, props.data, {
            dataPath: props.dataPath,
            services,
            rootData: context.rootItem
          })
        : null
      const errors = match
        ? getMatchingValidationErrors(dataValidationErrors, match)
        : dataValidationErrors
      if (notify) {
        showErrors(errors ?? {}).catch(console.error)
      }
      return !errors
    }

    return {
      context,
      createContext,
      emitEvent,
      container: services.container,
      opened,
      tabs,
      hasTabs,
      hasData,
      hasLabel,
      renderedTabs,
      selectedTab,
      selectTab,
      isTopLevelSchema,
      isTabSelected,
      validateAll,
      revealErrors,

      panelEntries: computed(() =>
        // Panels of schemas inlined in tabs are only shown with their tab, as
        // the panels of components in tabs, see `DitoContainer`.
        getPanelEntries(
          props.schema.panels,
          props.dataPath,
          componentPath.value,
          panelTab
        )
      ),

      clipboard: computed(() => props.schema?.clipboard ?? null),

      hasHeader: computed(
        () => hasLabel.value || hasTabs.value || !!props.schema?.clipboard
      ),

      hasMainPane: computed(() => {
        const { components } = props.schema
        return !!components && Object.keys(components).length > 0
      }),

      // Tabs render once they're selected, and stay rendered:
      shouldRenderTab(tab) {
        return isTabSelected(tab) || !!mountedTabs[tab]
      },

      onOpen(open) {
        emitEvent('open', { context: { open } })
        opened.value = open
      },

      onChange() {
        emitEvent('change')
      },

      // Shows the errors of the server for the data that was sent, at
      // `dataPath`: the root data, the schema's own data, or e.g. the data of a
      // list with its own resource.
      showValidationErrors(
        errors,
        dataPath = props.hasOwnData ? props.dataPath : ''
      ) {
        // Convert the data paths from JavaScript property access notation to
        // our own form of relative JSON pointers, prefixed with the data path
        // of the sent data, which the server validates unprefixed.
        const errorsByFullDataPath = Object.fromEntries(
          Object.entries(errors).map(([path, errs]) => [
            normalizeDataPath(appendDataPath(dataPath, path)),
            errs
          ])
        )
        return showErrors(errorsByFullDataPath, { dataPath, server: true })
      },

      // Writes the data pasted through `DitoClipboard` into the schema's data,
      // as new items:
      pasteData(clipboardData) {
        const data = fromClipboard(props.dataSchema, clipboardData, {
          dataPath: props.dataPath,
          services,
          rootData: context.rootItem
        })
        for (const [name, value] of Object.entries(data)) {
          if (name in props.data) {
            getModel().set(props.data, name, value)
          }
        }
      },

      // Processes the schema's data for `target`, the 'server' or the
      // 'clipboard', see `SchemaGraph`.
      processData(target) {
        return processData(
          props.dataSchema,
          unref(sourceSchema),
          props.data,
          props.dataPath,
          { rootData: context.rootItem, services, target }
        )
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
}

.dito-schema-header {
  display: flex;
  justify-content: space-between;
  // Let nested labels with ellipsis shrink below their content width.
  min-width: 0;

  .dito-header & {
    // When teleported into main header.
    align-items: flex-end;
  }

  > .dito-label {
    margin-bottom: 0;
  }

  // TODO: BEM: Style an element class of this block, e.g. `&__buttons`.
  > .dito-buttons {
    margin-left: var(--button-margin, 0);
  }
}
</style>
