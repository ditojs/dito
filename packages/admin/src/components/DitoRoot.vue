<template lang="pug">
.dito-root
  VueNotifications.dito-notifications(
    ref="notifications"
    position="top right"
    classes="dito-notification"
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
  DitoMenu
  main.dito-page.dito-scroll-parent
    DitoHeader(
      :spinner="options.spinner"
      :isLoading="isLoading"
    )
      DitoAccount(
        v-if="user"
      )
      a.dito-login(
        v-else-if="allowLogin"
        @click="rootComponent.login()"
      )
        span Login
    RouterView
</template>

<script>
import { delegate as tippyDelegate } from 'tippy.js'
import { asArray, mapConcurrently, stripTags } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DitoUser from '../DitoUser.js'
import DitoView from '../components/DitoView.vue'
import DitoDialog from './DitoDialog.vue'
import DomMixin from '../mixins/DomMixin.js'
import {
  processView,
  resolveSchemas,
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
      allowLogin: false,
      loadingCount: 0
    }
  },

  computed: {
    notifications() {
      return this.$refs.notifications
    },

    isLoading() {
      return this.loadingCount > 0
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
    // With hot-reloading, it looks like destroyed hooks aren't always called
    // for route components so reset the array of registered components instead.
    this.appState.routeComponents = []
  },

  async mounted() {
    tippyDelegate(this.$el, {
      target: '[data-tippy-content]'
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
    notify({ type = 'info', title, text } = {}) {
      title ||= (
        {
          warning: 'Warning',
          error: 'Error',
          info: 'Information',
          success: 'Success'
        }[type] ||
        'Notification'
      )
      text = `<p>${
        asArray(text).join('</p> <p>')
      }</p>`.replace(/\n|\r\n|\r/g, '<br>')
      const log = (
        {
          warning: 'warn',
          error: 'error',
          info: 'log',
          success: 'log'
        }[type] ||
        'error'
      )
      // eslint-disable-next-line no-console
      console[log](stripTags(text))
      const { notifications = true } = this.api
      if (notifications) {
        // Calculate display-duration for the notification based on its content
        // and the setting of the `durationFactor` configuration. It defines the
        // amount of milliseconds multiplied with the amount of characters
        // displayed in the notification, plus 40 (40 + title + message):
        const { durationFactor = 20 } = notifications
        const duration = (40 + text.length + title.length) * durationFactor
        this.$notify({ type, title, text, duration })
      }
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
          const error = err.response?.data?.error
          this.notify({
            type: 'error',
            title: 'Authentication Error',
            text: error || err
          })
          if (!error) {
            console.error(err, err.response)
          }
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
        this.notify({
          type: 'error',
          title: 'Authentication Error',
          text: err
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
        this.resolvedViews = await resolveSchemas(this.unresolvedViews)
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
        ...routes
      ])
      this.$router.replace(fullPath)
    }
  }
})

let dialogId = 0

function addRoutes(router, routes) {
  const removers = []
  for (const route of routes) {
    const removeRoute = router.addRoute(route)
    removers.push(removeRoute)
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

.dito-root {
  .dito-page {
    background: $content-color-background;
  }
}
</style>
