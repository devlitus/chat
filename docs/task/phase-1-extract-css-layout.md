# Phase 1 — Extract CSS from Layout (1230 → ~25 lines)

## Objective
Extract the 1200+ lines of CSS from `Layout.astro` into modular files under `src/styles/`. The final layout should only contain HTML structure + CSS imports.

---

## Task 1.1 — Create `src/styles/tokens.css`
**Responsibility**: CSS variables (design tokens).
**Target lines**: ~15

### Subtasks
- [ ] 1.1.1 Extract `:root` block with all `--color-*` variables (lines 24-34 of Layout.astro)
- [ ] 1.1.2 Add header comment indicating this file contains design tokens
- [ ] 1.1.3 Import in `Layout.astro` via `<style is:inline>` or as global CSS

---

## Task 1.2 — Create `src/styles/reset.css`
**Responsibility**: Global normalization and resets.
**Target lines**: ~40

### Subtasks
- [ ] 1.2.1 Extract `box-sizing` reset (lines 36-38)
- [ ] 1.2.2 Extract `.sr-only` class for accessibility (lines 40-51)
- [ ] 1.2.3 Extract `html, body` styles (lines 53-62)
- [ ] 1.2.4 Extract `::-webkit-scrollbar` styles (lines 64-77)
- [ ] 1.2.5 Extract `::selection` (lines 79-81)
- [ ] 1.2.6 Import in `Layout.astro`

---

## Task 1.3 — Create `src/styles/layout.css`
**Responsibility**: Main layout structure.
**Target lines**: ~15

### Subtasks
- [ ] 1.3.1 Extract `.chat-layout` (lines 87-90)
- [ ] 1.3.2 Extract `.main-area` (lines 92-99)
- [ ] 1.3.3 Import in `Layout.astro`

---

## Task 1.4 — Create `src/styles/sidebar.css`
**Responsibility**: All sidebar CSS (header, search, history, profile).
**Target lines**: ~300

### Subtasks
- [ ] 1.4.1 Extract `.sidebar` (lines 105-113)
- [ ] 1.4.2 Extract `.sidebar-header`, `.brand`, `.brand-icon` (lines 115-148)
- [ ] 1.4.3 Extract `.menu-btn` and hover (lines 150-166)
- [ ] 1.4.4 Extract `.new-chat-wrapper`, `.new-chat-btn` and hover (lines 169-200)
- [ ] 1.4.5 Extract `.search-wrapper`, `.search-label`, `.search-container` and focus (lines 203-259)
- [ ] 1.4.6 Extract `.history-list`, `.history-empty`, `.history-group` (lines 263-294)
- [ ] 1.4.7 Extract `.chat-item`, hover, active, select, icon, content (lines 296-358)
- [ ] 1.4.8 Extract `.chat-delete-btn`, hover, confirming, confirm-yes/no (lines 361-443)
- [ ] 1.4.9 Extract `.user-profile`, `.profile-btn`, `.profile-avatar`, `.profile-info`, `.profile-name`, `.profile-plan`, `.settings-icon` (lines 447-512)
- [ ] 1.4.10 Import in `Layout.astro`

---

## Task 1.5 — Create `src/styles/chat-header.css`
**Responsibility**: Chat header + model selector.
**Target lines**: ~100

### Subtasks
- [ ] 1.5.1 Extract `.chat-header`, `.chat-header-left`, `.chat-header-right` (lines 518-567)
- [ ] 1.5.2 Extract `.badge`, `.star-icon` (lines 553-561)
- [ ] 1.5.3 Extract `.fav-btn`, `.heart-icon`, `.fav-text` + media query (lines 569-604)
- [ ] 1.5.4 Extract `.model-selector`, `.model-btn`, `.model-icon`, `.model-name`, `.model-chevron` (lines 607-652)
- [ ] 1.5.5 Extract `.model-dropdown`, `.model-option`, `.model-option--active` (lines 653-689)
- [ ] 1.5.6 Import in `Layout.astro`

---

## Task 1.6 — Create `src/styles/messages.css`
**Responsibility**: Message area, bubbles, avatars, typing indicator.
**Target lines**: ~200

### Subtasks
- [ ] 1.6.1 Extract `.message-area`, `.spacer`, `.empty-state`, `.empty-icon`, `.messages-container` (lines 694-751)
- [ ] 1.6.2 Extract `.message-user`, `.message-bot` (lines 755-770)
- [ ] 1.6.3 Extract `.user-avatar`, `.bot-avatar` (lines 772-805)
- [ ] 1.6.4 Extract `.msg-content`, `.meta`, `.msg-name`, `.msg-time` (lines 807-834)
- [ ] 1.6.5 Extract `.user-bubble` (lines 836-850)
- [ ] 1.6.6 Extract `.bot-bubble` + paragraphs + code blocks + copy button (lines 852-944)
- [ ] 1.6.7 Extract `.error-bubble` (lines 947-950)
- [ ] 1.6.8 Extract `.typing-indicator` + `@keyframes blink` (lines 952-969)
- [ ] 1.6.9 Extract `@keyframes local-spin` (lines 971-974)
- [ ] 1.6.10 Import in `Layout.astro`

---

## Task 1.7 — Create `src/styles/chat-input.css`
**Responsibility**: Input area, textarea, buttons, suggestion chips.
**Target lines**: ~100

### Subtasks
- [ ] 1.7.1 Extract `.chat-input-area`, `.input-wrapper`, focus-within (lines 980-1007)
- [ ] 1.7.2 Extract `textarea` styles + placeholder (lines 1009-1027)
- [ ] 1.7.3 Extract `.icon-btn`, `.right-buttons`, `.send-btn` + disabled (lines 1029-1086)
- [ ] 1.7.4 Extract `.disclaimer` (lines 1088-1093)
- [ ] 1.7.5 Extract `.chips`, `.chip` + hover (lines 1096-1126)
- [ ] 1.7.6 Import in `Layout.astro`

---

## Task 1.8 — Create `src/styles/attachments.css`
**Responsibility**: Pending file chips and attachment cards.
**Target lines**: ~60

### Subtasks
- [ ] 1.8.1 Extract `.pending-file-chip`, `.pending-file-icon`, `.pending-file-name`, `.pending-file-close` (lines 1132-1178)
- [ ] 1.8.2 Extract `.attachment-card`, `.attachment-icon`, `.attachment-details`, `.attachment-name`, `.attachment-type` (lines 1181-1222)
- [ ] 1.8.3 Extract `.message-user-attachment-container` (lines 1224-1229)
- [ ] 1.8.4 Import in `Layout.astro`

---

## Task 1.9 — Refactor `Layout.astro`
**Responsibility**: Leave only HTML + CSS imports.
**Target lines**: <30

### Subtasks
- [ ] 1.9.1 Remove the entire current `<style is:global>` block
- [ ] 1.9.2 Add global CSS imports (all files from `src/styles/`)
- [ ] 1.9.3 Keep the `<head>` section intact (fonts, meta, title)
- [ ] 1.9.4 Keep `import 'highlight.js/styles/github-dark.css'`
- [ ] 1.9.5 Verify that `<slot />` remains in `<body>`
- [ ] 1.9.6 Run `pnpm build` and confirm no errors

---

## Task 1.10 — Final Verification
### Subtasks
- [ ] 1.10.1 Run `pnpm build` — must pass without errors
- [ ] 1.10.2 Run `pnpm dev` — visually verify the layout hasn't changed
- [ ] 1.10.3 Run `pnpm test` — tests must pass
- [ ] 1.10.4 Confirm no CSS file exceeds 100 lines (sidebar.css may be an exception if justified, ideally split further)
- [ ] 1.10.5 Update `.agents/memory/architecture.md` with the new modular CSS rule
