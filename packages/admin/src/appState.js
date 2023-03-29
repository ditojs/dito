import { reactive } from 'vue'

export default reactive({
  title: '',
  routeComponents: [],
  user: null,
  loadCache: {}, // See TypeMixin.load()
  activeLabel: null,
  clipboardData: null
})
