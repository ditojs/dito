<template lang="pug">
.dito-clipboard.dito-buttons.dito-buttons--round(
  v-if="clipboard"
)
  input(
    v-if="interchange"
    ref="input"
    type="file"
    accept=".zip"
    hidden
    @change="onSelectFile"
  )
  DitoButton.dito-button--copy(
    title="Copy Data"
    :disabled="!hasData"
    @click="onCopy"
  )
  DitoButton.dito-button--paste(
    title="Paste Data"
    :disabled="!isPasteEnabled"
    @click="onPaste"
  )
  DitoMenuButton.dito-button--interchange(
    v-if="interchange"
    title="Download or Upload Data"
    :items="interchangeItems"
    placement="bottom-right"
    :cover="false"
    @select="onSelectInterchangeItem"
  )
</template>

<script>
import { computed, onMounted, useTemplateRef } from 'vue'
import { isObject, clone } from '@ditojs/utils'
import { DitoButton, DitoMenuButton } from '@ditojs/ui/src'
import appState from '../appState.js'
import { useDomEvents } from '../composables/useDomEvents.ts'
import { useServices } from '../composables/useSchemaContext.ts'
import {
  createClipboardData,
  matchClipboardData,
  getClipboardData,
  hasClipboardData,
  copyClipboardData,
  readClipboardData
} from '../utils/clipboard.js'
import {
  createInterchangeZip,
  readInterchangeData,
  uploadInterchangeFiles
} from '../utils/interchange.ts'
import { downloadBlob } from '../utils/services.ts'

export default {
  components: { DitoButton, DitoMenuButton },
  emits: ['paste'],

  props: {
    clipboard: { type: [Boolean, Object], required: true },
    schema: { type: Object, required: true },
    // The type of data other than the data of forms, e.g. 'upload':
    type: { type: String, default: undefined },
    hasData: { type: Boolean, required: true },
    // A function, to only serialize the data when copying:
    getData: { type: Function, required: true },
    // The upload fields in the data, for `interchange` to find their files:
    getUploadEntries: { type: Function, required: true },
    // For the `copy()` and `paste()` callbacks of `clipboard`:
    createContext: { type: Function, required: true },
    disabled: { type: Boolean, default: false }
  },

  setup(props, { emit }) {
    const services = useServices()
    const { adminContext } = services
    const { domOn } = useDomEvents()
    const input = useTemplateRef('input')

    const updateClipboardData = () => {
      // Only Chrome reads the clipboard without asking for permission:
      if (appState.agent.chrome) {
        readClipboardData().catch(() => {}) // Report errors only when pasting.
      }
    }

    // Notifications log their error too:
    const notifyError = (error, {
      title = 'Clipboard Error',
      text = error.message
    } = {}) => {
      adminContext.notify({ type: 'error', error, title, text })
    }

    const clipboardOptions = computed(() =>
      isObject(props.clipboard) ? props.clipboard : {}
    )

    const getCopyData = async () => {
      const { copy } = clipboardOptions.value
      const data = await props.getData()
      return (
        data && (
          copy
            ? copy(props.createContext({ clipboardData: data }))
            : clone(data)
        )
      )
    }

    const pasteData = data => {
      const { paste } = clipboardOptions.value
      const pastedData = paste
        ? paste(props.createContext({ clipboardData: data }))
        : data
      if (pastedData) {
        emit('paste', pastedData)
      }
    }

    const downloadData = async () => {
      try {
        const { name } = props.schema
        const clipboardData = createClipboardData(
          name,
          await getCopyData(),
          props.type
        )
        const zip = await createInterchangeZip(
          services,
          clipboardData,
          props.getUploadEntries(clipboardData)
        )
        downloadBlob(
          services,
          new Blob([zip], { type: 'application/zip' }),
          `${name}.zip`
        )
      } catch (error) {
        notifyError(error, { title: 'Download Error' })
      }
    }

    onMounted(() => {
      // Read it now, and again when it can change, on copy and window focus:
      updateClipboardData()
      domOn(document, { copy: updateClipboardData })
      domOn(window, { focus: updateClipboardData })
    })

    return {
      interchange: computed(() => !!clipboardOptions.value.interchange),

      isPasteEnabled: computed(
        () => !props.disabled && hasClipboardData(props.schema.name, props.type)
      ),

      interchangeItems: computed(() => [
        {
          value: 'download',
          label: 'Download',
          icon: 'archive-download',
          disabled: !props.hasData
        },
        {
          value: 'upload',
          label: 'Upload',
          icon: 'archive-upload',
          disabled: props.disabled
        }
      ]),

      async onCopy() {
        try {
          await copyClipboardData(
            props.schema.name,
            await getCopyData(),
            props.type
          )
        } catch (error) {
          notifyError(error)
        }
      },

      async onPaste() {
        try {
          await readClipboardData()
        } catch (error) {
          if (error.name === 'SyntaxError') {
            notifyError(error, {
              text: [
                'The data in the clipboard appears to be malformed:',
                error.message
              ]
            })
            return
          }
          // Fall back to the data copied inside the admin.
          console.error(error, error.name, error.message)
        }
        try {
          const data = getClipboardData(props.schema.name, props.type)
          if (data) {
            pasteData(data)
          }
        } catch (error) {
          notifyError(error)
        }
      },

      onSelectInterchangeItem({ value }) {
        if (value === 'download') {
          downloadData()
        } else {
          input.value.click()
        }
      },

      // Upload the files first, then paste the data like the clipboard's:
      async onSelectFile() {
        const [file] = input.value.files
        // Let the same file be selected again:
        input.value.value = ''
        try {
          const zip = new Uint8Array(await file.arrayBuffer())
          const data = matchClipboardData(
            await readInterchangeData(zip),
            props.schema.name,
            props.type
          )
          if (data) {
            const rejectedNames = await uploadInterchangeFiles(
              services,
              zip,
              props.getUploadEntries(data)
            )
            if (rejectedNames.length > 0) {
              adminContext.notify({
                type: 'warning',
                text: `Not accepted when uploading: ${rejectedNames.join(', ')}`
              })
            }
            pasteData(data)
          } else {
            adminContext.notify({
              type: 'error',
              title: 'Upload Error',
              text: `The file doesn't contain data of '${props.schema.name}'.`
            })
          }
        } catch (error) {
          notifyError(error, { title: 'Upload Error' })
        }
      }
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-clipboard {
  display: flex;
  // Join the buttons into one group:
  gap: 0;

  .dito-button {
    // Round like a button, not a pill:
    border-radius: 2 * $border-radius;

    &:disabled {
      // Keep the group solid, e.g. on the header's background, and only dim
      // the icon:
      opacity: 1;

      &::before {
        opacity: 0.4;
      }
    }

    &--copy {
      // The rounded corner takes up room, so balance the icon with more:
      padding-left: $button-round-padding-hor + 0.25em;
    }

    &--copy,
    &--paste:not(:last-child) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    &--paste,
    &--interchange {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;

      &:not(:focus) {
        // Show only one border between the buttons:
        border-left-color: transparent;
      }
    }

    &--interchange:empty::before {
      @extend %icon-chevron;

      transform: rotate(90deg);
    }
  }

  .dito-schema & {
    // Push clipboard to the right in the flex layout, see:
    // https://codepen.io/tholex/pen/hveBx/
    margin-left: auto;
  }

  .dito-header & {
    // Centered in the header, unlike the tabs, which sit on the page:
    align-self: center;
    margin: 0 0 0 $tab-margin;

    .dito-button {
      // Keep the buttons joined, which `DitoHeader` spaces apart:
      margin: 0;
    }
  }
}
</style>
