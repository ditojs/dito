<template lang="pug">
//- Swiping would keep the text of errors from being selected and pages from
//- scrolling on touch:
ToastProvider(disableSwipe)
  .dito-notifications
    .dito-header
      span
    .dito-notifications__inner
      ToastRoot.dito-notification(
        v-for="notification in notifications"
        :key="notification.id"
        v-model:open="notification.open"
        :class="`dito-notification--${notification.type}`"
        :type="notification.type === 'error' ? 'foreground' : 'background'"
        :duration="notification.duration"
        @click="notification.open = false"
        @escape-key-down="onEscapeKeyDown"
      )
        //- Clips the notification while its height opens and closes:
        .dito-notification__inner
          ToastTitle.dito-notification__title {{ notification.title }}
          ToastDescription(asChild)
            .dito-notification__content(
              v-html="notification.content"
            )
      //- reka-ui hides its own announcements from screen readers:
      ToastViewport.dito-notifications__viewport(aria-live="polite")
</template>

<script>
import { inject, ref } from 'vue'
import {
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport
} from 'reka-ui'
import { asArray, isString, isHtml, escapeHtml } from '@ditojs/utils'
import { adminContextKey } from '../utils/keys.ts'
import { getText } from '../utils/html.js'

// Detect opening tags of formatted text passed as plain strings:
function isLikelyMarkup(paragraph) {
  return (
    isString(paragraph) &&
    /<[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i.test(paragraph)
  )
}

let notificationId = 0

export default {
  components: {
    ToastDescription,
    ToastProvider,
    ToastRoot,
    ToastTitle,
    ToastViewport
  },

  setup() {
    const adminContext = inject(adminContextKey)
    const notifications = ref([])
    return {
      notifications,

      // Strings in `text` are escaped, only `html` values render as HTML:
      notify({ type = 'info', title, text, error, duration } = {}) {
        title ||= (
          {
            warning: 'Warning',
            error: 'Error',
            info: 'Information',
            success: 'Success'
          }[type] ||
          'Notification'
        )
        // Skip empty paragraphs, like `transientNote` when it's `false`:
        const paragraphs = asArray(text)
          .filter(paragraph => paragraph != null && paragraph !== false)
        if (paragraphs.some(isLikelyMarkup)) {
          console.warn(
            'notify(): `text` is escaped and seems to contain HTML markup. Use ' +
            'the `html` template of @ditojs/utils for formatted text.'
          )
        }
        // Only line breaks of text become `<br>`, not those in HTML markup:
        const content = `<p>${
          paragraphs
            .map(paragraph =>
              isHtml(paragraph)
                ? paragraph.value
                : escapeHtml(paragraph).replace(/\r\n|\r|\n/g, '<br>')
            )
            .join('</p> <p>')
        }</p>`
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
            paragraphs.map(getText).join('\n'),
            ...(type === 'error' && error ? [error] : [])
          ]
        )
        const { notifications: settings = true } = adminContext.api
        if (settings) {
          // `durationFactor` is in milliseconds per character, plus 40 more:
          const { durationFactor = 20 } = settings
          duration ??= (40 + content.length + title.length) * durationFactor
          // Keep closed notifications until the next one, so they can animate:
          notifications.value = [
            ...notifications.value.filter(notification => notification.open),
            {
              id: ++notificationId,
              open: true,
              type,
              title,
              content,
              duration
            }
          ]
        }
      },

      // reka-ui closes toasts on any Escape key, also the ones that close
      // dialogs. Only close them when the focus is in the notifications:
      onEscapeKeyDown(event) {
        if (!event.target.closest('.dito-notifications__viewport')) {
          event.preventDefault()
        }
      },

      destroyAll() {
        for (const notification of notifications.value) {
          notification.open = false
        }
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
  }

  &__viewport {
    position: absolute;
    // The column takes no room, as the sidebar reaches the window edge:
    right: $content-padding;
    top: 0;
    width: $notification-width;
    margin: 0;
    padding: 0;
    list-style: none;
  }
}

.dito-notification {
  // A grid row that closes to no height, so that the notifications below
  // move up smoothly once one leaves:
  display: grid;
  grid-template-rows: 1fr;
  margin: $content-padding 0;
  border-radius: $border-radius;
  box-shadow: $shadow-window;
  cursor: pointer;

  &[data-state='open'] {
    animation: dito-fade-enter 0.3s $ease-out-quart;
  }

  &[data-state='closed'] {
    animation: dito-notification-leave 0.3s $ease-out-quart;
  }

  &__inner {
    min-height: 0;
    overflow: hidden;
  }

  &__title {
    font-weight: bold;
    padding: 8px 8px 0;
  }

  &__content {
    padding: 8px;
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
  &--info {
    @include type($color-active);
  }

  &--success {
    @include type($color-success);
  }

  &--warning {
    @include type($color-warning);
  }

  &--error {
    @include type($color-error);
  }
}

@keyframes dito-notification-leave {
  to {
    grid-template-rows: 0fr;
    margin-block: 0;
    opacity: 0;
  }
}
</style>
