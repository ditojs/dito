import { assertType, describe, it } from 'vitest'
import type {
  View,
  FormSchema,
  Component,
  PanelSchema,
  ButtonSchema,
  ResolvableForm
} from '@ditojs/admin'
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
      fields: {
        title: { type: 'text' }
      }
    }
    assertType<PanelSchema<any>>(panel)
  })

  it('View<Entry> is assignable to View<any>', () => {
    const view: View<Entry> = {
      type: 'view',
      fields: {
        title: { type: 'text' }
      }
    }
    assertType<View<any>>(view)
  })

  it('View<Entry> with panels is assignable to View<any>', () => {
    const view: View<Entry> = {
      type: 'view',
      fields: {
        title: { type: 'text' }
      },
      panels: {
        sidebar: {
          type: 'panel',
          fields: {
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
        fields: {
          title: { type: 'text' }
        }
      } satisfies View<Entry>
    }
    assertType<Record<string, View<any>>>(views)
  })

  it('FormSchema<Entry> is assignable to ResolvableForm<any>', () => {
    const form: FormSchema<Entry> = {
      type: 'form',
      fields: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm<any>>(form)
  })

  it('FormSchema<Parent> (array props) is assignable to ResolvableForm<any>', () => {
    const form: FormSchema<Parent> = {
      type: 'form',
      fields: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm<any>>(form)
  })

  it('FormSchema with primitive + nested arrays is assignable to ResolvableForm<any>', () => {
    const form: FormSchema<DeepItem> = {
      type: 'form',
      fields: {
        title: { type: 'text' }
      }
    }
    assertType<ResolvableForm<any>>(form)
  })

  it('Record of typed forms assignable to Record<string, ResolvableForm>', () => {
    const forms = {
      entry: {
        type: 'form',
        fields: {
          title: { type: 'text' }
        }
      } satisfies FormSchema<Entry>
    }
    assertType<Record<string, ResolvableForm>>(forms)
  })
})
