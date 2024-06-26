<template lang="pug">
.dito-notifications
  .dito-header
    span
  .dito-notifications__inner
    VueNotifications(
      ref="notifications"
      classes="dito-notification"
      :dangerouslySetInnerHtml="true"
      position=""
      width=""
    )
</template>

<script>
import DitoComponent from '../DitoComponent.js'
import { asArray, stripTags } from '@ditojs/utils'

// @vue/component
export default DitoComponent.component('DitoNotifications', {
  notifications() {
    return this.isMounted && this.$refs.notifications
  },

  methods: {
    notify({ type = 'info', title, text, error } = {}) {
      title ||= (
        {
          warning: 'Warning',
          error: 'Error',
          info: 'Information',
          success: 'Success'
        }[type] ||
        'Notification'
      )
      text = `<p>${
        asArray(text).join('</p> <p>')
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
          stripTags(text),
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
        const duration = (40 + text.length + title.length) * durationFactor
        this.$notify({ type, title, text, duration })
      }
    },

    destroyAll() {
      this.notifications.destroyAll()
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
