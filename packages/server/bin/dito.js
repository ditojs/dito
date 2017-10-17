#!/usr/bin/env babel-node
import path from 'path'
import { camelCase } from '../src/utils'

import { createMigration, migrate, rollback, seed } from '../src/db'
const commands = { createMigration, migrate, rollback, seed }

async function execute() {
  try {
    // Dynamically load app or config from the path provided package.json script
    const [,, command, importPath, ...args] = process.argv
    const name = command && command.match(/^db:(.*)$/)[1]
    const execute = name && commands[camelCase(name)]
    if (!execute) {
      throw new Error(`Unknown command: ${command}`)
    }
    const arg = (await import(path.resolve(importPath))).default
    console.log(await execute(arg, ...args))
  } catch (err) {
    console.error(err)
  }
  process.exit()
}

execute()
