import path from 'path'
import { isFunction, camelCase } from '@/utils'
import db from './db'

const commands = { db }

function getCommand(commands, parts) {
  const part = parts.shift()
  return commands && part
    ? getCommand(commands[camelCase(part)], parts)
    : commands
}

export default async function execute() {
  try {
    // Dynamically load app or config from the path provided package.json script
    const [,, command, importPath, ...args] = process.argv
    const execute = command && getCommand(commands, command.split(':'))
    if (!isFunction(execute)) {
      throw new Error(`Unknown command: ${command}`)
    }
    const arg = (await import(path.resolve(importPath))).default
    console.log(await execute(arg, ...args))
  } catch (err) {
    console.error(err)
  }
  process.exit()
}
