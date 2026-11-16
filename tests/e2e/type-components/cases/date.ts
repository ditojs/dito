import { defineCases } from './define.js'

export default [
  defineCases('date', { type: 'date' }, [
    {
      title: 'stores the entered date',
      value: '5/14/2026',
      stored: '2026-05-14'
    },
    { title: 'shows a stored date', seed: '2026-05-14', shown: '5/14/2026' },
    {
      title: 'stores a historical date',
      value: '7/1/1850',
      stored: '1850-07-01'
    },
    {
      title: 'stores local midnight for a datetime column',
      property: { type: 'datetime' },
      value: '5/14/2026',
      stored: new Date(2026, 4, 14).toISOString()
    },
    {
      title: 'shows the local day of a stored datetime',
      property: { type: 'datetime' },
      seed: '2026-05-13T22:00:00.000Z',
      shown: '5/14/2026'
    }
  ]),
  defineCases('datetime', { type: 'datetime' }, [
    {
      title: 'stores the entered datetime in UTC',
      value: '5/14/2026, 11:30:00 AM',
      stored: '2026-05-14T09:30:00.000Z'
    },
    {
      title: 'shows a stored datetime in local time',
      seed: '2026-05-14T09:30:00.000Z',
      shown: '5/14/2026, 11:30:00 AM'
    }
  ]),
  defineCases('time', { type: 'string' }, [
    {
      title: 'shows a stored time in local time',
      seed: '2026-05-14T09:30:00.000Z',
      shown: '11:30:00 AM'
    }
  ])
]
