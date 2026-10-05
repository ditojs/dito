import type { Locator, Page } from '@playwright/test'
import { checked } from './checked.js'
import { code } from './code.js'
import { color } from './color.js'
import { date } from './date.js'
import { markup } from './markup.js'
import { multiselect } from './multiselect.js'
import { checkboxes, radio } from './options.js'
import { select } from './select.js'
import { slider } from './slider.js'
import { display, list, object, section } from './structure.js'
import { text } from './text.js'

/** The component of a case, as rendered in its view. */
export interface DriverComponent {
  /** The component's name, also its id as a top-level data path. */
  name: string
  label: string
}

/**
 * Sets and reads the value of one component type through the admin UI, so
 * the type-matrix runners can treat all types alike.
 */
export interface TypeComponentDriver {
  /** The element that represents the component's value. */
  getElement(page: Page, component: DriverComponent): Locator
  /** Enters a value, in the type-specific format used by the cases. */
  setValue(
    page: Page,
    component: DriverComponent,
    value: unknown
  ): Promise<void>
  /** Returns the displayed value, comparable to the cases' `shown`. */
  getValue(page: Page, component: DriverComponent): Promise<unknown>
}

const drivers: Record<string, TypeComponentDriver> = {
  text,
  email: text,
  url: text,
  hostname: text,
  domain: text,
  tel: text,
  password: text,
  creditcard: text,
  textarea: text,
  number: text,
  integer: text,
  switch: checked,
  checkbox: checked,
  color,
  markup,
  select,
  multiselect,
  radio,
  checkboxes,
  slider,
  code,
  // Custom components, as rendered by the cases' own inputs.
  component: text,
  list,
  object,
  section,
  label: display,
  progress: display,
  date,
  datetime: date,
  time: date
}

export function getDriver(type: string): TypeComponentDriver {
  const driver = drivers[type]
  if (!driver) {
    throw new Error(`No driver for type '${type}'`)
  }
  return driver
}
