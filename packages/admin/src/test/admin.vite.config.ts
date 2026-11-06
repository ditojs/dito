import os from 'node:os'
import path from 'node:path'
import type { ConfigEnv } from 'vite'
import { defineAdminViteConfig } from '../vite/index.ts'

// The config of the development tests, which `createAdmin()` loads by its path
// with the mode `development`.
export default ({ mode }: ConfigEnv) =>
  defineAdminViteConfig({
    root: path.join(import.meta.dirname, 'admin-app'),
    base: '/admin',
    mode: mode as 'development',
    cacheDir: path.join(os.tmpdir(), `dito-admin-vite-${process.pid}`),
    logLevel: 'silent'
  })
