### New

- **admin:** Pages: a view of `type: 'page'` displays a Vue `component`, e.g. `component: () => import('./CachePurgePage.vue')`, under its `path`, whose route params the component reads with vue-router's `useRoute()`. Pages with required params have no menu item. The component reads the page's context with `useDitoContext()`.

### Fixes

- **admin:** Views of any type with required params in their `path` no longer get a menu item, whose link couldn't resolve.
