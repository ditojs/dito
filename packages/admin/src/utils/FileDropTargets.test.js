import { FileDropTargets } from './FileDropTargets.js'

// Creates a drag event of `type` on `target`, with the types of the dragged
// data, as browsers do.
function createDragEvent(type, target, types = ['Files']) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    target: { value: target },
    dataTransfer: { value: { types, dropEffect: 'none' } }
  })
  return event
}

describe('FileDropTargets', () => {
  let fileDropTargets
  let handlers
  let target
  let other

  beforeEach(() => {
    fileDropTargets = new FileDropTargets()
    handlers = fileDropTargets.getDocumentEventHandlers()
    target = document.createElement('div')
    target.appendChild(document.createElement('span'))
    other = document.createElement('div')
  })

  function dispatch(type, element = other, types) {
    const event = createDragEvent(type, element, types)
    handlers[type](event)
    return event
  }

  it('drags files while there are targets', () => {
    fileDropTargets.add(target)
    dispatch('dragenter')
    expect(fileDropTargets.isDraggingFiles).toBe(true)
  })

  it(`doesn't drag files without targets`, () => {
    const remove = fileDropTargets.add(target)
    remove()
    dispatch('dragenter')
    expect(fileDropTargets.isDraggingFiles).toBe(false)
  })

  it(`doesn't drag other data than files`, () => {
    fileDropTargets.add(target)
    dispatch('dragenter', other, ['text/plain'])
    expect(fileDropTargets.isDraggingFiles).toBe(false)
  })

  it('ends the drag once all entered elements are left', () => {
    fileDropTargets.add(target)
    dispatch('dragenter', other)
    dispatch('dragenter', target)
    dispatch('dragleave', other)
    expect(fileDropTargets.isDraggingFiles).toBe(true)
    dispatch('dragleave', target)
    expect(fileDropTargets.isDraggingFiles).toBe(false)
  })

  it('ends the drag when the files are dropped', () => {
    fileDropTargets.add(target)
    dispatch('dragenter', other)
    dispatch('dragenter', target)
    dispatch('drop', target)
    expect(fileDropTargets.isDraggingFiles).toBe(false)
    // The next drag begins with the first element that it enters:
    dispatch('dragenter', other)
    expect(fileDropTargets.isDraggingFiles).toBe(true)
  })

  it(`doesn't end the drag of files on drops of other data`, () => {
    fileDropTargets.add(target)
    dispatch('dragenter', target)
    dispatch('drop', target, ['text/plain'])
    expect(fileDropTargets.isDraggingFiles).toBe(true)
    // The count of entered elements is kept too:
    dispatch('dragleave', target)
    expect(fileDropTargets.isDraggingFiles).toBe(false)
  })

  it('begins a new drag after leaving without targets', () => {
    // Leaving the elements entered without targets doesn't affect the count:
    dispatch('dragenter')
    dispatch('dragleave')
    dispatch('dragleave')
    fileDropTargets.add(target)
    dispatch('dragenter')
    expect(fileDropTargets.isDraggingFiles).toBe(true)
  })

  it('lets files be dropped only on targets', () => {
    fileDropTargets.add(target)
    const overTarget = dispatch('dragover', target.firstChild)
    expect(overTarget.defaultPrevented).toBe(false)
    expect(overTarget.dataTransfer.dropEffect).toBe('copy')
    const overOther = dispatch('dragover', other)
    expect(overOther.defaultPrevented).toBe(true)
    expect(overOther.dataTransfer.dropEffect).toBe('none')
  })

  it('leaves drags of other data than files to the browser', () => {
    const event = dispatch('dragover', other, ['text/plain'])
    expect(event.defaultPrevented).toBe(false)
  })
})
