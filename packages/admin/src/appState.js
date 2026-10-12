import { reactive } from 'vue'
import { parseUserAgent } from './utils/agent'

export default reactive({
  title: '',
  /** @type {Record<string, any> | null} */
  user: null,
  agent: parseUserAgent(navigator.userAgent || ''),
  // The responses loaded with `cache: 'global'`, see `request()`. Only
  // `Session` replaces it, when the user changes:
  loadCache: {},
  // The modifier class of the page, e.g. for wide schemas, see `DitoSchema`:
  pageClass: null
})
