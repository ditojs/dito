<template lang="pug">
  .dito
    modals-container
    notifications(position="top right" ref="notifications")
    dito-menu(:views="resolvedViews")
    main.dito-page
      dito-header(
        :allowLogin="allowLogin"
      )
      router-view
</template>

<style lang="sass">
.dito
  // Import everything name-spaced in .dito
  @import "dito"

  height: 100%
  display: flex
  .dito-page
    flex: 1
    display: flex
    flex-flow: column
    .dito-view
      flex: 1
      min-height: 0
</style>

<script>
import DitoComponent from '@/DitoComponent'
import { processView, resolveViews } from '@/schema'

export default DitoComponent.component('dito-root', {
  props: {
    api: { type: Object, required: true },
    views: { type: [Object, Function, Promise], required: true },
    options: { type: Object, default: {} }
  },

  provide() {
    return {
      api: this.api
    }
  },

  data() {
    return {
      allowLogin: false,
      resolvedViews: {}
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
    const {
      spinner: {
        size = '8px',
        color = '#999'
      } = {}
    } = this.options
    const { props } = DitoComponent.get('dito-spinner').options
    props.size.default = size
    props.color.default = color
  },

  async mounted() {
    try {
      this.allowLogin = false
      if (await this.getUser()) {
        await this.resolveViews()
      } else {
        await this.login()
      }
    } catch (err) {
      console.error(err)
    }
    this.allowLogin = true
  },

  computed: {
    notifications() {
      return this.$refs.notifications
    }
  },

  methods: {
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
            onClick(dialog) {
              dialog.resolve(dialog.data)
            }
          },
          cancel: {
            onClick(dialog) {
              dialog.resolve(false)
            }
          }
        },
        data: {
          username: 'me',
          password: 'secret'
        }
      }, {
        width: '480px',
        height: 'auto',
        clickToClose: false
      })
      if (loginData) {
        try {
          const response = await this.api.request({
            method: 'post',
            url: `${this.api.authPath}/login`,
            data: loginData
          })
          this.setUser(response.data.user)
          await this.resolveViews()
        } catch (err) {
          console.error(err)
        }
      }
    },

    async logout() {
      try {
        const response = await this.api.request({
          method: 'post',
          url: `${this.api.authPath}/logout`
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

    async getUser() {
      let user = null
      try {
        const response = await this.api.request({
          method: 'get',
          url: `${this.api.authPath}/session`
        })
        user = response.data.user || null
      } catch (err) {
        console.error(err)
      }
      this.setUser(user)
      return user
    },

    setUser(user) {
      this.$set(this.api, 'user', user)
    },

    async ensureUser() {
      try {
        if (!(await this.getUser())) {
          await this.login()
        }
      } catch (err) {
        console.error(err)
      }
    },

    async resolveViews() {
      try {
        this.resolvedViews = await resolveViews(this.views)
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
        promises.push(processView(schema, name, this.api, routes))
      }
      await Promise.all(promises)
      this.$router.addRoutes(routes)
    },

    onBeforeRequest() {
      return this.ensureUser()
    },

    onAfterRequest({ method, url }) {
      // Detect change of the own user, and reload it if necessary.
      if (
        method === 'patch' &&
        url === `${this.api.authPath}/${this.api.user?.id}`
      ) {
        return this.getUser()
      }
    }
  }
})
</script>
