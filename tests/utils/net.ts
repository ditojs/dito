// Polls a URL until it returns HTTP 200. Used after app.start()
// to warm up Vite middleware so the first test doesn't pay the
// compilation cost.
export async function waitForUrl(
  url: string,
  { timeout = 30_000, interval = 200 } = {}
) {
  const start = Date.now()
  let lastStatus = 0
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      lastStatus = res.status
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, interval))
  }
  throw new Error(
    `Timed out waiting for ${url} ` +
    `after ${timeout}ms ` +
    `(last status: ${lastStatus})`
  )
}
