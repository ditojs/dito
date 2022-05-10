#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import pico from 'picocolors'
import Knex from 'knex'
import { isPlainObject, isFunction, camelize } from '@ditojs/utils'
import * as db from './db/index.js'
import startConsole from './console.js'

const commands = { db, console: startConsole }

function getCommand(commands, parts) {
  const part = parts.shift()
  return commands && part
    ? getCommand(commands[camelize(part)], parts)
    : commands
}

function setSilent(silent) {
  const oldValue = process.env.DITO_SILENT
  process.env.DITO_SILENT = silent
  return oldValue
}

async function execute() {
  try {
    // Dynamically load app or config from the path provided package.json script
    const [,, command, importPath, ...args] = process.argv
    const execute = command && getCommand(commands, command.split(':'))
    if (!isFunction(execute)) {
      throw new Error(`Unknown command: ${command}`)
    }
    const silent = setSilent(true)
    let arg
    try {
      arg = (await import(path.resolve(importPath))).default
    } finally {
      setSilent(silent)
    }
    if (isFunction(arg)) {
      arg = await arg()
    }
    if (isPlainObject(arg) && arg.knex) {
      // A config object with a knex field was passed in, create a knex object
      // from it to pass on to the execute function.
      arg = Knex(arg.knex)
    }
    const res = await execute(arg, ...args)
    process.exit(res === true ? 0 : 1)
  } catch (err) {
    if (err instanceof Error) {
      console.error(
        pico.red(`${err.detail ? `${err.detail}\n` : ''}${err.stack}`)
      )
    } else {
      console.error(pico.red(err))
    }
    process.exit(1)
  }
}

// Start the console if `node ./cli/index.js`

// See module was not imported but called directly
const path1 = fs.realpathSync(import.meta.url.replace(/^file:\/\//, ''))
const path2 = fs.realpathSync(process.argv[1])
if (path1 === path2) {
  execute()
}

export default execute
