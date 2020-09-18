<template lang="pug">
  .dito-root
    modals-container
    notifications.dito-notifications(
      ref="notifications"
      position="top right"
      classes="dito-notification"
    )
    dito-menu(
      :views="resolvedViews"
    )
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
  @import 'dito.sass'
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
import DitoComponent from '@/DitoComponent'
import DitoUser from '@/DitoUser'
import DitoView from '@/components/DitoView'
import DomMixin from '@/mixins/DomMixin'
import { getMemberResource } from '@/utils/resource'
import { processView, resolveViews } from '@/utils/schema'
import { equals, stripTags } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-root', {
  mixins: [DomMixin],

  props: {
    views: { type: [Object, Function, Promise], required: true },
    options: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      allowLogin: false,
      resolvedViews: {},
      notificationCount: 0,
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
  },

  async mounted() {
    // Clear the label marked as active on all mouse and keyboard events, except
    // the ones that DitoLabel itself intercepts.
    const clearActiveLabel = () => {
      this.appState.activeLabel = null
    }
    this.domOn(document, {
      mouseup: clearActiveLabel,
      keyup: clearActiveLabel
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
    notify(...args) {
      const type = args.length > 1 ? args.shift() : 'info'
      const title = args.length > 1 ? args.shift() : {
        warning: 'Warning',
        error: 'Error',
        info: 'Information',
        success: 'Success'
      }[type] || 'Notification'
      const text = `<p>${args.join('</p> <p>')}</p>`
        .replace(/\r\n|\n|\r/g, '<br>')
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
      this.notificationCount++
    },

    countNotifications(count = 0) {
      return this.notificationCount - count
    },

    closeNotifications() {
      this.notifications.destroyAll()
    },

    registerLoading(isLoading) {
      this.loadingCount += isLoading ? 1 : -1
    },

    async login() {
      this.allowLogin = true
      const loginData = await this.showDialog({
        components: {
          username: {
            type: 'text',
            autofocus: true
          },
          password: {
            type: 'password'
          }
        },
        buttons: {
          cancel: {},
          login: { type: 'submit' }
        }
      })
      if (loginData) {
        try {
          const response = await this.request({
            resource: this.api.users.login,
            data: loginData,
            internal: true
          })
          this.setUser(response.data.user)
          await this.resolveViews()
        } catch (err) {
          const error = err.response?.data?.error
          this.notify('error', 'Authentication Error', error || err)
          if (!error) {
            console.error(err, err.response)
          }
          this.login()
        }
      }
    },

    async logout() {
      try {
        const response = await this.request({
          resource: this.api.users.logout,
          internal: true
        })
        if (response.data.success) {
          this.setUser(null)
          this.$router.push({ path: '/' })
        }
      } catch (err) {
        console.error(err)
      }
    },

    async fetchUser() {
      let user = null
      try {
        const response = await this.request({
          resource: this.api.users.session,
          internal: true
        })
        user = response.data.user || null
      } catch (err) {
        this.notify('error', 'Authentication Error', err)
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
        this.$router.push({ path: '/' })
      }
    },

    async ensureUser() {
      if (!(await this.fetchUser())) {
        await this.login()
      }
    },

    async resolveViews() {
      try {
        const views = await resolveViews(this.views)
        // Copy views to convert from module to a plain object:
        this.resolvedViews = { ...views }
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
      this.$router.addRoutes(routes)
    },

    async request({ method, url, resource, data, params, internal }) {
      url = url || this.getResourcePath(resource)
      method = method || resource?.method
      const checkUser = !internal && this.api.isApiRequest(url)
      if (checkUser) {
        await this.ensureUser()
      }
      const response = await this.api.request({ method, url, data, params })
      // Detect change of the own user, and fetch it again if it was changed.
      if (
        checkUser &&
        method === 'patch' &&
        equals(resource, getMemberResource(this.user.id, this.api.users))
      ) {
        await this.fetchUser()
      }
      return response
    }
  }
})
</script>
