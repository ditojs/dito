<template lang="pug">
.dito-root(
  ref="root"
  :class="rootClasses"
  :data-agent-browser="appState.agent.browser"
  :data-agent-platform="appState.agent.platform"
  :data-agent-version="appState.agent.versionNumber"
)
  Transition(name="dito-drag")
    .dito-drag-overlay(
      v-if="fileDropTargets.isDraggingFiles"
    )
  TransitionGroup(name="dito-dialog")
    DitoDialog(
      v-for="(dialog, key) in dialogs"
      :key="key"
      :components="dialog.components"
      :buttons="dialog.buttons"
      :promise="dialog.promise"
      :data="dialog.data"
      :settings="dialog.settings"
      :inert="key !== topDialogKey"
      @remove="removeDialog(key)"
    )
  DitoNavigation#dito-navigation(
    ref="navigation"
    :class="`dito-navigation--${menu.state}`"
    :inert="!!topDialogKey"
  )
    button.dito-navigation__close(
      v-if="menu.isOverlay"
      type="button"
      aria-label="Close Menu"
      @click="menu.toggle()"
    )
  main.dito-page.dito-scroll-parent(
    :class="adminContext.pageClass"
    :inert="!!topDialogKey"
  )
    DitoHeader(
      :spinner="options.spinner"
      :isLoading="adminContext.loadingTracker.isLoading"
    )
      template(#prepend)
        button.dito-header__toggle(
          ref="menuButton"
          type="button"
          aria-label="Menu"
          aria-controls="dito-navigation"
          :aria-expanded="menu.isExpanded"
          @click="menu.toggle()"
        )
    .dito-page__content.dito-scroll-parent
      DitoRouterView(:routeLevel="0")
  DitoSidebar(
    ref="aside"
    :class="`dito-sidebar--${sidebar.state}`"
    :inert="!!topDialogKey"
  )
    DitoAccount(
      v-if="adminContext.user"
    )
    button.dito-login(
      v-else-if="hasSessionStarted"
      type="button"
      @click="adminContext.session.login()"
    )
      span Sign In
    button.dito-header__toggle(
      ref="sidebarButton"
      type="button"
      aria-label="Sidebar"
      aria-controls="dito-sidebar"
      :aria-expanded="sidebar.isExpanded"
      @click="sidebar.toggle()"
    )
  DitoNotifications(ref="notifications")
</template>

<script>
import {
  computed,
  inject,
  markRaw,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  useTemplateRef
} from 'vue'
import { delegate as tippyDelegate } from 'tippy.js'
import appState from '../appState.js'
import { useDomEvents } from '../composables/useDomEvents.ts'
import { useSidebar } from '../composables/useSidebar.ts'
import DitoDialog from './DitoDialog.vue'
import {
  applySchemaDefaults,
  setupSchemaComponents
} from '../utils/schema/setup.js'
import { RouteTree } from '../utils/RouteTree.ts'
import { FileDropTargets } from '../utils/FileDropTargets.js'
import { adminContextKey, fileDropTargetsKey } from '../utils/keys.ts'

export default {
  components: { DitoDialog },

  props: {
    options: { type: Object, default: () => ({}) }
  },

  setup() {
    const adminContext = inject(adminContextKey)
    const { domOn } = useDomEvents()
    const root = useTemplateRef('root')
    const notifications = useTemplateRef('notifications')
    const dialogs = reactive({})
    // The files dragged over the admin, for the uploads to drop them on:
    const fileDropTargets = markRaw(new FileDropTargets())
    provide(fileDropTargetsKey, fileDropTargets)
    // The login link shows without a user once the session started:
    const hasSessionStarted = ref(false)
    const navigation = useTemplateRef('navigation')
    const menu = useSidebar({
      name: 'menu',
      breakpoint: 800,
      region: computed(() => navigation.value?.content),
      button: useTemplateRef('menuButton')
    })
    const aside = useTemplateRef('aside')
    const sidebar = useSidebar({
      name: 'sidebar',
      // The form needs the room first, so the sidebar hides before the menu:
      breakpoint: 1200,
      region: computed(() => aside.value?.region),
      button: useTemplateRef('sidebarButton')
    })
    // The overlay sidebar keeps the room of its header, which the page's
    // content reaches under, up to the root's edge. CSS can't know the
    // header's width, so measure the room whenever the root's columns change:
    let sidebarObserver = null

    const showDialog = async ({ components, buttons, data, settings }) => {
      // Resolve async schemas first, so that their errors reject:
      const schema = { type: 'dialog', components, buttons }
      const { api } = adminContext
      applySchemaDefaults(api, schema)
      await setupSchemaComponents(api, schema)
      if (new RouteTree({ dialog: schema }, api).hasRoutedForms()) {
        throw new Error('Dialogs do not support components that produce routes')
      }
      return new Promise(resolve => {
        const key = `dialog-${++dialogId}`
        dialogs[key] = {
          components,
          buttons,
          data,
          settings,
          promise: { resolve }
        }
      })
    }

    const notify = options => notifications.value.notify(options)

    adminContext.attachDialogsAndNotifications({ showDialog, notify })
    onUnmounted(() => sidebarObserver.disconnect())

    onMounted(async () => {
      const sidebarElement = aside.value.$el
      sidebarObserver = new ResizeObserver(() => {
        const { right } = root.value.getBoundingClientRect()
        const { left } = sidebarElement.getBoundingClientRect()
        root.value.style.setProperty('--dito-sidebar-room', `${right - left}px`)
      })
      for (const column of root.value.children) {
        sidebarObserver.observe(column)
      }
      // The uploads handle the dropped files, the root only the overlay:
      domOn(document, fileDropTargets.getDocumentEventHandlers())

      tippyDelegate(root.value, {
        target: '.dito-info',
        theme: 'info',
        animation: 'shift-away-subtle',
        interactive: true,
        delay: 250,
        zIndex: 1,
        // `DitoInfo` passes the info as HTML:
        allowHTML: true,
        appendTo: node => node.closest('.dito-pane'),
        onShow: instance => instance.setContent(instance.reference.dataset.info)
      })

      // Warn about unsaved changes, also the ones being submitted, as
      // `beforeunload` can't wait for them:
      domOn(window, {
        beforeunload: event => {
          if (adminContext.ui.routes.some(route => route.isDirty)) {
            event.preventDefault()
            // Required by older browsers to show the warning:
            event.returnValue = ''
          }
        }
      })

      try {
        await adminContext.session.start()
      } catch (error) {
        console.error(error)
      }
      hasSessionStarted.value = true
    })

    return {
      adminContext,
      appState,
      dialogs,
      fileDropTargets,
      hasSessionStarted,
      menu,
      sidebar,
      // Everything behind the topmost dialog is inert, so that it can't be
      // selected, focused or clicked:
      topDialogKey: computed(() => Object.keys(dialogs).at(-1) ?? null),
      rootClasses: computed(() => ({
        'dito-root--overlay-sidebar': sidebar.isOverlay,
        'dito-root--sliding-sidebar': sidebar.isSliding
      })),

      removeDialog(key) {
        delete dialogs[key]
      }
    }
  }
}

let dialogId = 0
</script>

<style lang="scss">
@import '../styles/style';

.dito-app,
.dito-root {
  width: 100%;
  height: 100%;
  display: flex;
}

.dito-root {
  // Only the admin's containers scroll. Clip what reaches beyond the window,
  // e.g. the header backgrounds, so that phones can't pan it:
  overflow: hidden;

  // The page's content reaches under the header of the overlay sidebar, while
  // the page's header stays next to it:
  &--overlay-sidebar .dito-page__content {
    margin-right: calc(-1 * var(--dito-sidebar-room));
  }

  // Grow and shrink with the sliding sidebar, and with resizes right away:
  &--sliding-sidebar .dito-page__content {
    transition: margin-right $sidebar-duration;
  }
}

.dito-page {
  // For the layout of `DitoContainer` in narrow pages:
  container: dito-page / inline-size;

  --max-content-width: #{$content-width};
  --max-page-width: calc(var(--max-content-width) + 2 * #{$content-padding});

  flex: 0 1 var(--max-page-width);
  background: $content-color-background;
  min-width: 0%;
  max-width: var(--max-page-width);
  overflow: visible; // For .dito-header full-width background.

  &--wide {
    --max-content-width: #{$content-width-wide};
  }

  &__content {
    max-width: var(--max-page-width);
  }
}

.dito-login {
  padding: 0;
  border: 0;
  color: inherit;
  background: none;

  &:focus-visible {
    @include focus-ring;
  }
}

.dito-drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: $z-index-drag-overlay;
  background: rgb(0, 0, 0, 0.25);
  pointer-events: none;
  backdrop-filter: blur(8px);
}

.dito-drag-enter-active,
.dito-drag-leave-active {
  transition:
    opacity $drag-overlay-duration,
    backdrop-filter $drag-overlay-duration;
}

.dito-drag-enter-from,
.dito-drag-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}
</style>
