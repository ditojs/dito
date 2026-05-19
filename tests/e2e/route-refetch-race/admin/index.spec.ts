import { test, expect, Widget } from '../fixtures.js'
import { DitoListView, DitoForm } from '../../../utils/pages.js'

test.describe('route-refetch-race', () => {
  test('dirty form drops in-flight reload response so local edits survive', async ({
    page,
    url
  }) => {
    // Seed: a single widget. The items relation is wired up in the view but
    // unused here — the bug is framework-level (ResourceMixin.requestData)
    // and lives on the `DitoForm` itself, not on the items list.
    const widget = await Widget.query().insertGraph({
      name: 'before',
      items: [{ label: 'item-one' }]
    })

    const list = new DitoListView(page, url, 'Widget')
    const form = new DitoForm(page)

    await list.navigate('/widgets')
    await list.list.edit('before')

    // Hold the *next* member GET on `/api/widgets/<id>`. The form's initial
    // GET (fired by ResourceMixin's `created` hook → `setupData` →
    // `ensureData` → `loadData(true)`) has already settled by the time the
    // row is editable, so this handler picks up only the reload below.
    let releaseGet!: () => void
    const editPerformed = new Promise<void>(resolve => {
      releaseGet = resolve
    })
    let pendingGet = false
    await page.route(/\/api\/widgets\/\d+(\?|$)/, async (route, req) => {
      // `\d+(\?|$)` boundary already excludes `/api/widgets/<id>/items[...]`,
      // but assert it explicitly to avoid surprises.
      if (/\/items/.test(req.url())) {
        await route.continue()
        return
      }
      if (req.method() === 'GET' && !pendingGet) {
        pendingGet = true
        await editPerformed
      }
      await route.continue()
    })

    // Drive `reloadData()` on the widget form directly. The bug we're fixing
    // is in `ResourceMixin.requestData`'s success branch — it unconditionally
    // calls `setData(response.data)`, clobbering any local edits made while
    // the GET was in flight. We don't need to reproduce the exact user-level
    // trigger (lineto's cancel-back from a `mutate: true` tree-list sub-form)
    // — exercising `reloadData()` directly tests the framework boundary that
    // the dirty-guard fix lives on.
    //
    // Access route: the Vue 3 app instance hangs off `el.__vue_app__`, and
    // Vue exposes the active component for each DOM node on
    // `__vueParentComponent`. Walk up from the form's root DOM until we hit
    // a node whose `isForm === true` — that's the DitoForm.
    await page.evaluate(() => {
      const root = document.querySelector('.dito-form')
      if (!root) throw new Error('No .dito-form in the DOM')
      let node = (root as any).__vueParentComponent
      while (node && !node.ctx?.isForm) node = node.parent
      if (!node) throw new Error('Could not locate DitoForm component')
      node.ctx.reloadData()
    })

    // Make a local edit while the held GET response sits in the request
    // pipeline. Without the fix, the response will land on top of this and
    // overwrite `loadedData.name` back to 'before'. With the fix, the form
    // is dirty (`isDirty` true) so `shouldApplyLoadedData()` returns false
    // and the response is discarded.
    await form.fill('Name', 'after')

    releaseGet()

    // Save: the PATCH body carries whatever is currently in `loadedData`.
    // With the bug: 'before'. With the fix: 'after'.
    await form.save()

    const saved = await Widget.query().findById(widget.$id() as number)
    expect(saved?.name).toBe('after')
  })
})
