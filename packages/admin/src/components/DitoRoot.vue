<template lang="pug">
.dito-root(
  ref="root"
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
      @remove="removeDialog(key)"
    )
  DitoNavigation
  main.dito-page.dito-scroll-parent(:class="appState.pageClass")
    DitoHeader(
      :spinner="options.spinner"
      :isLoading="admin.loadingTracker.isLoading"
    )
    DitoRouterView(:routeLevel="0")
  DitoSidebar
    DitoAccount(
      v-if="admin.user"
    )
    button.dito-login(
      v-else-if="hasSessionStarted"
      type="button"
      @click="admin.session.login()"
    )
      span Login
  DitoNotifications(ref="notifications")
</template>

<script>
import {
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
import DitoDialog from './DitoDialog.vue'
import { setupSchemaComponents } from '../utils/schema/setup.js'
import { RouteTree } from '../utils/RouteTree.ts'
import { FileDropTargets } from '../utils/FileDropTargets.js'

export default {
  name: 'DitoRoot',
  components: { DitoDialog },

  props: {
    options: { type: Object, default: () => ({}) }
  },

  setup(props) {
    const admin = inject('admin')
    const { domOn } = useDomEvents()
    const root = useTemplateRef('root')
    const notifications = useTemplateRef('notifications')
    const dialogs = reactive({})
    // The files dragged over the admin, for the uploads to drop them on:
    const fileDropTargets = markRaw(new FileDropTargets())
    provide('fileDropTargets', fileDropTargets)
    // The login link shows without a user once the session started:
    const hasSessionStarted = ref(false)

    const showDialog = async ({ components, buttons }, options = {}) => {
      const { data, settings } = options
      // Resolve async schemas first, so that their errors reject:
      const schema = { type: 'dialog', components }
      const { api } = admin
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

    appState.title = document.title || 'Dito.js Admin'
    admin.attachDialogsAndNotifications({
      showDialog,
      notify,
      closeNotifications: () => notifications.value.destroyAll()
    })
    const detachSessionUserInterface = admin.session.attachUserInterface({
      notify,
      // Return the entered credentials, or `null` if the user cancels:
      requestLoginData() {
        const { additionalComponents } = props.options.login || {}
        return showDialog({
          components: {
            username: {
              type: 'text',
              autofocus: true
            },
            password: {
              type: 'password'
            },
            ...additionalComponents
          },
          // NOTE: Login comes first in DOM order for password managers, CSS
          // places cancel first:
          buttons: {
            login: {
              type: 'submit',
              text: 'Login'
            },

            cancel: {
              type: 'button',
              text: 'Cancel'
            }
          }
        })
      }
    })
    onUnmounted(detachSessionUserInterface)

    onMounted(async () => {
      // The uploads handle the dropped files, the root only the overlay:
      domOn(document, fileDropTargets.getDocumentEventHandlers())

      tippyDelegate(root.value, {
        target: '.dito-info',
        theme: 'info',
        animation: 'shift-away-subtle',
        interactive: true,
        delay: 250,
        zIndex: 1,
        appendTo: node => node.closest('.dito-pane'),
        onShow: instance => instance.setContent(instance.reference.dataset.info)
      })

      // Warn about unsaved changes, also the ones being submitted, as
      // `beforeunload` can't wait for them:
      domOn(window, {
        beforeunload: event => {
          for (const route of admin.ui.routes) {
            route.container.model.writePendingValues()
          }
          if (admin.ui.routes.some(route => route.isDirty)) {
            event.preventDefault()
            // Required by older browsers to show the warning:
            event.returnValue = ''
          }
        }
      })

      try {
        await admin.session.start()
      } catch (error) {
        console.error(error)
      }
      hasSessionStarted.value = true
    })

    return {
      admin,
      appState,
      dialogs,
      fileDropTargets,
      hasSessionStarted,

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
