import { parseUserAgent } from './utils/agent'

export default {
  agent: parseUserAgent(navigator.userAgent || '')
}
