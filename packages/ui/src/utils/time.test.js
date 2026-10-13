import { isTimePartName, editTimeText } from './time.js'

describe('isTimePartName()', () => {
  it('accepts the names of time parts', () => {
    for (const name of ['hour', 'minute', 'second', 'millisecond']) {
      expect(isTimePartName(name)).toBe(true)
    }
  })

  it('rejects date parts and empty names', () => {
    for (const name of ['day', 'month', 'year', 'dayPeriod', null, undefined]) {
      expect(isTimePartName(name)).toBe(false)
    }
  })
})

describe('editTimeText()', () => {
  // Types `key` into an input holding `value`, with the caret at `start` (or
  // the selection from `start` to `end`), and applies the browser's default
  // action if `editTimeText()` doesn't prevent it.
  function typeKey(
    value,
    key,
    start,
    { end = start, formattedLength = value.length } = {}
  ) {
    const input = document.createElement('input')
    input.value = value
    input.setSelectionRange(start, end)
    const event = new KeyboardEvent('keydown', { key, cancelable: true })
    editTimeText(event, input, formattedLength)
    const edited = input.value
    if (!event.defaultPrevented) {
      const from = input.selectionStart
      const to = input.selectionEnd
      if (key.length === 1) {
        input.value = input.value.slice(0, from) + key + input.value.slice(to)
        input.setSelectionRange(from + 1, from + 1)
      } else if (key === 'Backspace' && from > 0) {
        const position = from === to ? from - 1 : from
        input.value = input.value.slice(0, position) + input.value.slice(to)
        input.setSelectionRange(position, position)
      }
    }
    return {
      edited,
      value: input.value,
      caret: input.selectionStart,
      prevented: event.defaultPrevented
    }
  }

  describe('typing digits', () => {
    it('overwrites the digit after the caret', () => {
      expect(typeKey('10:30:00 AM', '2', 0)).toMatchObject({
        value: '20:30:00 AM',
        caret: 1,
        prevented: false
      })
      expect(typeKey('10:30:00 AM', '5', 4)).toMatchObject({
        value: '10:35:00 AM',
        caret: 5
      })
    })

    it('overwrites the last digit of a part', () => {
      expect(typeKey('10:30:00 AM', '1', 1).value).toBe('11:30:00 AM')
    })

    it('skips over a separator after two digits', () => {
      expect(typeKey('10:30:00 AM', '4', 2)).toMatchObject({
        value: '10:40:00 AM',
        caret: 4
      })
    })

    it('inserts digits into single digit parts', () => {
      // Single digits aren't overwritten, so hours can grow to two digits:
      expect(typeKey('9:30:00 AM', '1', 0).value).toBe('19:30:00 AM')
    })

    it('does not skip a separator after a single digit', () => {
      expect(typeKey('9:30:00 AM', '1', 1).value).toBe('91:30:00 AM')
    })

    it('prevents typing beyond the end of the formatted text', () => {
      expect(typeKey('10:30:00', '5', 8)).toMatchObject({
        value: '10:30:00',
        prevented: true
      })
    })

    it('removes the period letters after the time normally', () => {
      expect(typeKey('10:35:00 AM', 'Backspace', 10)).toMatchObject({
        edited: '10:35:00 AM',
        value: '10:35:00 M',
        caret: 9
      })
    })

    it('leaves text with a selection to the browser', () => {
      expect(
        typeKey('10:30:00 AM', '7', 0, { end: 2 })
      ).toMatchObject({ edited: '10:30:00 AM', value: '7:30:00 AM' })
    })
  })

  describe('typing other characters', () => {
    it('prevents them when the text has its formatted length', () => {
      expect(typeKey('10:30:00 AM', 'x', 3)).toMatchObject({
        value: '10:30:00 AM',
        prevented: true
      })
    })

    it('truncates text that is longer than its formatted length', () => {
      expect(
        typeKey('10:30:00 AMx', 'x', 5, { formattedLength: 11 })
      ).toMatchObject({ value: '10:30:00 AM', caret: 5, prevented: true })
    })

    it('lets them through when the text is shorter', () => {
      expect(
        typeKey('10:30:00 A', 'M', 10, { formattedLength: 11 })
      ).toMatchObject({ value: '10:30:00 AM', prevented: false })
    })

    it('does not treat a typed space as a digit', () => {
      expect(typeKey('10:30:00 AM', ' ', 3).value).toBe('10:30:00 AM')
    })
  })

  describe('pressing keyboard shortcuts', () => {
    it('leaves Cmd and Ctrl shortcuts to the browser', () => {
      for (const modifier of ['metaKey', 'ctrlKey']) {
        for (const key of ['a', 'v', 'z', '1']) {
          const input = document.createElement('input')
          input.value = '10:30:00 AM'
          input.setSelectionRange(3, 3)
          const event = new KeyboardEvent('keydown', {
            key,
            [modifier]: true,
            cancelable: true
          })
          editTimeText(event, input, input.value.length)
          expect(event.defaultPrevented).toBe(false)
          expect(input.value).toBe('10:30:00 AM')
        }
      }
    })

    it('handles characters typed with Option or AltGr as text', () => {
      // e.g. Option+A on macOS and AltGr+Q on German layouts in Windows:
      for (const modifiers of [
        { altKey: true },
        { altKey: true, ctrlKey: true }
      ]) {
        const input = document.createElement('input')
        input.value = '10:30:00 AM'
        input.setSelectionRange(3, 3)
        const event = new KeyboardEvent('keydown', {
          key: modifiers.ctrlKey ? '@' : 'å',
          ...modifiers,
          cancelable: true
        })
        editTimeText(event, input, input.value.length)
        expect(event.defaultPrevented).toBe(true)
      }
    })
  })

  describe('pressing Backspace', () => {
    it('replaces the first of two digits with a zero', () => {
      expect(typeKey('10:35:00 AM', 'Backspace', 4)).toMatchObject({
        value: '10:05:00 AM',
        caret: 3
      })
      expect(typeKey('10:35:00 AM', 'Backspace', 1)).toMatchObject({
        value: '00:35:00 AM',
        caret: 0
      })
    })

    it('replaces a single remaining digit at the end with zeros', () => {
      expect(typeKey('10:35:4', 'Backspace', 7)).toMatchObject({
        value: '10:35:00',
        caret: 5
      })
    })

    it('removes the second of two digits at the end normally', () => {
      expect(typeKey('10:35:47', 'Backspace', 8)).toMatchObject({
        value: '10:35:4',
        caret: 7
      })
    })

    it('keeps the separator when removing the last digit before it', () => {
      expect(typeKey('9:30:00 AM', 'Backspace', 1)).toMatchObject({
        value: '00:30:00 AM',
        caret: 0
      })
    })

    it('removes digits normally in other positions', () => {
      expect(typeKey('10:35:00 AM', 'Backspace', 5)).toMatchObject({
        edited: '10:35:00 AM',
        value: '10:3:00 AM',
        caret: 4
      })
    })

    it('leaves text with a selection to the browser', () => {
      expect(
        typeKey('10:35:00 AM', 'Backspace', 3, { end: 5 })
      ).toMatchObject({ edited: '10:35:00 AM', value: '10::00 AM' })
    })
  })

  it('ignores other keys', () => {
    expect(typeKey('10:30:00 AM', 'ArrowLeft', 3)).toMatchObject({
      edited: '10:30:00 AM',
      prevented: false
    })
  })
})
