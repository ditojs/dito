import { reactive } from 'vue'
import { parseUserAgent } from './utils/agent'

export default reactive({
  title: '',
  routeComponents: [],
  user: null,
  agent: parseUserAgent(navigator.userAgent || ''),
  loadCache: {}, // See TypeMixin.load()
  activeLabel: null,
  clipboardData: null
})
