<template lang="pug">
  .dito-upload
    table.dito-table
      thead.dito-table-head
        tr
          th
            span Name
          th
            span Size
          th
            span Status
          th
      vue-draggable(
        element="tbody"
        :list="files"
        :options="getDragOptions(draggable)"
        @start="onStartDrag"
        @end="onEndDrag"
      )
        tr(
          v-for="(file, index) in files"
          :key=" file.id || file.fileName"
        )
          td {{ file.originalName }}
          td {{ file.size | formatFileSize }}
          td
            template(v-if="file.upload")
              template(v-if="file.upload.error")
                | Error: {{ file.upload.error }}
              template(v-else-if="file.upload.active")
                | Uploading...
              template(v-else-if="file.upload.success")
                | Uploaded
            template(v-else)
              | Stored
          td.dito-buttons.dito-buttons-round
            button.dito-button(
              v-if="draggable"
              type="button"
              class="dito-button-drag"
              :title="labelize(verbs.drag)"
            )
            button.dito-button(
              v-if="deletable"
              type="button"
              @click="deleteFile(file, index)"
              :class="`dito-button-delete`"
              :title="labelize(verbs.delete)"
            )
    .dito-buttons
      vue-upload.dito-button.dito-upload-button(
        :id="dataPath"
        :name="dataPath"
        :disabled="disabled"
        :post-action="uploadPath"
        :extensions="extensions"
        :accept="accept"
        :multiple="multiple"
        :size="maxSize"
        v-model="uploads"
        @input-filter="inputFilter"
        @input-file="inputFile"
        ref="upload"
      ) Select files
      button.dito-button(
        v-if="uploadable"
        type="button"
        @click.prevent="upload.active = true"
      ) Upload
      button.dito-button(
        v-else-if="cancelable"
        type="button"
        @click.prevent="upload.active = false"
      ) Cancel
</template>

<style lang="sass">
.dito
  .dito-upload
    .dito-button
      vertical-align: top
</style>

<script>
import TypeComponent from '@/TypeComponent'
import VueUpload from 'vue-upload-component'
import VueDraggable from 'vuedraggable'
import formatFileSize from 'filesize'
import parseFileSize from 'filesize-parser'
import OrderedMixin from '@/mixins/OrderedMixin'
import { isArray, asArray } from '@ditojs/utils'

export default TypeComponent.register('upload', {
  mixins: [OrderedMixin],
  components: { VueUpload, VueDraggable },
  filters: { formatFileSize, parseFileSize },

  data() {
    return {
      uploads: []
    }
  },

  computed: {
    upload() {
      return this.$refs.upload
    },

    files() {
      return asArray(this.value)
    },

    extensions() {
      return this.getSchemaValue('extensions')
    },

    accept() {
      const accept = this.getSchemaValue('accept')
      return isArray(accept) ? accept.join(',') : accept
    },

    multiple() {
      return this.getSchemaValue('multiple', true)
    },

    maxSize() {
      const maxSize = this.getSchemaValue('maxSize', true)
      return maxSize ? parseFileSize(maxSize) : undefined
    },

    draggable() {
      return this.getSchemaValue('draggable', true) && this.files.length > 1
    },

    deletable() {
      return this.getSchemaValue('deletable', true)
    },

    uploadable() {
      return this.uploads.length &&
        !(this.upload.active || this.upload.uploaded)
    },

    cancelable() {
      return this.uploads.length && this.upload.active
    },

    uploadPath() {
      const url = this.formComponent.getResourcePath({
        type: 'collection',
        path: `upload/${this.name}`
      })
      return `${this.api.url}${url}`
    }
  },

  methods: {
    processValue(value) {
      // Filter out all newly added files that weren't actually uploaded.
      const files = asArray(value)
        .map(
          ({ upload, ...file }) => !upload || upload.success ? file : null
        )
        .filter(file => file)
      return this.toValue(files)
    },

    toValue(files) {
      return this.multiple ? files : files[0] || null
    },

    deleteFile(file, index) {
      const name = file.originalName

      if (file && confirm(
        `Do you really want to ${this.verbs.remove} ${name}?`)
      ) {
        if (this.multiple) {
          this.value.splice(index, 1)
        } else {
          this.value = null
        }
        if (file.upload) {
          this.upload.remove(file.upload)
        }
        this.notify('info',
          'Successfully Removed', `${name} was ${this.verbs.removed}.`)
      }
    },

    inputFile(newFile, oldFile) {
      if (newFile && !oldFile) {
        const file = {
          id: newFile.id,
          originalName: newFile.name,
          size: newFile.size,
          upload: newFile
        }
        if (this.multiple) {
          this.value.push(file)
        } else {
          this.value = file
        }
      }
      if (newFile && oldFile) {
        if (newFile.success) {
          const file = newFile.response[0]
          file.upload = newFile
          if (this.multiple) {
            // Replace the upload file object with the file object received from
            // the upload response.
            const index = this.value.findIndex(file => file.id === newFile.id)
            if (index >= 0) {
              this.$set(this.value, index, file)
            }
          } else {
            this.value = file
          }
        } else {
          console.log('update', newFile)
        }
      }
      if (!newFile && oldFile) {
        console.log('remove', oldFile)
      }
    },

    inputFilter(newFile/*, oldFile, prevent */) {
      const xhr = newFile?.xhr
      if (this.api.cors?.credentials && xhr && !xhr.withCredentials) {
        xhr.withCredentials = true
      }
    }
  }
})
</script>
