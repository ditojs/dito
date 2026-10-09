<template lang="pug">
.dito-notifications(aria-live="polite")
  .dito-header
    span
  .dito-notifications__inner
    VueNotifications(
      classes="dito-notification"
      :dangerouslySetInnerHtml="true"
      position=""
      width=""
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { asArray, isString, escapeHtml, stripHtml } from '@ditojs/utils'

// Detects opening tags like `<a href="…">` or `<b>`, which callers that still
// pass formatted text through the escaped `text` option would include:
function isLikelyMarkup(paragraph) {
  return (
    isString(paragraph) &&
    /<[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i.test(paragraph)
  )
}

// @vue/component
export default DitoComponent.component('DitoNotifications', {
  methods: {
    // Shows a notification with the paragraphs of `text`, which are escaped,
    // or else of `html`, which is rendered as it is, so it must only contain
    // HTML from trusted sources, and escape all values that it includes.
    notify({ type = 'info', title, text, html, error, duration } = {}) {
      title ||= (
        {
          warning: 'Warning',
          error: 'Error',
          info: 'Information',
          success: 'Success'
        }[type] ||
        'Notification'
      )
      const isHtml = html != null
      // Skip empty paragraphs, e.g. `transientNote` when it's `false`:
      const paragraphs = asArray(isHtml ? html : text).filter(
        paragraph => paragraph != null && paragraph !== false
      )
      if (!isHtml && paragraphs.some(isLikelyMarkup)) {
        console.warn(
          'notify(): `text` is escaped and seems to contain HTML markup. Use ' +
          'the `html` option for formatted text, and escape all values that ' +
          'it includes.'
        )
      }
      const htmlParagraphs = isHtml
        ? paragraphs
        : paragraphs.map(paragraph => escapeHtml(paragraph))
      const content = `<p>${
        htmlParagraphs.join('</p> <p>')
      }</p>`.replace(/\n|\r\n|\r/g, '<br>')
      const log = (
        {
          warning: 'warn',
          error: 'error',
          info: 'log',
          success: 'log'
        }[type] ||
        'error'
      )
      // eslint-disable-next-line no-console
      console[log](
        ...[
          isHtml ? stripHtml(content) : paragraphs.join('\n'),
          ...(type === 'error' && error ? [error] : [])
        ]
      )
      const { notifications = true } = this.api
      if (notifications) {
        // Calculate display-duration for the notification based on its content
        // and the setting of the `durationFactor` configuration. It defines the
        // amount of milliseconds multiplied with the amount of characters
        // displayed in the notification, plus 40 (40 + title + message):
        const { durationFactor = 20 } = notifications
        duration ??= (40 + content.length + title.length) * durationFactor
        this.$notify({
          type,
          title: escapeHtml(title),
          text: content,
          duration: duration === 0 ? -1 : duration // < 0 -> <= 0 = sticky
        })
      }
    },

    destroyAll() {
      // `VueNotifications` doesn't expose methods, but closes all its
      // notifications when notified with `clean`:
      this.$notify({ clean: true })
    }
  }
})
</script>

<style lang="scss">
@use 'sass:color';
@import '../styles/_imports';

@mixin type($background) {
  background: color.adjust($background, $lightness: 5%);
  color: $color-white;
  border-left: 12px solid color.adjust($background, $lightness: -10%);
}

.dito-notifications {
  $notification-width: 300px;

  flex: 1;
  z-index: $z-index-notifications;
  box-sizing: border-box;
  margin-left: $form-spacing;
  // For the `@container` rule to work:
  container-type: inline-size;

  .dito-header {
    span {
      padding-left: 0;
      padding-right: 0;
    }
  }

  &__inner {
    position: relative;
  }

  .vue-notification-group {
    position: absolute;
    left: 0;
    top: 0;
    width: $notification-width;

    @container (width < #{$notification-width + $content-padding}) {
      left: unset;
      right: $content-padding;
    }
  }

  .vue-notification-wrapper {
    overflow: visible;
  }

  .dito-notification {
    padding: 8px;
    margin: $content-padding 0;
    font-size: inherit;
    color: $color-white;
    border-radius: $border-radius;
    box-shadow: $shadow-window;

    .notification-title {
      font-weight: bold;
      padding-bottom: 8px;
    }

    .notification-content {
      overflow: hidden;
      word-break: break-all;

      p {
        margin: 0;

        & + p {
          margin-top: 8px;
        }
      }
    }

    &,
    &.info {
      @include type($color-active);
    }

    &.success {
      @include type($color-success);
    }

    &.warning {
      @include type($color-warning);
    }

    &.error {
      @include type($color-error);
    }
  }
}
</style>
