<template lang="pug">
.dito-upload-file
  .dito-thumbnail(
    v-if="thumbnail"
    :class="`dito-thumbnail--${thumbnail}`"
  )
    .dito-thumbnail__inner
      img(
        v-if="source"
        :src="source"
      )
      .dito-thumbnail__type(
        v-else
      )
        span {{ type }}
  span {{ file.name }}
</template>

<script>
import DitoComponent from '../DitoComponent.js'

// @vue/component
export default DitoComponent.component('DitoUploadFile', {
  props: {
    file: { type: Object, required: true },
    thumbnail: { type: String, default: null },
    thumbnailUrl: { type: String, default: null }
  },

  data() {
    return {
      uploadUrl: null
    }
  },

  computed: {
    type() {
      return (
        TYPES[this.file.type] ||
        this.file.name.split('.').pop().toUpperCase()
      )
    },

    source() {
      return this.uploadUrl || this.thumbnailUrl
    }
  },

  watch: {
    'file.upload.file': {
      immediate: true,
      handler(file) {
        if (file && this.thumbnail) {
          const reader = new FileReader()
          reader.onload = () => {
            this.uploadUrl = reader.result
          }
          reader.readAsDataURL(file)
        } else {
          this.uploadUrl = null
        }
      }
    }
  }
})

const TYPES = {
  'text/plain': 'TXT',
  'text/html': 'HTML',
  'text/css': 'CSS',
  'text/javascript': 'JS',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'movie/mp4': 'MP4',
  'audio/mpeg': 'MP3',
  'application/json': 'JSON',
  'application/xml': 'XML',
  'application/pdf': 'PDF',
  'application/zip': 'ZIP'
}
</script>

<style lang="scss">
@use 'sass:math';
@import '../styles/_imports';

.dito-upload-file {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.dito-thumbnail {
  $self: &;

  // Small size by default
  --max-size: #{1 * $input-height};
  --corner-size: calc(var(--max-size) / 5);
  --shadow-size: 1px;
  --min-size: calc(2 * var(--corner-size));
  --margin: 0em;
  --drop-shadow: drop-shadow(
    0 calc(var(--shadow-size) * 0.75) var(--shadow-size) #{rgba(
        $color-black,
        0.4
      )}
  );

  position: relative;
  margin: var(--margin);
  margin-right: 0.5em;
  filter: var(--drop-shadow);

  &--small {
    --max-size: #{1 * $input-height};
    --margin: 0em;
    --shadow-size: 1px;
  }

  &--medium {
    --max-size: #{2 * $input-height};
    --margin: 0.25em;
    --shadow-size: 1.5px;
  }

  &--large {
    --max-size: #{4 * $input-height};
    --margin: 0.5em;
    --shadow-size: 2.5px;
  }

  &__inner {
    background: #ffffff;
    clip-path: polygon(
      0 0,
      calc(100% - var(--corner-size)) 0,
      100% var(--corner-size),
      100% 100%,
      0 100%
    );

    &::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: var(--corner-size);
      height: var(--corner-size);
      background: linear-gradient(45deg, #ffffff, #eeeeee 40%, #dddddd 50%);
      filter: var(--drop-shadow);
    }
  }

  &__type {
    --font-size: var(--corner-size);

    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-size);
    min-height: var(--max-size);
    aspect-ratio: 3 / 4;

    span {
      --color: #{$color-grey};

      font-size: min(var(--font-size), #{1.25 * $font-size});
      color: var(--color);

      #{$self}:not(#{$self}--small) & {
        padding: 0 calc(var(--font-size) / 4);
        border-radius: calc(var(--font-size) / 4);
        background: var(--color);
        color: #ffffff;
      }

      #{$self}--medium & {
        --color: #{$color-light};
      }

      #{$self}--large & {
        --color: #{$color-lighter};
      }
    }
  }

  img {
    display: block;
    min-width: var(--min-size);
    min-height: var(--min-size);
    max-width: var(--max-size);
    max-height: var(--max-size);
  }
}
</style>
