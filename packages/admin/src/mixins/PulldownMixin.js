import DomMixin from './DomMixin'

// @vue/component
export default {
  mixins: [DomMixin],

  data() {
    return {
      pulldown: {
        open: false,
        startTime: 0,
        checkTime: true,
        events: {
          mousedown: () => {
            this.showPulldown(false)
            this.pulldown.handlers.remove()
          },

          mouseup: () => {
            if (this.onPulldownMouseUp(null)) {
              this.pulldown.handlers.remove()
            }
          }
        },
        handlers: null
      }
    }
  },

  methods: {
    onPulldownMouseDown(value) {
      if (!value) {
        this.showPulldown(true)
        this.checkTime = true
      } else {
        this.checkTime = false
      }
    },

    onPulldownMouseUp(value) {
      const { startTime } = this.pulldown
      if (!this.checkTime || startTime && (Date.now() - startTime > 250)) {
        this.showPulldown(false)
        if (value) {
          this.onPulldownSelect(value)
        }
        return true
      }
    },

    onPulldownSelect(/* value */) {
      // NOTE: To be overridden.
    },

    showPulldown(open) {
      this.pulldown.open = open
      this.pulldown.startTime = open ? Date.now() : 0
      if (open) {
        this.pulldown.handlers = this.domOn(document, this.pulldown.events)
      }
    }
  }
}
