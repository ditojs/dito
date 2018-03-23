<template lang="pug">
  .dito
    notifications(position="top right" ref="notifications")
    modals-container
    dito-menu(:views="resolvedViews")
    main.dito-page
      dito-header(:user="user")
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
    meta: { type: Object, required: true },
    views: { type: [Object, Function, Promise], required: true },
    options: { type: Object, default: {} }
  },

  data() {
    return {
      user: null,
      resolvedViews: {},
      emulateUnauthorized: false
    }
  },

  created() {
    this.appState.title = document.title || 'Dito.js Admin'
    const {
      spinner: {
        size = '8px',
        color = '#999'
      } = {},
      emulateUnauthorized
    } = this.options
    const { props } = DitoComponent.get('dito-spinner').options
    props.size.default = size
    props.color.default = color
    this.emulateUnauthorized = emulateUnauthorized
  },

  mounted() {
    this.resolveViews()
  },

  methods: {
    async login(error) {
      const data = await new Promise((resolve, reject) => {
        this.showDialog({
          components: {
            username: {
              type: 'text'
            },
            password: {
              type: 'password'
            }
          },
          buttons: {
            login: {
              type: 'submit',
              onClick(dialog) {
                dialog.close()
                resolve(dialog.data)
              }
            },
            cancel: {
              onClick(dialog) {
                dialog.close()
                reject(error)
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
      })
      this.api.request('post', `${this.api.authPath}/login`, null, data,
        async (err, response) => {
          if (err) {
            console.error(err)
          } else {
            this.user = response?.data?.user
            if (!Object.keys(this.views).length) {
              await this.resolveViews()
            }
          }
        }
      )
    },

    async logout() {
      this.api.request('post', `${this.api.authPath}/logout`, null, {},
        async (err, response) => {
          if (err) {
            console.error(err)
          } else {
            if (response.data?.success) {
              this.user = null
              this.resolvedViews = {}
              this.$router.push({ path: '/' })
            }
          }
        }
      )
    },

    async resolveViews() {
      try {
        if (this.emulateUnauthorized) {
          this.emulateUnauthorized = false
          throw new Error('Loading chunk views failed.')
        }
        this.resolvedViews = await resolveViews(this.views)
      } catch (error) {
        return this.login(error)
      }
      // Collect all routes from the root schema components
      const routes = []
      const promises = []
      for (const [name, schema] of Object.entries(this.resolvedViews)) {
        promises.push(processView(schema, name, this.api, routes))
      }
      await Promise.all(promises)
      this.$router.addRoutes(routes)
    }
  }
})
</script>
