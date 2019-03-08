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
        documentHandlers: {
          mousedown: () => {
            this.showPulldown(false)
            this.domOff(document, this.pulldown.documentHandlers)
          },

          mouseup: () => {
            if (this.onPulldownMouseUp(null)) {
              this.domOff(document, this.pulldown.documentHandlers)
            }
          }
        }
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
        this.domOn(document, this.pulldown.documentHandlers)
      }
    }
  }
}
