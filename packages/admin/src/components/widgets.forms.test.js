import { vi } from 'vitest'
import { h } from 'vue'
import { mountForm, enterValue, isForm, settle } from '../test/mount.js'
import {
  DitoTextField,
  DitoNumberField,
  DitoSliderField,
  DitoSwitchField
} from '../index.js'

// The nested forms of a schema view that describe their data with `properties`
// and lay themselves out with widgets in their `component`:

const layoutProps = {
  schema: { type: Object, required: true },
  context: { type: Object, required: true }
}

// A slider with a switch for each limit of a room's climate:
const ClimateLayout = {
  props: layoutProps,
  render: () => [
    h(DitoSwitchField, { name: 'hasTemperature', label: 'Heating' }),
    h(DitoSliderField, { name: 'temperature', input: true }),
    h(DitoSwitchField, { name: 'hasHumidity', label: 'Humidifier' }),
    h(DitoSliderField, { name: 'humidity', input: true })
  ]
}

const SensorLayout = {
  props: layoutProps,
  render: () => [
    h(DitoTextField, { name: 'label', width: '1/2' }),
    h(DitoNumberField, { name: 'interval', width: '1/2' })
  ]
}

const schema = {
  fields: {
    rooms: {
      type: 'list',
      inlined: true,
      form: {
        type: 'form',
        fields: {
          name: { type: 'text', required: true },
          climate: {
            type: 'object',
            inlined: true,
            form: {
              type: 'form',
              properties: {
                hasTemperature: { type: 'boolean' },
                temperature: {
                  type: 'number',
                  required: true,
                  range: [10, 30],
                  default: 20,
                  if: ({ item }) => item.hasTemperature
                },
                hasHumidity: { type: 'boolean' },
                humidity: {
                  type: 'number',
                  required: true,
                  range: [20, 80],
                  default: 50,
                  if: ({ item }) => item.hasHumidity
                }
              },
              component: ClimateLayout
            }
          }
        }
      }
    },
    sensors: {
      type: 'list',
      inlined: true,
      creatable: true,
      form: {
        type: 'form',
        properties: {
          label: { type: 'string', required: true },
          interval: { type: 'integer', minimum: 1, nullable: true },
          serial: { type: 'string', exclude: true }
        },
        component: SensorLayout
      }
    }
  }
}

const data = {
  rooms: [
    {
      name: 'Kitchen',
      climate: {
        hasTemperature: true,
        temperature: 21,
        hasHumidity: false,
        humidity: 40
      }
    }
  ],
  sensors: [{ label: 'Door', interval: 5, serial: 'A1' }]
}

const mountRooms = () =>
  mountForm({ schema, data, request: ({ data }) => ({ data }) })

describe('nested forms with properties', () => {
  it('lay out their data with the widgets of their component', async () => {
    const { findField } = await mountRooms()
    const getValues = dataPath =>
      findField(dataPath)
        .findAll('input')
        .map(({ element }) =>
          element.type === 'checkbox' ? element.checked : element.value
        )
    // The irrelevant humidity hides its slider:
    expect(getValues('rooms/0/climate')).toEqual([true, '21', '21', false])
    expect(getValues('sensors')).toEqual(['Door', '5'])
  })

  it('edit and submit their data through the widgets', async () => {
    const { findField, data, submit } = await mountRooms()
    const climate = findField('rooms/0/climate')
    await climate.findAll('input[type="checkbox"]')[1].setValue(true)
    await enterValue(climate.findAll('input[type="number"]')[1], '60')
    await enterValue(findField('sensors').find('input'), 'Window')
    expect(data.rooms[0].climate).toEqual({
      hasTemperature: true,
      temperature: 21,
      hasHumidity: true,
      humidity: 60
    })
    // Excluded properties aren't sent:
    expect(await submit()).toEqual({
      id: 1,
      rooms: [
        {
          name: 'Kitchen',
          climate: {
            hasTemperature: true,
            temperature: 21,
            hasHumidity: true,
            humidity: 60
          }
        }
      ],
      sensors: [{ label: 'Window', interval: 5 }]
    })
  })

  it('create items with the defaults of their properties', async () => {
    const { findField, data, settle } = await mountRooms()
    await findField('sensors').find('tfoot .dito-button--add').trigger('click')
    await settle()
    expect(data.sensors[1]).toEqual({ label: '', interval: null, serial: '' })
  })

  it('validate their widgets when they are blurred', async () => {
    const { findField, dataModel } = await mountRooms()
    const input = findField('sensors').find('input')
    await input.trigger('focus')
    await enterValue(input, '')
    await input.trigger('blur')
    expect(dataModel.getErrors('sensors/0/label')).toEqual([
      { message: 'is required' }
    ])
    expect(findField('sensors').find('.dito-errors').text()).toBe(
      'The Label field is required.'
    )
  })

  it('show the errors of submits in their widgets and reveal them', async () => {
    const { findField, data, submit } = await mountRooms()
    data.rooms[0].climate.temperature = 40
    data.sensors[0].interval = 0
    expect(await submit()).toBe(null)
    const climate = findField('rooms/0/climate')
    expect(climate.find('.dito-errors').text()).toBe(
      'The Temperature field must be between 10 and 30.'
    )
    expect(findField('sensors').find('.dito-errors').text()).toBe(
      'The Interval field must be 1 or more.'
    )
    // The first widget with errors is focused:
    expect(document.activeElement).toBe(
      climate.find('input[type="range"]').element
    )
  })

  it('reveal the errors in collapsed items', async () => {
    const { findField, data, submit } = await mountForm({
      schema: {
        fields: {
          sensors: {
            ...schema.fields.sensors,
            collapsible: true,
            collapsed: true
          }
        }
      },
      data: { sensors: [{ label: 'Door', interval: 5 }] },
      request: ({ data }) => ({ data })
    })
    expect(findField('sensors').find('input').exists()).toBe(false)
    data.sensors[0].interval = 0
    expect(await submit()).toBe(null)
    expect(findField('sensors').find('.dito-errors').text()).toBe(
      'The Interval field must be 1 or more.'
    )
  })

  describe('with properties that their component does not show', () => {
    const sensorForm = {
      ...schema.fields.sensors.form,
      properties: {
        ...schema.fields.sensors.form.properties,
        location: { type: 'string', required: true }
      }
    }

    const mountSensors = async sensors => {
      const result = await mountForm({
        schema: { fields: { sensors } },
        data: { sensors: [{ label: '', interval: 5, location: '' }] }
      })
      const notify = vi.spyOn(result.admin.context, 'notify')
      return { ...result, notify }
    }

    it('notify their errors', async () => {
      const { findField, submit, notify } = await mountSensors({
        ...schema.fields.sensors,
        form: sensorForm
      })
      expect(await submit()).toBe(null)
      expect(findField('sensors').find('.dito-errors').text()).toBe(
        'The Label field is required.'
      )
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Errors',
          text: 'The field Location is required'
        })
      )
    })

    it('notify their errors in routed forms', async () => {
      const { admin, submit, notify } = await mountSensors({
        type: 'list',
        editable: true,
        form: sensorForm
      })
      expect(await submit()).toBe(null)
      expect(admin.router.currentRoute.value.path).toBe('/items/1/sensors/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.$el.querySelector('.dito-errors').textContent).toBe(
        'The Label field is required.'
      )
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Validation Errors',
          text: 'The field Location is required'
        })
      )
    })
  })

  it('lay out the routed forms of list items', async () => {
    const { wrapper, submit } = await mountForm({
      schema: schema.fields.sensors.form,
      data: { label: 'Door', interval: 5 },
      request: ({ data }) => ({ data })
    })
    const input = wrapper.find('.dito-form input')
    expect(input.element.value).toBe('Door')
    await enterValue(input, 'Window')
    expect(await submit()).toEqual({ id: 1, label: 'Window', interval: 5 })
  })
})
