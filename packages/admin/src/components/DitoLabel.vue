<template lang="pug">
//- With buttons, only the chevron and the text toggle:
component.dito-label(
  v-if="hasContent || collapsible"
  :is="collapsible && !hasButtons ? 'button' : 'div'"
  :class="{ 'dito-label--required': required }"
  v-bind="hasButtons ? null : toggleAttributes"
)
  //- The chevron and the text, which the focus ring of toggles encloses:
  component.dito-label__content(
    :is="collapsible && hasButtons ? 'button' : 'div'"
    v-bind="hasButtons ? toggleAttributes : null"
  )
    .dito-chevron(
      v-if="collapsible"
      :class=`{
        'dito-chevron--open': !collapsed,
        'dito-chevron--double': togglesAll
      }`
    )
    .dito-label__inner(
      v-if="hasContent || prefixes.length > 0 || suffixes.length > 0"
    )
      DitoAffixes(
        :items="prefixes"
        position="prefix"
        :parentContext="context"
      )
      label(
        v-if="hasContent"
        :for="htmlFor"
        v-html="html"
      )
      DitoAffixes(
        :items="suffixes"
        mode="ellipsis"
        position="suffix"
        :parentContext="context"
      )
      DitoInfo(
        v-if="info"
        :info="info"
      )
  //- Type components teleport their buttons here, see `DitoLabelButtons`:
  .dito-label__buttons(
    v-if="hasButtons"
  )
</template>

<script>
import { computed } from 'vue'
import { asArray } from '@ditojs/utils'
import DitoAffixes from './DitoAffixes.vue'
import DitoInfo from './DitoInfo.vue'
import { getHtml } from '../utils/html.js'

export default {
  components: { DitoAffixes, DitoInfo },
  emits: ['toggle'],

  props: {
    // Text or `html`, or `{ text, prefix, suffix }`:
    label: { type: [String, Object], default: null },
    // For the callbacks of the affixes:
    context: { type: Object, required: true },
    htmlFor: { type: String, default: null },
    collapsed: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    // Draw a double chevron, for toggles of all items:
    togglesAll: { type: Boolean, default: false },
    // The title and accessible name of the toggle, if not the label:
    title: { type: String, default: null },
    info: { type: [String, Object], default: null },
    // Mark the label of a value that is required:
    required: { type: Boolean, default: false },
    hasButtons: { type: Boolean, default: false }
  },

  setup(props, { emit }) {
    const html = computed(() => getHtml(props.label))
    return {
      html,
      hasContent: computed(() => !!html.value),
      prefixes: computed(() => asArray(props.label?.prefix)),
      suffixes: computed(() => asArray(props.label?.suffix)),
      toggleAttributes: computed(() =>
        props.collapsible
          ? {
              'type': 'button',
              'title': props.title,
              'aria-label': props.title,
              'aria-expanded': !props.collapsed,
              'onClick': () => emit('toggle', !props.collapsed)
            }
          : null
      )
    }
  }
}
</script>

<style lang="scss">
@import '../styles/_imports';

.dito-label {
  $self: &;

  // For buttons and chevron to align right:
  display: flex;
  position: relative;
  // Vertically center all items in the label, e.g. chevron, edit-buttons.
  align-items: center;
  // Let nested labels with ellipsis shrink below their content width.
  min-width: 0;
  min-height: $input-height;
  margin-right: $form-spacing-half; // When inlined.

  &:not(:has(+ .dito-tabs)) {
    // Take full width but only if there aren't also tabs to be centered.
    flex: 1;
  }

  &__content {
    display: contents;
  }

  &__inner {
    flex: 1 0 0%;
    display: flex;
    align-items: center;
    overflow: hidden;
    gap: $input-padding-hor;
  }

  label {
    @include ellipsis;

    cursor: inherit;
    font-weight: bold;
    line-height: $input-height;
  }

  // Fix alignment of sub and sup elements in label content.
  sub,
  sup {
    display: inline-block;
    vertical-align: baseline;
  }

  sub {
    transform: translateY(4px);
  }

  sup {
    transform: translateY(-4px);
  }

  &--required label::after {
    content: '*';
    margin-left: 0.15em;
  }

  &--fill {
    width: 100%;
    // Size only by the container, so that long text is clipped with an
    // ellipsis instead of widening the layout, e.g. the tables of lists:
    contain: inline-size;
  }

  .dito-info {
    margin-left: 0.35em;
  }

  &__buttons {
    display: flex;
    margin-left: auto;
  }

  // Keep the round buttons at the end of the label apart from the component,
  // like the buttons in the headers of forms:
  &:has(> #{$self}__buttons > .dito-label-buttons:not(:empty)) {
    margin-bottom: $form-spacing-half;
  }

  @at-root button#{&},
    button#{&}__content {
    border: 0;
    padding: 0;
    background: none;
    text-align: start;

    &:hover {
      .dito-chevron {
        color: $color-darker;
      }
    }

    &:focus-visible {
      outline: none;
    }
  }

  // The label or its content toggles, but the focus ring only encloses the
  // content, padded for it:
  @at-root button#{&} > #{&}__content,
    button#{&}__content {
    display: flex;
    align-items: center;
    position: relative;
    min-width: 0;
    padding: 0 $focus-ring-padding;
    margin-left: -$focus-ring-padding;

    > #{$self}__inner {
      flex: 0 1 auto;
    }

    // Inset toggles of all items like the chevrons of the items:
    &:has(> .dito-chevron--double) {
      margin-left: $form-spacing + $border-width - $focus-ring-padding;
    }

    // Suffixes with ellipsis have no width of their own, so the content
    // fills the row for them to clip their text in:
    &:has(> #{$self}__inner > .dito-affixes--ellipsis) {
      flex: 1;

      > #{$self}__inner {
        flex: 1 0 0%;
      }
    }
  }

  @at-root button#{&}:focus-visible > #{&}__content,
    button#{&}__content:focus-visible {
    @include focus-ring-line;
  }
}
</style>
