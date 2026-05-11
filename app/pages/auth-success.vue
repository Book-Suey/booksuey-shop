<script setup lang="ts">
definePageMeta({
  middleware: 'guest-only'
})

const route = useRoute()

const timer = ref<ReturnType<typeof setTimeout> | null>(null)
const isExiting = ref(false)

const isPreviewMode = computed(() => {
  const preview = route.query.preview

  if (Array.isArray(preview)) {
    return preview.some(
      value =>
        typeof value === 'string'
        && !['0', 'false', 'no', 'off'].includes(value.toLowerCase())
    )
  }

  if (typeof preview === 'string') {
    return !['0', 'false', 'no', 'off'].includes(preview.toLowerCase())
  }

  // Treat presence-only query params like ?preview as enabled.
  return preview !== undefined
})

onMounted(() => {
  if (isPreviewMode.value) {
    return
  }

  timer.value = setTimeout(() => {
    isExiting.value = true

    timer.value = setTimeout(() => {
      void navigateTo('/login')
    }, 420)
  }, 1650)
})

onBeforeUnmount(() => {
  if (timer.value) {
    clearTimeout(timer.value)
  }
})
</script>

<template>
  <section
    class="success-transition-page"
    :class="{
      'success-transition-page--preview': isPreviewMode,
      'success-transition-page--exiting': isExiting
    }"
  >
    <div class="success-check">
      <svg
        class="success-check__svg"
        viewBox="0 0 120 120"
        role="img"
        aria-label="Success checkmark"
      >
        <circle
          class="success-check__ring"
          cx="60"
          cy="60"
          r="48"
        />
        <path
          class="success-check__mark"
          d="M34 62 L53 81 L87 45"
        />
      </svg>

      <span class="success-check__glow success-check__glow--one" />
      <span class="success-check__glow success-check__glow--two" />
    </div>

    <div class="success-transition-page__content">
      <h1 class="success-transition-page__title">
        Success
      </h1>
      <p class="success-transition-page__copy">
        {{
          isPreviewMode
            ? "Preview mode: looping checkmark animation."
            : "Redirecting you to sign in..."
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.success-transition-page {
  min-height: calc(100vh - 5rem);
  display: grid;
  place-items: center;
  gap: 1.25rem;
  text-align: center;
  padding: 1.5rem;
  background:
    radial-gradient(circle at 20% 20%, #fff3c2 0%, transparent 42%),
    radial-gradient(circle at 80% 30%, #b6fddf 0%, transparent 38%),
    linear-gradient(135deg, #f7fffb 0%, #e4fff2 42%, #fdf2d1 100%);
  transition:
    opacity 0.42s ease,
    transform 0.42s ease;
}

.success-transition-page--exiting {
  opacity: 0;
  transform: translateY(0.45rem);
}

.success-check {
  position: relative;
  width: min(13rem, 52vw);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.success-check__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.success-check__ring {
  fill: rgb(41 191 95 / 14%);
  stroke: #2a8d4d;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 302;
  stroke-dashoffset: 302;
  animation: draw-ring 1.2s ease-out infinite;
}

.success-check__mark {
  fill: none;
  stroke: #20a94f;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 76;
  stroke-dashoffset: 76;
  animation: draw-check 1.2s 0.2s ease-out infinite;
}

.success-check__glow {
  position: absolute;
  inset: -9%;
  border-radius: 999px;
  pointer-events: none;
  background: radial-gradient(
    circle,
    rgb(72 214 121 / 40%) 0%,
    transparent 65%
  );
}

.success-check__glow--one {
  animation: pulse-glow 1.2s ease-in-out infinite;
}

.success-check__glow--two {
  inset: -20%;
  opacity: 0.45;
  animation: pulse-glow 1.2s 0.2s ease-in-out infinite;
}

.success-transition-page__content {
  border: 2px solid #1f3a30;
  box-shadow: 0.35rem 0.35rem 0 #1f3a30;
  background: #fffef6;
  padding: 1rem 1.1rem;
  width: min(34rem, 100%);
}

.success-transition-page__kicker {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #2f4a3d;
}

.success-transition-page__title {
  margin-top: 0.3rem;
  font-size: clamp(1.5rem, 4vw, 2.1rem);
  font-weight: 800;
  text-transform: uppercase;
}

.success-transition-page__copy {
  margin-top: 0.45rem;
  color: #304d3f;
}

@keyframes draw-ring {
  0% {
    stroke-dashoffset: 302;
    opacity: 0.55;
  }

  40% {
    stroke-dashoffset: 0;
    opacity: 1;
  }

  100% {
    stroke-dashoffset: 0;
    opacity: 0.65;
  }
}

@keyframes draw-check {
  0%,
  20% {
    stroke-dashoffset: 76;
    opacity: 0;
  }

  55% {
    stroke-dashoffset: 0;
    opacity: 1;
  }

  100% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.3;
  }

  50% {
    transform: scale(1);
    opacity: 0.65;
  }
}
</style>
