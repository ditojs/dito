#!/usr/bin/env babel-node

import path from 'path'
import { isFunction, camelize } from '@/utils'
import * as db from './db'
import startConsole from './console'

const commands = { db, console: startConsole }

function getCommand(commands, parts) {
  const part = parts.shift()
  return commands && part
    ? getCommand(commands[camelize(part)], parts)
    : commands
}

async function execute() {
  try {
    // Dynamically load app or config from the path provided package.json script
    const [,, command, importPath, ...args] = process.argv
    const execute = command && getCommand(commands, command.split(':'))
    if (!isFunction(execute)) {
      throw new Error(`Unknown command: ${command}`)
    }
    let arg = (await import(path.resolve(importPath))).default
    if (isFunction(arg)) {
      arg = await arg()
    }
    const res = await execute(arg, ...args)
    if (res === true) {
      process.exit()
    }
  } catch (err) {
    console.error(err)
  }
}

// Start the CLI if `$ node lib/cli`
if (require.main === module) {
  execute()
}

export default execute
