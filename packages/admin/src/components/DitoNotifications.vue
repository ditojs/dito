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
import { inject } from 'vue'
import { notify as showNotification } from '@kyvg/vue3-notification'
import { asArray, isString, escapeHtml, stripHtml } from '@ditojs/utils'
import { adminContextKey } from '../utils/keys.ts'

// Detect opening tags of formatted text passed through the escaped `text`:
function isLikelyMarkup(paragraph) {
  return (
    isString(paragraph) &&
    /<[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i.test(paragraph)
  )
}

export default {
  setup() {
    const adminContext = inject(adminContextKey)
    return {
      // `text` is escaped, `html` is rendered as is: Only pass trusted HTML to
      // it, and escape all values that it includes.
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
        // Skip empty paragraphs, like `transientNote` when it's `false`:
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
        const { notifications = true } = adminContext.api
        if (notifications) {
          // `durationFactor` is in milliseconds per character, plus 40 more:
          const { durationFactor = 20 } = notifications
          duration ??= (40 + content.length + title.length) * durationFactor
          showNotification({
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
        showNotification({ clean: true })
      }
    }
  }
}
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
  box-sizing: border-box;
  margin-left: $form-spacing;

  .dito-header {
    span {
      padding-left: 0;
      padding-right: 0;
    }
  }

  // Only the notifications show above dialogs, not the header:
  &__inner {
    position: relative;
    z-index: $z-index-notifications;
    // For the `@container` rule to work:
    container-type: inline-size;
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
