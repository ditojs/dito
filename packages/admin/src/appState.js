import { reactive } from 'vue'
import { parseUserAgent } from './utils/agent'

export default reactive({
  title: '',
  /** @type {Record<string, any> | null} */
  user: null,
  agent: parseUserAgent(navigator.userAgent || ''),
  // The responses of `cache: 'global'`, replaced when the user changes:
  loadCache: {},
  pageClass: null
})
