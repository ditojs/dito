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
    :inputId="dataPath"
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
              DitoButton.dito-button--upload(
                v-if="!multiple"
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
            progress.dito-progress(
              v-if="isUploadActive"
              :value="uploadProgress"
              max="100"
            )
            .dito-buttons.dito-buttons--round
              DitoButton(
                v-if="isUploadActive"
                @click.prevent="$refs.upload.active = false"
              ) Cancel
              DitoButton.dito-button--upload(
                v-if="multiple || !hasFiles"
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
import { DitoButton } from '@ditojs/ui/src'
import { formatFileSize, parseFileSize } from '../utils/units.js'
import { appendDataPath } from '../utils/data.js'
import { getMultipleValue } from '../utils/schema/data.js'
import { download, getResourceUrl, getVerbs } from '../utils/services.ts'
import {
  fetchBlob,
  getUploadOptions,
  resolveDownloadUrl
} from '../utils/request.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { isArray, asArray, escapeHtml } from '@ditojs/utils'
import VueUpload from 'vue-upload-component'
import { fileDropTargetsKey } from '../utils/keys.ts'

// @vue/component
const DitoTypeUpload = {
  components: { VueUpload, DitoButton, DitoDragHandle },
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

      extensions: computed(() =>
        getSchemaValue('extensions', { type: [Array, String, RegExp] })
      ),

      accept: computed(() => {
        const accept = getSchemaValue('accept', { type: Array })
        return isArray(accept) ? accept.join(',') : accept
      }),

      maxSize: computed(() => {
        const maxSize = getSchemaValue('maxSize', {
          type: [String, Number]
        })
        return maxSize ? parseFileSize(maxSize) : undefined
      }),

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

      isUploadActive: computed(() => hasUploads.value && upload.value.active),

      uploadProgress: computed(
        () => (
          uploads.value.reduce((total, file) => total + +file.progress, 0) /
          uploads.value.length
        )
      ),

      renderFile(file, index) {
        return render.value(getFileContext(file, index))
      },

      getUpload(file) {
        return file.upload
          ? (uploadsById.value.get(file.upload.id) ?? null)
          : null
      },

      async deleteFile(file) {
        await confirmAndRemove(services, {
          label: escapeHtml(file.name),
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
          const url = URL.createObjectURL(blob)
          try {
            download(services, { filename: file.name, url })
          } finally {
            // Some browsers don't start the download synchronously:
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }
        } catch (error) {
          adminContext.notify({
            type: 'error',
            error,
            title: 'File Download Error',
            text: `Unable to download ${file.name}: ${error.message}`
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
  component: DitoTypeUpload,

  serializeValue(context) {
    // Filter out added files that weren't uploaded:
    const files = asFiles(context.value)
      .map(({ upload, ...file }) => (!upload || upload.success ? file : null))
      .filter(file => file)
    return getMultipleValue(context.schema, context) ? files : files[0] || null
  }
})

export default DitoTypeUpload

function asFiles(value) {
  return value ? asArray(value) : []
}
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

    .dito-progress {
      flex: auto;
      margin-right: $form-spacing;
    }
  }
}
</style>
