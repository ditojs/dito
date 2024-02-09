<template lang="pug">
.dito-root(
  :data-agent-browser="appState.agent.browser"
  :data-agent-platform="appState.agent.platform"
  :data-agent-version="appState.agent.versionNumber"
)
  Transition(name="dito-drag")
    .dito-drag-overlay(
      v-if="isDraggingFiles"
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
  main.dito-page.dito-scroll-parent(
    v-resize="onResizePage"
    :class="pageClasses"
  )
    DitoHeader(
      :spinner="options.spinner"
      :isLoading="isLoading"
    )
    RouterView
  DitoSidebar
    DitoAccount(
      v-if="user"
    )
    a.dito-login(
      v-else-if="allowLogin"
      @click="rootComponent.login()"
    )
      span Login
  DitoNotifications(ref="notifications")
</template>

<script>
import { delegate as tippyDelegate } from 'tippy.js'
import { mapConcurrently } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DomMixin from '../mixins/DomMixin.js'
import DitoUser from '../DitoUser.js'
import DitoView from '../components/DitoView.vue'
import DitoDialog from './DitoDialog.vue'
import {
  processView,
  resolveViews,
  processSchemaComponents
} from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('DitoRoot', {
  mixins: [DomMixin],
  components: { DitoDialog },

  provide() {
    return {
      $views: () => this.resolvedViews
    }
  },

  props: {
    unresolvedViews: { type: [Object, Function, Promise], required: true },
    options: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      resolvedViews: {},
      removeRoutes: null,
      dialogs: {},
      pageWidth: 0,
      loadingCount: 0,
      allowLogin: false,
      isDraggingFiles: false
    }
  },

  computed: {
    notifications() {
      return this.isMounted && this.$refs.notifications
    },

    isLoading() {
      return this.loadingCount > 0
    },

    pageClasses() {
      const prefix = 'dito-page'
      // NOTE: Keep synced with $content-width in SCSS:
      const contentWidth = 900
      return [
        this.appState.pageClass,
        {
          [`${prefix}--width-80`]: this.pageWidth <= contentWidth * 0.8,
          [`${prefix}--width-60`]: this.pageWidth <= contentWidth * 0.6
        }
      ]
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
    // With hot-reloading, it looks like destroyed hooks aren't always called
    // for route components so reset the array of registered components instead.
    this.appState.routeComponents = []
  },

  async mounted() {
    this.setupDragAndDrop()

    tippyDelegate(this.$el, {
      target: '.dito-info',
      theme: 'info',
      appendTo: node => node.closest('.dito-pane'),
      animation: 'shift-away-subtle',
      interactive: true,
      delay: 250,
      zIndex: 1,
      onCreate(instance) {
        instance.setContent(instance.reference.dataset.info)
      }
    })

    // Clear the label marked as active on all mouse and keyboard events, except
    // the ones that DitoLabel itself intercepts.
    this.domOn(document, {
      click: event => {
        if (!event.target.closest('.dito-label')) {
          this.appState.activeLabel = null
        }
      },

      keyup: event => {
        if (event.code === 'Tab') {
          this.appState.activeLabel = null
        }
      }
    })

    try {
      this.allowLogin = false
      if (await this.fetchUser()) {
        await this.resolveViews()
      } else {
        await this.login()
      }
    } catch (err) {
      console.error(err)
    }
    this.allowLogin = true
  },

  methods: {
    setupDragAndDrop() {
      // This code only happens the visual effects around dragging and dropping
      // files into a `DitoTypeUpload` component. The actual uploading is
      // handled by the `DitoTypeUpload` component itself.

      let dragCount = 0
      let uploads = []

      const toggleDropTargetClass = enabled => {
        for (const upload of uploads) {
          upload
            .closest('.dito-container')
            .classList.toggle('dito-drop-target', enabled)
        }
        if (!enabled) {
          uploads = []
        }
      }

      const setDraggingFiles = enabled => {
        this.isDraggingFiles = enabled
        if (enabled) {
          toggleDropTargetClass(true)
        } else {
          setTimeout(() => toggleDropTargetClass(false), 150)
        }
      }

      this.domOn(document, {
        dragenter: event => {
          if (!dragCount && event.dataTransfer) {
            uploads = document.querySelectorAll('.dito-upload')
            const hasUploads = uploads.length > 0
            event.dataTransfer.effectAllowed = hasUploads ? 'copy' : 'none'
            if (hasUploads) {
              setDraggingFiles(true)
            } else {
              event.preventDefault()
              event.stopPropagation()
              return
            }
          }
          dragCount++
        },

        dragleave: event => {
          dragCount--
          if (!dragCount && event.dataTransfer) {
            setDraggingFiles(false)
          }
        },

        dragover: event => {
          if (event.dataTransfer) {
            const canDrop = event.target.closest(
              '.dito-container:has(.dito-upload)'
            )
            event.dataTransfer.dropEffect = canDrop ? 'copy' : 'none'
            if (!canDrop) {
              event.preventDefault()
              event.stopPropagation()
            }
          }
        },

        drop: event => {
          dragCount = 0
          if (event.dataTransfer) {
            setDraggingFiles(false)
          }
        }
      })
    },

    notify({ type = 'info', title, text, error } = {}) {
      this.notifications.notify({ type, title, text, error })
    },

    closeNotifications() {
      this.notifications.destroyAll()
    },

    registerLoading(isLoading) {
      this.loadingCount += isLoading ? 1 : -1
    },

    showDialog({ components, buttons, data, settings }) {
      // Shows a dito-dialog component and wraps it in a promise so that the
      // buttons in the dialog can use `dialog.resolve()` and `dialog.reject()`
      // to close the modal dialog and resolve / reject the promise at once.
      return new Promise(
        // eslint-disable-next-line no-async-promise-executor
        async (resolve, reject) => {
          // Process components to resolve async schemas.
          const routes = []
          await processSchemaComponents(
            this.api,
            { type: 'dialog', components },
            routes,
            0
          )
          if (routes.length > 0) {
            throw new Error(
              'Dialogs do not support components that produce routes'
            )
          }
          const key = `dialog-${++dialogId}`
          this.dialogs[key] = {
            components,
            buttons,
            data,
            settings,
            promise: { resolve, reject }
          }
        }
      )
    },

    removeDialog(key) {
      delete this.dialogs[key]
    },

    async login() {
      this.allowLogin = true
      const {
        additionalComponents,
        redirectAfterLogin
      } = this.options.login || {}
      const loginData = await this.showDialog({
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
        buttons: {
          cancel: {
            type: 'button',
            text: 'Cancel'
            // NOTE: The click event is added in DitoDialog.buttonSchemas()
          },

          login: {
            type: 'submit',
            text: 'Login'
          }
        }
      })
      if (loginData) {
        try {
          const response = await this.sendRequest({
            resource: this.api.users.login,
            data: loginData,
            internal: true
          })
          if (redirectAfterLogin) {
            location.replace(redirectAfterLogin)
          } else {
            this.setUser(response.data.user)
            await this.resolveViews()
          }
        } catch (err) {
          const error = err.response?.data?.error || err
          this.notify({
            type: 'error',
            error,
            title: 'Authentication Error',
            text: error
          })
          this.login()
        }
      }
    },

    navigateHome() {
      return this.navigate('/')
    },

    async logout() {
      try {
        const response = await this.sendRequest({
          resource: this.api.users.logout,
          internal: true
        })
        if (response.data.success) {
          this.setUser(null)
          this.navigateHome()
        }
      } catch (err) {
        console.error(err)
      }
    },

    async fetchUser() {
      let user = null
      try {
        const response = await this.sendRequest({
          resource: this.api.users.session,
          internal: true
        })
        user = response.data.user || null
      } catch (err) {
        const error = err.response?.data?.error || err
        this.notify({
          type: 'error',
          error,
          title: 'Authentication Error',
          text: error
        })
      }
      this.setUser(user)
      return user
    },

    setUser(user) {
      this.appState.user = (
        user &&
        Object.setPrototypeOf(user, DitoUser.prototype)
      )
      // Clear resolved views when user is logged out.
      if (!user) {
        this.resolvedViews = {}
        this.navigateHome()
      }
    },

    async ensureUser() {
      if (!(await this.fetchUser())) {
        await this.login()
      }
    },

    async resolveViews() {
      try {
        this.resolvedViews = await resolveViews(this.unresolvedViews)
      } catch (error) {
        if (!error.request) {
          console.error(error)
        }
        return this.login()
      }
      // Collect all routes from the root schema components
      const routes = await mapConcurrently(
        Object.entries(this.resolvedViews),
        ([name, schema]) => processView(DitoView, this.api, schema, name)
      )
      // Now that the routes are loaded, replace all existing routes with the
      // new routes, and restore the current path.
      const { fullPath } = this.$route
      this.removeRoutes?.()
      this.removeRoutes = addRoutes(this.$router, [
        {
          name: 'root',
          path: '/',
          components: {}
        },
        ...routes.flat()
      ])
      this.$router.replace(fullPath)
    },

    onResizePage({ contentRect: { width } }) {
      this.pageWidth = width
    }
  }
})

let dialogId = 0

function addRoutes(router, routes) {
  const removers = []
  for (const route of routes) {
    const remove = router.addRoute(route)
    removers.push(remove)
  }

  return () => {
    for (const remove of removers) {
      remove()
    }
  }
}
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

.dito-account,
.dito-login {
  cursor: pointer;
}

.dito-drag-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: $z-index-drag-overlay;
  background: rgba(0, 0, 0, 0.25);
  pointer-events: none;
  backdrop-filter: blur(8px);
}

.dito-drop-target {
  --shadow-alpha: 0.25;

  background: $content-color-background;
  border-radius: $border-radius;
  z-index: $z-index-drag-overlay + 1;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, var(--shadow-alpha)));
}

.dito-drag-enter-active,
.dito-drag-leave-active {
  $duration: 0.15s;

  transition:
    opacity $duration,
    backdrop-filter $duration;

  ~ * .dito-drop-target {
    transition: filter $duration;
  }
}

.dito-drag-enter-from,
.dito-drag-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);

  ~ * .dito-drop-target {
    --shadow-alpha: 0;
  }
}
</style>
