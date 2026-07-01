<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApiV3Event } from '../api/types'

const props = withDefaults(
  defineProps<{ events: ApiV3Event[]; placeholder?: string; modelValue?: string }>(),
  { placeholder: 'Event code or name…', modelValue: '' },
)
const emit = defineEmits<{ (e: 'select', code: string): void; (e: 'update:modelValue', v: string): void }>()

const query = ref(props.modelValue)
const open = ref(false)
const activeIdx = ref(-1)

const hits = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return props.events.filter((e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)).slice(0, 12)
})

function choose(code: string): void {
  query.value = code
  emit('update:modelValue', code)
  open.value = false
  emit('select', code)
}

function onInput(): void {
  emit('update:modelValue', query.value)
  activeIdx.value = -1
  open.value = true
}

function onBlur(): void {
  setTimeout(() => {
    open.value = false
  }, 150)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, hits.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, -1)
  } else if (e.key === 'Enter') {
    if (activeIdx.value >= 0 && hits.value[activeIdx.value]) {
      choose(hits.value[activeIdx.value].code)
    } else if (query.value.trim()) {
      choose(query.value.trim().toUpperCase())
    }
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="typeahead-wrap">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
      @focus="open = true"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <div v-if="open && hits.length" class="typeahead-dropdown">
      <div
        v-for="(e, idx) in hits"
        :key="e.code"
        class="typeahead-item"
        :class="{ active: idx === activeIdx }"
        @mousedown.prevent="choose(e.code)"
      >
        <span class="typeahead-key">{{ e.code }}</span>
        <span class="typeahead-name">{{ e.name }}</span>
      </div>
    </div>
  </div>
</template>
