<template lang="pug">
.dito-upload(
  ref="dropTarget"
  :class="{ 'dito-upload--drop-target': isDropTarget }"
)
  //- In order to handle upload buttons in multiple possible places, depending
  //- on whether they handle single or multiple uploads, render the upload
  //- component invisibly at the root, and delegate the click events to it from
  //- the buttons rendered further below. Luckily this works surprisingly well.
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
      v-model="files"
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
                @move="delta => moveFile(file, delta)"
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
                @click.prevent="upload.active = false"
              ) Cancel
              DitoButton.dito-button--upload(
                v-if="multiple || !hasFiles"
                :title="uploadTitle"
                @click="onClickUpload"
              )
</template>

<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import DitoContext from '../DitoContext.js'
import DitoDragHandle from '../components/DitoDragHandle.vue'
import { DitoButton } from '@ditojs/ui/src'
import SortableMixin from '../mixins/SortableMixin.js'
import { getSchemaAccessor } from '../utils/accessor.js'
import { formatFileSize, parseFileSize } from '../utils/units.js'
import { appendDataPath } from '../utils/data.js'
import {
  fetchBlob,
  getUploadOptions,
  resolveDownloadUrl
} from '../utils/request.js'
import { confirmAndRemove } from '../utils/dialogs.js'
import { getListWithMovedItem } from '../utils/list.js'
import { isArray, asArray, escapeHtml } from '@ditojs/utils'
import VueUpload from 'vue-upload-component'

// @vue/component
export default DitoTypeComponent.register('upload', {
  mixins: [SortableMixin],
  components: { VueUpload, DitoButton, DitoDragHandle },
  inject: ['$fileDropTargets'],

  data() {
    return {
      uploads: [],
      // Removes the upload from the targets of dragged files, see
      // `updateDropTarget()`.
      removeDropTarget: null
    }
  },

  computed: {
    fileDropTargets() {
      return this.$fileDropTargets()
    },

    // Whether files are dragged over the admin while the upload is enabled, for
    // which it stands out above the overlay of `DitoRoot`. The dragged files'
    // types can't be read before the drop, so `accept` isn't checked here.
    isDropTarget() {
      return this.fileDropTargets.isDraggingFiles && !this.disabled
    },

    upload() {
      return this.$refs.upload
    },

    uploadTitle() {
      return this.multiple ? 'Upload Files' : 'Upload File'
    },

    files: {
      get() {
        return asFiles(this.value)
      },

      // Writes the reordered files, see `DitoDraggable` and `moveFile()`.
      set(files) {
        this.value = this.multiple ? files : files[0] ?? null
      }
    },

    downloadUrls() {
      // Resolve the URLs like `fetchBlob()` does, so that the links point to
      // the same files that clicking them downloads:
      return this.files.map((file, index) => {
        const url = this.getDownloadUrl(file, index)
        return url ? resolveDownloadUrl(this.api, url) : null
      })
    },

    thumbnailUrls() {
      return this.files.map((file, index) => this.getThumbnailUrl(file, index))
    },

    multiple: getSchemaAccessor('multiple', {
      type: Boolean,
      default: false,
      // No callback as it's used in `processValue()`
      callback: false
    }),

    extensions: getSchemaAccessor('extensions', {
      type: [Array, String, RegExp]
    }),

    accept: getSchemaAccessor('accept', {
      type: Array,
      get(accept) {
        return isArray(accept) ? accept.join(',') : accept
      }
    }),

    maxSize: getSchemaAccessor('maxSize', {
      type: [String, Number],
      get(maxSize) {
        return maxSize ? parseFileSize(maxSize) : undefined
      }
    }),

    draggable: getSchemaAccessor('draggable', {
      type: Boolean,
      default: false,
      get(draggable) {
        return draggable && this.files.length > 1
      }
    }),

    deletable: getSchemaAccessor('deletable', {
      type: Boolean,
      default: false
    }),

    render: getSchemaAccessor('render', {
      type: Function,
      default: null
    }),

    thumbnails: getSchemaAccessor('thumbnails', {
      type: [Boolean, String],
      default(thumbnails) {
        return thumbnails ?? !!this.schema.thumbnailUrl
      },
      get(thumbnails) {
        return thumbnails === true ? 'medium' : thumbnails || null
      }
    }),

    hasFiles() {
      return this.files.length > 0
    },

    // The files of the upload component by their ids. It replaces a file's
    // object on each update, so the files in the value only refer to their
    // upload by id, see `onInputFile()` and `getUpload()`.
    uploadsById() {
      return new Map(this.uploads.map(upload => [upload.id, upload]))
    },

    hasUploads() {
      return this.uploads.length > 0
    },

    isUploadReady() {
      return (
        this.hasUploads &&
        !(this.upload.active || this.upload.uploaded)
      )
    },

    isUploadActive() {
      return this.hasUploads && this.upload.active
    },

    uploadProgress() {
      return (
        this.uploads.reduce((total, file) => total + +file.progress, 0) /
        this.uploads.length
      )
    },

    uploadPath() {
      // Uploads are posted to the resource of the data, see
      // `api.resources.upload()`, which views without resource don't have.
      return this.dataComponent?.resource
        ? this.getResourceUrl({
            type: 'upload',
            method: 'post',
            path: this.api.normalizePath(this.dataPath)
          })
        : null
    },

    uploadOptions() {
      return this.uploadPath
        ? getUploadOptions(this.api, this.uploadPath)
        : null
    }
  },

  watch: {
    disabled: 'updateDropTarget',

    isUploadReady(ready) {
      if (ready) {
        // Auto-upload.
        this.$nextTick(() => {
          this.upload.active = true
        })
      }
    }
  },

  mounted() {
    this.updateDropTarget()
  },

  unmounted() {
    this.removeDropTarget?.()
  },

  methods: {
    formatFileSize,

    // Adds the upload to the targets of dragged files while it's enabled.
    // `VueUpload` handles the files dropped on its parent, which is the same
    // element, see `:drop="true"`.
    updateDropTarget() {
      this.removeDropTarget?.()
      this.removeDropTarget = this.disabled
        ? null
        : this.fileDropTargets.add(this.$refs.dropTarget)
    },

    getFileContext(file, index) {
      return this.multiple
        ? new DitoContext(this, {
            value: file,
            data: this.files,
            index,
            dataPath: appendDataPath(this.dataPath, index)
          })
        : this.context
    },

    renderFile(file, index) {
      return this.render(this.getFileContext(file, index))
    },

    // Returns the current file object of the upload component for a file that
    // was added through it, or `null`.
    getUpload(file) {
      return file.upload ? (this.uploadsById.get(file.upload.id) ?? null) : null
    },

    getDownloadUrl(file, index) {
      return file.url
        ? file.url
        : !file.upload || file.upload.success
          ? this.getSchemaValue('downloadUrl', {
              type: String,
              default: null,
              context: this.getFileContext(file, index)
            })
          : null
    },

    getThumbnailUrl(file, index) {
      return !file.upload || file.upload.success
        ? this.getSchemaValue('thumbnailUrl', {
            type: String,
            default: null,
            context: this.getFileContext(file, index)
          }) || (
            file.type.startsWith('image/')
              ? file.url
              : null
          )
        : null
    },

    async deleteFile(file) {
      if (!file) return
      await confirmAndRemove(this, {
        label: escapeHtml(file.name),
        // The file is only removed from the value, which still needs the form
        // to be saved.
        isTransient: true,
        remove: () => {
          // Look up the file by identity once confirmed, as the files may have
          // changed while the dialog was open. Stored files may not have ids,
          // see `getFileIndex()`.
          const index = this.files.indexOf(file)
          if (index < 0) {
            return false
          }
          if (this.multiple) {
            this.value.splice(index, 1)
          } else {
            this.value = null
          }
          if (file.upload) {
            this.upload.remove(file.upload.id)
          }
          this.onChange()
        }
      })
    },

    // Moves the file by `delta` positions, see `DitoDragHandle`.
    moveFile(file, delta) {
      const files = getListWithMovedItem(this.files, file, delta)
      if (files) {
        this.files = files
        this.onChange()
      }
    },

    getFileIndex(file) {
      return this.multiple && this.value
        ? this.value.findIndex(it => it.id === file.id)
        : -1
    },

    addFile(file) {
      if (this.multiple) {
        if (this.value) {
          this.value.push(file)
        } else {
          this.value = [file]
        }
      } else {
        this.value = file
      }
    },

    replaceFile(file, newFile) {
      if (this.multiple) {
        const index = this.getFileIndex(file)
        if (index >= 0) {
          if (newFile) {
            this.value[index] = newFile
          } else {
            this.value.splice(index, 1)
          }
        }
      } else {
        this.value = newFile
      }
    },

    removeFile(file) {
      this.replaceFile(file, null)
    },

    // Files added through the upload component refer to their upload with
    // `upload: { id, success }` in the value: `success` tells `processValue()`
    // which files were stored, and the upload's state is read through
    // `getUpload()`.
    onInputFile(newFile, oldFile) {
      if (newFile && !oldFile) {
        const { id, name, size } = newFile
        this.addFile({ id, name, size, upload: { id, success: false } })
      }
      if (newFile && oldFile) {
        const { success, error } = newFile
        if (success) {
          this.onChange()
          const file = newFile.response[0]
          if (file) {
            file.upload = { id: newFile.id, success: true }
            // Replace the file added for the upload with the file received
            // in the upload response.
            this.replaceFile(newFile, file)
          } else {
            this.removeFile(newFile)
          }
        } else if (error) {
          this.removeFile(newFile)
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
          this.notify({
            type: 'error',
            error,
            title: 'File Upload Error',
            text
          })
        }
      }
    },

    onInputFilter(newFile /*, oldFile, prevent */) {
      // `VueUpload` only creates the request when uploading, and has no setting
      // for its credentials:
      const xhr = newFile?.xhr
      if (this.uploadOptions?.withCredentials && xhr && !xhr.withCredentials) {
        xhr.withCredentials = true
      }
    },

    async onClickDownload(file, index) {
      try {
        const blob = await fetchBlob(this.api, this.downloadUrls[index])
        const url = URL.createObjectURL(blob)
        try {
          this.download({ filename: file.name, url })
        } finally {
          // Release the blob once the browser started the download, which
          // some browsers don't do synchronously when the link is clicked.
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      } catch (error) {
        this.notify({
          type: 'error',
          error,
          title: 'File Download Error',
          text: `Unable to download ${file.name}: ${error.message}`
        })
      }
    },

    onClickUpload(event) {
      // Delegate the click event to the hidden file input.
      this.upload.$el.querySelector('input').dispatchEvent(
        new event.constructor(event.type, event)
      )
    }
  },

  processValue({ schema, value }) {
    // Filter out all newly added files that weren't actually uploaded.
    const files = asFiles(value)
      .map(({ upload, ...file }) => (!upload || upload.success ? file : null))
      .filter(file => file)
    return schema.multiple ? files : files[0] || null
  }
})

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
