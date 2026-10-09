import DomMixin from './DomMixin.js'

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
            this.setPulldownOpen(false)
          },

          mouseup: () => {
            this.onPulldownMouseUp()
          }
        },
        handlers: null
      }
    }
  },

  computed: {
    pulldownTriggerAttributes() {
      return {
        'aria-haspopup': 'menu',
        'aria-expanded': this.pulldown.open
      }
    }
  },

  methods: {
    onPulldownMouseDown(value = null) {
      if (value === null) {
        this.setPulldownOpen(true)
        this.pulldown.checkTime = true
      } else {
        this.pulldown.checkTime = false
      }
    },

    onPulldownMouseUp(value = null) {
      const { startTime, checkTime } = this.pulldown
      if (!checkTime || startTime && (Date.now() - startTime > 250)) {
        this.setPulldownOpen(false)
        if (value !== null) {
          this.onPulldownSelect(value)
        }
        return true
      }
    },

    onPulldownSelect(/* value */) {
      // NOTE: To be overridden.
    },

    setPulldownOpen(open) {
      const { pulldown } = this
      pulldown.open = open
      pulldown.startTime = open ? Date.now() : 0
      // Listen to the document only while the pulldown is open, to close it:
      pulldown.handlers?.remove()
      pulldown.handlers = open ? this.domOn(document, pulldown.events) : null
    }
  }
}
