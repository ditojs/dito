<template lang="pug">
  .dito
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
        :isLoading="appState.loadingCounter > 0"
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
  .dito
    // Import everything name-spaced in .dito
    @import 'dito.sass'
    height: 100%
    display: flex
</style>

<script>
import DitoComponent from '@/DitoComponent'
import DitoUser from '@/DitoUser'
import { getMemberResource } from '@/utils/resource'
import { processView, resolveViews } from '@/utils/schema'
import { equals, stripTags } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('dito-root', {
  props: {
    views: { type: [Object, Function, Promise], required: true },
    options: { type: Object, default: () => ({}) }
  },

  data() {
    return {
      allowLogin: false,
      resolvedViews: {},
      notificationCount: 0
    }
  },

  computed: {
    notifications() {
      return this.$refs.notifications
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
  },

  async mounted() {
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
      const duration = 1500 + (text.length + title.length) * 20
      this.$notify({ type, title, text, duration })
      const log = {
        warning: 'warn',
        error: 'error',
        info: 'log',
        success: 'log'
      }[type] || 'error'
      console[log](stripTags(text))
      this.notificationCount++
    },

    countNotifications(count = 0) {
      return this.notificationCount - count
    },

    closeNotifications() {
      this.notifications.destroyAll()
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
          login: {
            type: 'submit',
            events: {
              click({ dialogComponent }) {
                dialogComponent.accept()
              }
            }
          },

          cancel: {
            events: {
              click({ dialogComponent }) {
                dialogComponent.cancel()
              }
            }
          }
        }
      }, {
        width: '480px',
        height: 'auto',
        clickToClose: false
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
          if (error) {
            this.notify('error', 'Authentication Error', error)
          } else {
            this.notify('error', 'Authentication Error', err)
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
          this.resolvedViews = {}
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
      } finally {
        this.setUser(user)
      }
      return user
    },

    setUser(user) {
      this.appState.user = (
        user &&
        Object.setPrototypeOf(user, DitoUser.prototype)
      )
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
        promises.push(processView(this.api, schema, name, routes))
      }
      await Promise.all(promises)
      this.$router.addRoutes(routes)
    },

    async request({ method, url, resource, data, params, internal }) {
      url = url || this.getResourceUrl(resource)
      method = method || resource?.method
      const checkUser = !internal && url.startsWith(this.api.url)
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
