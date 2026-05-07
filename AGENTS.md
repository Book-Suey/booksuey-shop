# Development philosophy

- Prefer simple solutions over clever ones.
- Write code that is clear and self-explanatory.
- Build with the long term in mind.

# Stack

- **Framework**: Nuxt 4 (Vue.js)
- **Styling**: NuxtUI (with Tailwind CSS)
- **Database**: MongoDB Atlas
- **Authentication**: JWT with bcrypt
- **Testing**: Vitest (unit/integration), Playwright (e2e)
- **Test Database**: mongodb-memory-server
- **API Mocking**: MSW (Mock Service Worker)
- **Email Handling**: Mailgun
- **Payment Processing**: PayPal (and Venmo through PayPal API)

# Conventions

- Always use the Composition API with `<script setup>`. Never use the Options API.
- Use `useFetch` or `useAsyncData` for data fetching. Never use raw `fetch` or `$fetch` directly in components for initial data loads.
- Use Nuxt's server routes (`server/api/`) for backend logic. Never write API logic in client-side code.
- Use Nuxt's auto-imports for composables, components, and utils. Never manually import what Nuxt auto-imports.
- Use Pinia for shared state that isn't tied to a single page's data. Never use hand-rolled global state.
- Use file-based routing. Never define routes manually in a config file unless you need to override behaviour.
- Use `definePageMeta` for page-level middleware and layout assignments. Never set these outside the page component.
- Use `NuxtLink` for internal navigation. Never use raw `<a>` tags or `navigateTo` for simple links.
- Use `useState()` for shared SSR-safe reactive state. Never use `ref()` at module scope outside `<script setup>` — it leaks state across server requests.
- Use `createError()` for error responses. Use `throw createError()` on the server and `createError({ fatal: true })` on the client for full-page errors.
- Use route middleware for navigation guards. Never use `useRoute()` inside middleware — use the `to`/`from` params instead.

# Verification

After making changes, always run the following checks and fix any issues before considering work complete:

1. **Build**: `pnpm nuxi build`
2. **Lint**: `pnpm lint:fix` (ESLint)
3. **Type check**: `pnpm nuxi typecheck`
4. **Unit Tests**: `pnpm test:unit` (Vitest)
5. **Integration Tests**: `pnpm test:integration` (Vitest with mongodb-memory-server)
6. **E2E Tests**: `pnpm test:e2e` (Playwright)
7. **Coverage**: `pnpm test:coverage` (Vitest with V8 coverage)
