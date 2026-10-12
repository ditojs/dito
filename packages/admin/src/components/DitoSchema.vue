<template lang="pug">
slot(name="prepend")
.dito-schema(
  :class="{ 'dito-scroll-parent': scrollable, 'dito-schema--open': opened }"
  v-bind="$attrs"
)
  Teleport(
    v-if="dataContext.hasData && panelEntries.length > 0"
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
    // Panels without own data display the data of another schema:
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
    const sourceSchema = inject('sourceSchema', null)
    const panelTab = inject('panelTab', null)
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
    const { getSchemaValue, getLabel, shouldRenderSchema } =
      useSchemaValue(context)
    const formLabel = computed(() =>
      getLabel(getItemFormSchema(unref(sourceSchema), props.data, context))
    )

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
      // Inlined schemas share the width of their container:
      provide('accumulatedBasis', 1)
    }

    const content = useTemplateRef('content')
    const selectedTab = ref(null)
    // Selected or revealed tabs stay rendered:
    const mountedTabs = reactive({})
    // Follow `defaultTab` until a tab is selected or there is data:
    let shouldFollowDefaultTab = true
    const scrollPositions = {}

    const opened = useStore(props).getStoreRef('opened', () => !props.collapsed)

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

    const routeTab = computed(
      () => router.currentRoute.value.hash?.slice(1) || null
    )

    const isTopLevelSchema = computed(
      () => !isPanel(props.schema) && !props.inlined
    )

    // The route's hash belongs to the tabs of the last route only, so forms
    // keep their tab while the forms of their items are open:
    const shouldFollowRouteTab = computed(
      () => (
        hasTabs.value &&
        isTopLevelSchema.value &&
        !!services.routeContext?.isLastRoute
      )
    )

    const isTabSelected = tab => selectedTab.value === tab

    const selectTab = tab => {
      selectedTab.value = tab
      shouldFollowDefaultTab = false
      emit('update:selectedTab', tab)
    }

    // Editing the data doesn't switch the tab:
    const selectDefaultTab = () => {
      selectedTab.value = defaultTab.value
      shouldFollowDefaultTab = !hasData.value
      emit('update:selectedTab', selectedTab.value)
    }

    // Routes without a hash, e.g. after closing a form, keep the tab:
    const followRouteTab = () => {
      if (
        shouldFollowRouteTab.value &&
        routeTab.value &&
        routeTab.value !== selectedTab.value
      ) {
        selectTab(routeTab.value)
      }
    }

    // Tabs that aren't rendered fall back to the default tab:
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

    // Returning from a nested form, the route may carry a different tab:
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
        mountedTabs[newTab] = true
      }
      if (props.scrollable) {
        const element = content.value
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
      // The tab of a nested route belongs to the nested form:
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

    // Notify the errors that no field displays:
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
        adminContext.notify({
          type: 'error',
          title: 'Validation Errors',
          text: messages.join('\n') || 'Please correct the highlighted errors.'
        })
      }
    }

    // Fields in the forms of nested routes open the form, which reveals the
    // errors that it takes over from its item:
    const revealErrors = async (
      dataPaths = getModel().getErrorDataPaths(props.dataPath)
    ) => {
      const { dataContext, routeContext } = services
      const [firstDataPath] = dataPaths
      // Dialogs and panels with their own data aren't part of routes:
      const formRoute =
        firstDataPath && dataContext === routeContext?.dataContext
          ? routeContext.getFormRoute(firstDataPath)
          : null
      if (formRoute) {
        // The form may be open already, e.g. a nested form:
        const failure =
          router.currentRoute.value.path !== formRoute.path
            ? await router.push({ path: formRoute.path })
            : null
        if (!failure) {
          await nextTick()
          const level = router.currentRoute.value.matched.length - 1
          await adminContext.ui.routes[level].dataContext.revealErrors()
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
          await adminContext.ui.reveal(dataContext, path, {
            focus: dataPath === firstDataPath
          })
        }
      }
    }

    // Validate the data, not the mounted components, to include collapsed
    // schemas and closed nested forms:
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
      dataContext: services.dataContext,
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
        // Panels of schemas inlined in tabs only show with their tab:
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

      // The sent data is at `dataPath`, e.g. of a list with its own resource:
      showValidationErrors(
        errors,
        dataPath = props.hasOwnData ? props.dataPath : ''
      ) {
        // Convert the server's paths in property access notation, which lack
        // the data path of the sent data:
        const errorsByFullDataPath = Object.fromEntries(
          Object.entries(errors).map(([path, errs]) => [
            normalizeDataPath(appendDataPath(dataPath, path)),
            errs
          ])
        )
        return showErrors(errorsByFullDataPath, { dataPath, server: true })
      },

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

      // `target` is 'server' or 'clipboard':
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
