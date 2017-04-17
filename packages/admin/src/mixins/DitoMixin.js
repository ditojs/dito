import escapeHtml from '@/utils/escapeHtml'
import renderLabel from '@/utils/renderLabel'
import stripTags from '@/utils/stripTags'
import { compile as compileTemplate } from '@/utils/template'

export default {
  methods: {
    compileTemplate,
    renderLabel,
    escapeHtml,
    stripTags
  },

  computed: {
    // Short-cuts to meta properties:
    view() { return this.meta.view },
    form() { return this.view.form },
    user() { return this.meta.user },
    api() { return this.meta.api }
  }
}
