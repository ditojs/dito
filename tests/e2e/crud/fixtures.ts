import path from 'path'
import { AdminController, ModelController } from '@ditojs/server'
import {
  createFixtureAppFixture,
  createModelHelpers
} from '../../utils/fixture-app.js'
import { Widget } from './models/Widget.js'

export { expect } from '@playwright/test'
export { createModelHelpers }

class Widgets extends ModelController {
  override modelClass = Widget
  collection = {
    allow: ['get', 'post'] as const
  }
  member = {
    allow: ['get', 'patch', 'delete'] as const
  }
}

export const test = createFixtureAppFixture({
  appRoot: path.resolve(import.meta.dirname, 'app'),
  models: { Widget },
  controllers: {
    admin: AdminController,
    api: { Widgets }
  }
})
