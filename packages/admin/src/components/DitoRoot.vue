<template lang="pug">
  .dito-root
    modals-container
    notifications.dito-notifications(
      ref="notifications"
      position="top right"
      classes="dito-notification"
    )
    dito-menu
    main.dito-page.dito-scroll-parent
      dito-header(
        :spinner="options.spinner"
        :isLoading="isLoading"
      )
        dito-account(
          v-if="user"
        )
        a.dito-login(
          v-else-if="allowLogin"
          @click="rootComponent.login()"
        )
          span Login
      router-view
</template>

<style lang="sass">
  @import '../styles/style.sass'

  .dito-root
    height: 100%
    display: flex
    .dito-page
      background: $content-color-background
      // The root-level views and forms may have a `.dito-schema-header` that
      // should appear layered over `.dito-menu`, while having `overlay: hidden`
      // set by `.dito-scroll-parent` to delegate scrolling to `.dito-scroll`.
      // In order to not have the header clipped, adjust the top here:
      > .dito-form,
      > .dito-view
        margin-top: -$menu-height
        padding-top: $menu-height
</style>

<script>
import { asArray, stripTags } from '@ditojs/utils'
import DitoComponent from '../DitoComponent.js'
import DitoUser from '../DitoUser.js'
import DitoView from '../components/DitoView.vue'
import DomMixin from '../mixins/DomMixin.js'
import { processView, resolveSchemas } from '../utils/schema.js'

// @vue/component
export default DitoComponent.component('dito-root', {
  mixins: [DomMixin],

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
      title ||= {
        warning: 'Warning',
        error: 'Error',
        info: 'Information',
        success: 'Success'
      }[type] || 'Notification'
      text = `<p>${
        asArray(text).join('</p> <p>')
      }</p>`.replace(/\n|\r\n|\r/g, '<br>')
      const log = {
        warning: 'warn',
        error: 'error',
        info: 'log',
        success: 'log'
      }[type] || 'error'
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
          cancel: {},
          login: { type: 'submit' }
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
      const routes = []
      const promises = []
      for (const [name, schema] of Object.entries(this.resolvedViews)) {
        promises.push(processView(DitoView, this.api, schema, name, routes))
      }
      await Promise.all(promises)
      for (const route of routes) {
        this.$router.addRoute(route)
      }
    }
  }
})
</script>
