import { populateGlobal } from 'vitest/runtime'

// The happy-dom environment of Vitest, without happy-dom's `Request`,
// `Response` and `Headers`, which the server that the tests start gets from
// Node: happy-dom's request headers leave out cookies, and its response
// headers join `Set-Cookie`. The admin only calls `fetch()`, which stays
// happy-dom's and keeps the cookies of the server's origin.
export default {
  name: 'happy-dom-server',
  viteEnvironment: 'client',
  async setup(global, { happyDOM = {} }) {
    const { GlobalWindow } = await import('happy-dom')
    const win = new GlobalWindow({
      ...happyDOM,
      console: global.console,
      url: happyDOM.url || 'http://localhost:3000',
      settings: { ...happyDOM.settings, disableErrorCapturing: true }
    })
    const { keys, originals } = populateGlobal(global, win, {
      bindFunctions: true,
      additionalKeys: [
        'MessagePort',
        'fetch',
        'AbortController',
        'AbortSignal',
        'URL',
        'URLSearchParams',
        'FormData'
      ]
    })
    return {
      async teardown(global) {
        await win.happyDOM.abort()
        win.close()
        keys.forEach(key => delete global[key])
        originals.forEach((descriptor, key) =>
          Object.defineProperty(global, key, descriptor)
        )
      }
    }
  }
}
