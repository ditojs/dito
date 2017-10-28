import path from 'path'
import fs from 'fs-extra'
import os from 'os'

export default async function setupHistory(replServer, historyPath) {
  if (!historyPath) {
    historyPath = path.join(os.homedir(), '.dito_console_history')
  }

  replServer.pause()
  try {
    // History files are conventionally not readable by others:
    // https://github.com/nodejs/node/issues/3392
    // https://github.com/nodejs/node/pull/3394
    await fs.close(await fs.open(historyPath, 'a+', 0o0600))
  } catch (err) {
    // Cannot open history file.
    // Don't crash, just don't persist history.
    replServer._writeToOutput('\nError: Could not open history file.\n' +
      'REPL session history will not be persisted.\n')
    replServer._refreshLine()
    console.error(err)
    replServer.resume()
    return replServer
  }

  const data = await fs.readFile(historyPath, 'utf8')
  if (data) {
    replServer.history = data.split(/[\n\r]+/, replServer.historySize)
  }

  const historyHandle = await fs.open(historyPath, 'w')
  let timer = null
  let writing = false
  let pending = false

  replServer.on('line', () => {
    replServer._flushing = true
    // Debounce to guard against code pasted into the REPL.
    clearTimeout(timer)
    timer = setTimeout(flushHistory, 15)
  })

  async function flushHistory() {
    timer = null
    if (writing) {
      pending = true
    } else {
      writing = true
      try {
        const data = replServer.history.join(os.EOL)
        await fs.write(historyHandle, data, 0, 'utf8')
      } catch (err) {
        console.error(err)
      }
      writing = false
      if (pending) {
        pending = false
        replServer.emit('line')
      } else {
        replServer._flushing = !!timer
        if (!replServer._flushing) {
          replServer.emit('flushHistory')
        }
      }
    }
  }

  // reading the file data out erases it
  await flushHistory()
  replServer.resume()
  return replServer
}
