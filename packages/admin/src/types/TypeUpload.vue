<template lang="pug">
  .dito-upload
    ul
      li(
        v-for="(file, index) in files"
        :key="file.id"
      )
        span {{ file.name }} - {{ file.size | formatFileSize }}
        span(v-if="file.error")  - Error: {{ file.error }}
        span(v-else-if="file.active")  - Active
        span(v-else-if="file.success")  - Success
      .dito-buttons
        vue-upload.dito-button.dito-upload-button(
          :id="dataPath"
          :name="dataPath"
          :disabled="disabled"
          :post-action="uploadPath"
          extensions="gif,jpg,jpeg,png,webp"
          accept="image/png,image/gif,image/jpeg,image/webp"
          :multiple="multiple"
          :size="'10MB' | parseFileSize"
          v-model="files"
          @input-filter="inputFilter"
          @input-file="inputFile"
          ref="upload"
        ) Select files
        button.dito-button(
          v-if="canUpload"
          type="button"
          @click.prevent="upload.active = true"
        ) Upload
        button.dito-button(
          v-else-if="canCancel"
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
import formatFileSize from 'filesize'
import parseFileSize from 'filesize-parser'

export default TypeComponent.register('upload', {
  components: { VueUpload },
  filters: { formatFileSize, parseFileSize },

  data() {
    return {
      files: []
    }
  },

  computed: {
    uploadPath() {
      const url = this.formComponent.getResourcePath({
        type: 'collection',
        path: `upload/${this.name}`
      })
      return `${this.api.url}${url}`
    },

    upload() {
      return this.$refs.upload
    },

    multiple() {
      return this.getSchemaValue('multiple', true)
    },

    canUpload() {
      return this.files.length &&
        !(this.upload.active || this.upload.uploaded)
    },

    canCancel() {
      return this.files.length && this.upload.active
    }
  },

  methods: {
    inputFilter(newFile, oldFile, prevent) {
      const xhr = newFile?.xhr
      if (this.api.cors?.credentials && xhr && !xhr.withCredentials) {
        xhr.withCredentials = true
      }
      if (newFile && !oldFile) {
        if (/(\/|^)(Thumbs\.db|desktop\.ini|\..+)$/.test(newFile.name)) {
          return prevent()
        }
        if (/\.(pdf|php5?|html?|jsx?)$/i.test(newFile.name)) {
          return prevent()
        }
      }
    },

    inputFile(newFile, oldFile) {
      if (newFile && !oldFile) {
        console.log('add', newFile)
      }
      if (newFile && oldFile) {
        console.log('update', newFile)
      }
      if (!newFile && oldFile) {
        console.log('remove', oldFile)
      }
    }
  }
})
</script>
