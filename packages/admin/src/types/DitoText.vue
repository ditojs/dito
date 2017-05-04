<template lang="pug">
  p(:class={ 'control': true })
    input(
      :id="name",
      :class="{ 'input': true, 'is-danger': errors.has(name) }",
      type="text",
      :data-vv-name="name",
      v-model="data[name]",
      v-validate="validations",
      :disabled="disabled",
      :readonly="readonly",
      :placeholder="placeholder"
    )
    span(v-show="errors.has(name)",  class="help is-danger")
      | Errors: {{ errors.collect() }}
</template>

<script>
import DitoComponent from '@/DitoComponent'

export default DitoComponent.register('text')
</script>
