import { reactive } from 'vue'
import { parseUserAgent } from './utils/agent'

export default reactive({
  title: '',
  routeComponents: [],
  user: null,
  agent: parseUserAgent(navigator.userAgent || ''),
  loadCache: {}, // See TypeMixin.load()
  activeLabel: null,
  // The modifier class of the page, e.g. for wide schemas, see `DitoSchema`:
  pageClass: null,
  clipboardData: null
})
