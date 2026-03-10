import { assertType, describe, it } from 'vitest'
import type {
  View,
  Form,
  Component,
  PanelSchema,
  ButtonSchema,
  ResolvableForm
} from '../index.d.ts'
import type { Entry, Parent } from './fixtures.ts'

type DeepItem = {
  title: string
  items: { type: string }[]
  tags: string[]
}

describe('Variance: typed schemas assignable to any', () => {
  it('Component<Entry> is assignable to Component<any>', () => {
    const component: Component<Entry> = {
      type: 'text'
    }
    assertType<Component<any>>(component)
  })

  it('ButtonSchema<Entry> is assignable to Component<any>', () => {
    const button: ButtonSchema<Entry> = {
      type: 'button',
      text: 'Click me'
    }
    assertType<Component<any>>(button)
  })

  it('PanelSchema<Entry> is assignable to PanelSchema<any>', () => {
    const panel: PanelSchema<Entry> = {
      type: 'panel',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<PanelSchema<any>>(panel)
  })

  it('View<Entry> is assignable to View<any>', () => {
    const view: View<Entry> = {
      type: 'view',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<View<any>>(view)
  })

  it('View<Entry> with panels is assignable to View<any>', () => {
    const view: View<Entry> = {
      type: 'view',
      components: {
        title: { type: 'text' }
      },
      panels: {
        sidebar: {
          type: 'panel',
          components: {
            title: { type: 'text' }
          }
        }
      }
    }
    assertType<View<any>>(view)
  })

  it('Record of typed views assignable to Record<string, View<any>>', () => {
    const views = {
      entries: {
        type: 'view',
        components: {
          title: { type: 'text' }
        }
      } satisfies View<Entry>
    }
    assertType<Record<string, View<any>>>(views)
  })

  it('Form<Entry> is assignable to ResolvableForm<any>', () => {
    const form: Form<Entry> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm<any>>(form)
  })

  it('Form<Parent> (array props) is assignable to ResolvableForm<any>', () => {
    const form: Form<Parent> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm<any>>(form)
  })

  it('Form with primitive + nested arrays is assignable to ResolvableForm<any>', () => {
    const form: Form<DeepItem> = {
      type: 'form',
      components: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm<any>>(form)
  })

  it('Record of typed forms assignable to Record<string, ResolvableForm>', () => {
    const forms = {
      entry: {
        type: 'form',
        components: {
          title: { type: 'text' }
        }
      } satisfies Form<Entry>
    }
    assertType<Record<string, ResolvableForm>>(forms)
  })
})
