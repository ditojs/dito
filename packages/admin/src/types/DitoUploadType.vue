<template lang="pug">
.dito-upload(
  ref="element"
  :class="{ 'dito-upload--drop-target': isDropTarget }"
)
  //- Render the upload component invisibly at the root, and delegate the clicks
  //- of the upload buttons further below to it:
  VueUpload.dito-upload__input(
    ref="upload"
    v-model="uploads"
    :inputId="componentPath"
    :name="dataPath"
    :disabled="disabled"
    :postAction="uploadPath"
    :headers="uploadOptions?.headers"
    :extensions="extensions"
    :accept="accept"
    :multiple="multiple"
    :size="maxSize"
    :drop="true"
    :dropDirectory="true"
    @input-filter="onInputFilter"
    @input-file="onInputFile"
  )
  table.dito-table.dito-table--separators.dito-table--background
    //- Styling comes from `DitoTableHead`
    thead.dito-table-head
      tr
        th(scope="col")
          span File
        th(scope="col")
          span Size
        th(scope="col")
          span Status
        th(scope="col")
          span
    DitoDraggable(
      :modelValue="files"
      as="tbody"
      :options="getDraggableOptions()"
      :draggable="draggable"
    )
      template(
        v-if="multiple || !isUploadActive"
      )
        //- Stored files have unique keys, uploading files unique ids:
        tr(
          v-for="(file, index) in files"
          :key="file.key ?? file.id ?? file.name"
        )
          td(
            v-if="render"
            v-html="renderFile(file, index)"
          )
          td(
            v-else-if="downloadUrls[index]"
          )
            a(
              :download="file.name"
              :href="downloadUrls[index]"
              target="_blank"
              @click.prevent="onClickDownload(file, index)"
            )
              DitoUploadFile(
                :file="file"
                :upload="getUpload(file)"
                :thumbnail="thumbnails"
                :thumbnailUrl="thumbnailUrls[index]"
              )
          td(
            v-else
          )
            DitoUploadFile(
              :file="file"
              :upload="getUpload(file)"
              :thumbnail="thumbnails"
              :thumbnailUrl="thumbnailUrls[index]"
            )
          td.dito-upload__size {{ formatFileSize(file.size) }}
          td.dito-upload__status
            template(
              v-if="file.upload"
            )
              template(
                v-if="file.upload.success"
              )
                | Uploaded
              template(
                v-else-if="getUpload(file)?.error"
              )
                | Error: {{ getUpload(file).error }}
              template(
                v-else-if="getUpload(file)?.active"
              )
                | Uploading...
            template(
              v-else
            )
              | Stored
          td.dito-table__buttons
            .dito-buttons.dito-buttons--round
              template(
                v-if="!multiple"
              )
                DitoClipboard(
                  v-if="schema.clipboard"
                  v-bind="clipboardAttributes"
                  @paste="pasteFiles"
                )
                DitoButton.dito-button--upload(
                  :title="uploadTitle"
                  @click="onClickUpload"
                )
              DitoDragHandle(
                v-if="draggable"
                :disabled="disabled"
                @move="delta => moveItem(index, delta)"
              )
              DitoButton(
                v-if="deletable"
                :verb="verbs.delete"
                :disabled="disabled"
                @click="deleteFile(file)"
              )
    tfoot(
      v-if="multiple || isUploadActive || !hasFiles"
    )
      tr
        td(:colspan="4")
          .dito-upload__footer
            DitoProgress.dito-upload__progress(
              v-if="isUploadActive"
              :value="uploadProgress"
              :max="100"
            )
            .dito-buttons.dito-buttons--round
              DitoButton(
                v-if="isUploadActive"
                @click.prevent="$refs.upload.active = false"
              ) Cancel
              template(
                v-if="multiple || !hasFiles"
              )
                DitoClipboard(
                  v-if="schema.clipboard"
                  v-bind="clipboardAttributes"
                  @paste="pasteFiles"
                )
                DitoButton.dito-button--upload(
                  :title="uploadTitle"
                  @click="onClickUpload"
                )
</template>

<script>
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { useSortable } from '../composables/useSortable.ts'
import DitoDragHandle from '../components/DitoDragHandle.vue'
import DitoClipboard from '../components/DitoClipboard.vue'
import { DitoButton, DitoProgress } from '@ditojs/ui/src'
import { formatFileSize } from '../utils/units.js'
import {
  getUploadLimits,
  isAcceptedFile,
  asFiles,
  getStoredFiles
} from '../utils/upload.ts'
import { appendDataPath } from '../utils/data.js'
import { getMultipleValue } from '../utils/schema/data.js'
import { downloadBlob, getResourceUrl, getVerbs } from '../utils/services.ts'
import {
  fetchBlob,
  getUploadOptions,
  resolveDownloadUrl
} from '../utils/request.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { getHtml } from '../utils/html.js'
import { isArray, clone } from '@ditojs/utils'
import VueUpload from 'vue-upload-component'
import { fileDropTargetsKey } from '../utils/keys.ts'

// @vue/component
const DitoUploadType = {
  components: {
    VueUpload,
    DitoButton,
    DitoProgress,
    DitoDragHandle,
    DitoClipboard
  },
  props: fieldProps,

  setup(props) {
    const field = useField(props)
    const {
      value,
      context,
      createContext,
      services,
      disabled,
      onChange,
      element
    } = field
    const { adminContext } = services
    const getModel = () => services.dataContext.model
    const fileDropTargets = inject(fileDropTargetsKey)
    const upload = useTemplateRef('upload')
    const uploads = ref([])
    let removeDropTarget = null
    // Settle the data model's pending loads of running uploads:
    const settleUploadById = new Map()

    const { getSchemaValue } = field
    const multiple = computed(() => getMultipleValue(props.schema, context))
    const render = computed(() =>
      getSchemaValue('render', { type: Function, default: null })
    )
    const files = computed(() => asFiles(value.value))
    // Only multiple files are dragged or added, as the value itself:
    const listEntry = computed(() => ({
      schema: props.schema,
      list: files.value,
      dataPath: props.dataPath
    }))

    const sortable = useSortable({
      getListEntry: () => listEntry.value,
      onChange
    })

    // The upload component replaces its file objects on each update, so the
    // value's files refer to their upload by id:
    const uploadsById = computed(
      () => new Map(uploads.value.map(upload => [upload.id, upload]))
    )
    const hasUploads = computed(() => uploads.value.length > 0)

    const isUploadReady = computed(
      () => (
        hasUploads.value &&
        !(upload.value.active || upload.value.uploaded)
      )
    )

    // Views without resource can't upload, see `api.resources.upload()`:
    const uploadPath = computed(() =>
      services.resourceContext
        ? getResourceUrl(services, {
            type: 'upload',
            method: 'post',
            path: adminContext.api.normalizePath(props.dataPath)
          })
        : null
    )

    const uploadOptions = computed(() =>
      uploadPath.value
        ? getUploadOptions(adminContext.api, uploadPath.value)
        : null
    )

    const getFileContext = (file, index) =>
      multiple.value
        ? createContext({
            value: file,
            data: files.value,
            itemDataPath: props.dataPath,
            dataPath: appendDataPath(props.dataPath, index)
          })
        : context

    const getDownloadUrl = (file, index) =>
      file.url
        ? file.url
        : !file.upload || file.upload.success
          ? getSchemaValue('downloadUrl', {
              type: String,
              default: null,
              context: getFileContext(file, index)
            })
          : null

    const downloadUrls = computed(() =>
      // Resolve like `fetchBlob()`, for links and clicks to match:
      files.value.map((file, index) => {
        const url = getDownloadUrl(file, index)
        return url ? resolveDownloadUrl(adminContext.api, url) : null
      })
    )

    const getFileIndex = file =>
      multiple.value && value.value
        ? value.value.findIndex(it => it.id === file.id)
        : -1

    const addFile = file => {
      if (multiple.value) {
        if (value.value) {
          getModel().insert(listEntry.value, value.value.length, file)
        } else {
          value.value = [file]
        }
      } else {
        value.value = file
      }
    }

    const replaceFile = (file, newFile) => {
      if (multiple.value) {
        const index = getFileIndex(file)
        if (index >= 0) {
          if (newFile) {
            getModel().set(
              {
                data: value.value,
                name: index,
                dataPath: appendDataPath(props.dataPath, index)
              },
              newFile
            )
          } else {
            getModel().remove(listEntry.value, index)
          }
        }
      } else {
        value.value = newFile
      }
    }

    const removeFile = file => replaceFile(file, null)

    const uploadLimits = computed(() => getUploadLimits(props.schema, context))

    const settleUpload = id => {
      settleUploadById.get(id)?.()
      settleUploadById.delete(id)
    }

    // `VueUpload` handles the files dropped on its parent, see `:drop="true"`:
    const updateDropTarget = () => {
      removeDropTarget?.()
      removeDropTarget = disabled.value
        ? null
        : fileDropTargets.add(element.value)
    }

    watch(disabled, updateDropTarget)

    // Upload added files right away:
    watch(isUploadReady, ready => {
      if (ready) {
        nextTick(() => {
          upload.value.active = true
        })
      }
    })

    onMounted(updateDropTarget)

    onUnmounted(() => {
      removeDropTarget?.()
      for (const settleUpload of settleUploadById.values()) {
        settleUpload()
      }
    })

    return {
      ...field,
      ...sortable,
      verbs: computed(() => getVerbs(services)),
      uploads,
      multiple,
      render,
      files,
      downloadUrls,
      uploadPath,
      uploadOptions,
      formatFileSize,

      // Dragged files' types can't be read before the drop, so ignore `accept`:
      isDropTarget: computed(
        () => fileDropTargets.isDraggingFiles && !disabled.value
      ),

      uploadTitle: computed(() =>
        multiple.value ? 'Upload Files' : 'Upload File'
      ),

      thumbnailUrls: computed(() =>
        files.value.map((file, index) =>
          !file.upload || file.upload.success
            ? getSchemaValue('thumbnailUrl', {
                type: String,
                default: null,
                context: getFileContext(file, index)
              }) || (
                file.type.startsWith('image/')
                  ? file.url
                  : null
              )
            : null
        )
      ),

      extensions: computed(() => uploadLimits.value.extensions),

      accept: computed(() => {
        const accept = getSchemaValue('accept', { type: Array })
        return isArray(accept) ? accept.join(',') : accept
      }),

      maxSize: computed(() => uploadLimits.value.maxSize),

      draggable: computed(
        () => (
          getSchemaValue('draggable', { type: Boolean, default: false }) &&
          files.value.length > 1
        )
      ),

      deletable: computed(() =>
        getSchemaValue('deletable', { type: Boolean, default: false })
      ),

      thumbnails: computed(() => {
        const thumbnails = getSchemaValue('thumbnails', {
          type: [Boolean, String],
          default: () => !!props.schema.thumbnailUrl
        })
        return thumbnails === true ? 'medium' : thumbnails || null
      }),

      hasFiles: computed(() => files.value.length > 0),

      // Shared by the clipboards in the footer and in the row of single files:
      clipboardAttributes: computed(() => ({
        clipboard: props.schema.clipboard,
        schema: props.schema,
        label: field.labelText.value,
        type: 'upload',
        hasData: getStoredFiles(value.value).length > 0,
        getData: () => ({ files: getStoredFiles(value.value) }),
        getUploadEntries: data => [
          {
            schema: props.schema,
            data,
            name: 'files',
            dataPath: props.dataPath
          }
        ],
        createContext,
        disabled: disabled.value || field.readonly.value
      })),

      isUploadActive: computed(() => hasUploads.value && upload.value.active),

      uploadProgress: computed(
        () => (
          uploads.value.reduce((total, file) => total + +file.progress, 0) /
          uploads.value.length
        )
      ),

      renderFile(file, index) {
        return getHtml(render.value(getFileContext(file, index)))
      },

      getUpload(file) {
        return file.upload
          ? (uploadsById.value.get(file.upload.id) ?? null)
          : null
      },

      async deleteFile(file) {
        await confirmAndRemove(services, {
          label: file.name,
          // The form still needs to be saved:
          isTransient: true,
          remove: () => {
            // The files may have changed while the dialog was open, and stored
            // files may not have ids:
            const index = files.value.indexOf(file)
            if (index < 0) {
              return false
            }
            if (multiple.value) {
              getModel().remove(listEntry.value, index)
            } else {
              value.value = null
            }
            if (file.upload) {
              upload.value.remove(file.upload.id)
            }
            onChange()
          }
        })
      },

      // Added files refer to their upload with `upload: { id, success }`,
      // `success` telling `serializeValue()` which files were stored:
      onInputFile(newFile, oldFile) {
        if (newFile && !oldFile) {
          const { id, name, size } = newFile
          addFile({ id, name, size, upload: { id, success: false } })
          // Submitting waits for the upload, which writes the stored file:
          const { promise, resolve } = Promise.withResolvers()
          settleUploadById.set(id, resolve)
          getModel().trackPendingLoad(promise)
        } else if (newFile && oldFile) {
          const { success, error } = newFile
          if (success) {
            onChange()
            const file = newFile.response[0]
            if (file) {
              file.upload = { id: newFile.id, success: true }
              replaceFile(newFile, file)
            } else {
              removeFile(newFile)
            }
            settleUpload(newFile.id)
          } else if (error) {
            removeFile(newFile)
            settleUpload(newFile.id)
            const text = (
              {
                abort: 'Upload aborted',
                denied: 'Upload denied',
                extension: `Unsupported file-type: ${newFile.name}`,
                network: 'Network error encountered during upload',
                server: 'Server error occurred during upload',
                size: `File is too large: ${formatFileSize(newFile.size)}`,
                timeout: 'Timeout occurred during upload'
              }[error] ||
              `Unknown File Upload Error: '${error}'`
            )
            adminContext.notify({
              type: 'error',
              error,
              title: 'File Upload Error',
              text
            })
          }
        } else {
          // The upload was removed:
          settleUpload(oldFile.id)
        }
      },

      onInputFilter(newFile /*, oldFile, prevent */) {
        // `VueUpload` only creates the request when uploading, and has no
        // setting for its credentials:
        const xhr = newFile?.xhr
        if (
          uploadOptions.value?.withCredentials &&
          xhr &&
          !xhr.withCredentials
        ) {
          xhr.withCredentials = true
        }
      },

      async onClickDownload(file, index) {
        try {
          const blob = await fetchBlob(
            adminContext.api,
            downloadUrls.value[index]
          )
          downloadBlob(services, blob, file.name)
        } catch (error) {
          adminContext.notify({
            type: 'error',
            error,
            title: 'File Download Error',
            text: `Unable to download ${file.name}: ${error.message}`
          })
        }
      },

      // Paste only the files that the upload would accept, and only once:
      pasteFiles({ files: pastedFiles }) {
        const isAccepted = file => isAcceptedFile(file, uploadLimits.value)
        const acceptedFiles = pastedFiles.filter(isAccepted)
        const rejectedFiles = pastedFiles.filter(file => !isAccepted(file))
        const keys = new Set(files.value.map(file => file.key))
        const newFiles = acceptedFiles
          .slice(0, multiple.value ? Infinity : 1)
          .filter(file => !keys.has(file.key))
        for (const file of newFiles) {
          addFile(clone(file))
        }
        if (newFiles.length > 0) {
          onChange()
        }
        if (rejectedFiles.length > 0) {
          adminContext.notify({
            type: 'warning',
            text: `Not accepted when pasting: ${
              rejectedFiles.map(file => file.name).join(', ')
            }`
          })
        }
      },

      onClickUpload(event) {
        upload.value.$el
          .querySelector('input')
          .dispatchEvent(new event.constructor(event.type, event))
      }
    }
  }
}

defineType({
  type: 'upload',
  component: DitoUploadType,
  defaultValue: context =>
    getMultipleValue(context.schema, context) ? [] : null,
  getProperty: (schema, context) =>
    getMultipleValue(schema, context)
      ? { type: 'array', items: { type: 'asset' } }
      : { type: 'asset' },

  serializeValue(context) {
    const files = getStoredFiles(context.value)
    return getMultipleValue(context.schema, context) ? files : files[0] || null
  }
})

export default DitoUploadType
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-upload {
  // Positioned for `z-index`, to stay above the overlay of `DitoRoot` until it
  // faded out:
  position: relative;
  transition:
    filter $drag-overlay-duration,
    z-index 0s $drag-overlay-duration;

  &--drop-target {
    z-index: $z-index-drag-overlay + 1;
    filter: drop-shadow(0 4px 8px rgb(0, 0, 0, 0.25));
    transition: filter $drag-overlay-duration;
  }

  .dito-table {
    tr,
    .dito-table__buttons {
      vertical-align: middle;
    }
  }

  // Like inlined items, show the clipboard and drag buttons only on hover,
  // hidden but keeping their space so that the table doesn't shift:
  @media (hover: hover) {
    &:not(:hover, :focus-within) &__footer,
    tbody tr:not(:hover, :focus-within) {
      .dito-clipboard .dito-button,
      .dito-button--drag {
        visibility: hidden;
      }
    }
  }

  &__size,
  &__status {
    white-space: nowrap;
  }

  & &__input {
    // See `onClickUpload()` method for details.
    display: block;
    pointer-events: none;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  &__progress {
    flex: auto;
    margin-right: $form-spacing;
  }
}
</style>
