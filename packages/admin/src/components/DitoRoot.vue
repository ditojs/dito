<template lang="pug">
.dito-root(
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
import { markRaw } from 'vue'
import { delegate as tippyDelegate } from 'tippy.js'
import DitoComponent from '../DitoComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import DitoDialog from './DitoDialog.vue'
import { setupSchemaComponents } from '../utils/schema/setup.js'
import { RouteTree } from '../utils/RouteTree.ts'
import { FileDropTargets } from '../utils/FileDropTargets.js'

// @vue/component
export default DitoComponent.component('DitoRoot', {
  mixins: [DomMixin],
  components: { DitoDialog },

  provide() {
    return {
      $fileDropTargets: () => this.fileDropTargets
    }
  },

  props: {
    options: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      dialogs: {},
      // Tracks the files dragged over the admin, for the uploads to drop them
      // on, see `DitoTypeUpload`:
      fileDropTargets: markRaw(new FileDropTargets()),
      // Whether `session.start()` finished, after which the login link is
      // shown without a user, e.g. once the login dialog was canceled:
      hasSessionStarted: false,
      // Detaches the login dialog and notifications from the session:
      detachSessionUserInterface: null
    }
  },

  computed: {
    notifications() {
      return this.isMounted && this.$refs.notifications
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
    // With hot-reloading, it looks like destroyed hooks aren't always called
    // for route components so reset the array of registered components instead.
    this.appState.routeComponents = []
    this.admin.attachUserInterface({
      showDialog: (schema, options) => this.showDialog(schema, options),
      notify: options => this.notify(options),
      closeNotifications: () => this.closeNotifications()
    })
    this.detachSessionUserInterface = this.admin.session.attachUserInterface({
      requestLoginData: () => this.showLoginDialog(),
      notify: options => this.notify(options)
    })
  },

  unmounted() {
    this.detachSessionUserInterface()
  },

  async mounted() {
    // Only the overlay is rendered here, the uploads handle the dropped files.
    this.domOn(document, this.fileDropTargets.getDocumentEventHandlers())

    tippyDelegate(this.$el, {
      target: '.dito-info',
      theme: 'info',
      animation: 'shift-away-subtle',
      interactive: true,
      delay: 250,
      zIndex: 1,
      appendTo: node => node.closest('.dito-pane'),
      onShow: instance => instance.setContent(instance.reference.dataset.info)
    })

    // Warn before the page is reloaded or closed with unsaved changes. Route
    // changes within the admin are guarded by `RouteMixin` instead.
    this.domOn(window, {
      beforeunload: event => {
        if (this.hasUnsavedChanges()) {
          event.preventDefault()
          // Required by older browsers to show the warning:
          event.returnValue = ''
        }
      }
    })

    try {
      await this.admin.session.start()
    } catch (error) {
      console.error(error)
    }
    this.hasSessionStarted = true
  },

  methods: {
    notify(options) {
      this.notifications.notify(options)
    },

    closeNotifications() {
      this.notifications.destroyAll()
    },

    // Returns true if any of the route components has unsaved changes.
    hasUnsavedChanges() {
      return this.appState.routeComponents.some(
        routeComponent => routeComponent.isDirty
      )
    },

    // Shows a dialog with the `components` and `buttons` of `schema`, and
    // resolves with the value that it's closed with, see `DitoDialog`.
    async showDialog({ components, buttons }, { data, settings } = {}) {
      // Process components to resolve async schemas first, so that errors
      // reject the returned promise.
      const schema = { type: 'dialog', components }
      const { api } = this.admin
      await setupSchemaComponents(api, schema)
      if (new RouteTree({ dialog: schema }, api).hasRoutedForms()) {
        throw new Error('Dialogs do not support components that produce routes')
      }
      return new Promise(resolve => {
        const key = `dialog-${++dialogId}`
        this.dialogs[key] = {
          components,
          buttons,
          data,
          settings,
          promise: { resolve }
        }
      })
    },

    removeDialog(key) {
      delete this.dialogs[key]
    },

    // Shows the login dialog for `Session.login()`, and returns the entered
    // credentials, or `null` if the user cancels.
    showLoginDialog() {
      const { additionalComponents } = this.options.login || {}
      return this.showDialog({
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
        // NOTE: Login must come before cancel in DOM order so that password
        // managers (e.g. 1Password) target the submit button instead of cancel.
        // DitoDialog uses CSS order to visually place cancel first.
        buttons: {
          login: {
            type: 'submit',
            text: 'Login'
          },

          cancel: {
            type: 'button',
            text: 'Cancel'
            // NOTE: The click event is added in DitoDialog.buttonSchemas()
          }
        }
      })
    }
  }
})

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
