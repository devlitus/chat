# Phase 5 — Refactor lib/ (separate responsibilities)

## Objective
Split monolithic files in `src/lib/` into responsibility-based modules. Each file must have <100 lines.

---

## Task 5.1 — Refactor db.ts (219 lines → split by entity)

### Subtask 5.1.1 — Create `src/lib/db/db-types.ts`
**Responsibility**: Database interfaces and types.
**Target lines**: ~30

- [ ] 5.1.1.1 Extract interfaces `Chat`, `Message`, `DBChat`, `DBMessage`
- [ ] 5.1.1.2 Extract exported types
- [ ] 5.1.1.3 Verify it does not exceed 100 lines

### Subtask 5.1.2 — Create `src/lib/db/db-messages.ts`
**Responsibility**: Message CRUD operations.
**Target lines**: ~50

- [ ] 5.1.2.1 Extract `addMessage()`
- [ ] 5.1.2.2 Extract `getMessagesByChatId()`
- [ ] 5.1.2.3 Extract `deleteMessagesByChatId()`
- [ ] 5.1.2.4 Verify it does not exceed 100 lines

### Subtask 5.1.3 — Create `src/lib/db/db-chats.ts`
**Responsibility**: Chat CRUD operations.
**Target lines**: ~50

- [ ] 5.1.3.1 Extract `getChat()`
- [ ] 5.1.3.2 Extract `getAllChats()`
- [ ] 5.1.3.3 Extract `updateChat()`
- [ ] 5.1.3.4 Extract `deleteChat()`
- [ ] 5.1.3.5 Verify it does not exceed 100 lines

### Subtask 5.1.4 — Refactor `src/lib/db/db.ts`
**Responsibility**: DB initialization + re-exports.
**Target lines**: <30

- [ ] 5.1.4.1 Keep only database initialization
- [ ] 5.1.4.2 Re-export functions from `db-chats.ts` and `db-messages.ts`
- [ ] 5.1.4.3 Verify compatibility with existing imports
- [ ] 5.1.4.4 Verify it does not exceed 100 lines

---

## Task 5.2 — Refactor chat-actions.ts (129 lines → split)

### Subtask 5.2.1 — Create `src/lib/stores/actions-messages.ts`
**Responsibility**: Store actions related to messages.
**Target lines**: ~50

- [ ] 5.2.1.1 Extract `addUserMessage()`
- [ ] 5.2.1.2 Extract message manipulation actions
- [ ] 5.2.1.3 Verify it does not exceed 100 lines

### Subtask 5.2.2 — Create `src/lib/stores/actions-streaming.ts`
**Responsibility**: Store actions related to streaming.
**Target lines**: ~50

- [ ] 5.2.2.1 Extract `startStreaming()`
- [ ] 5.2.2.2 Extract `updateStreaming()`
- [ ] 5.2.2.3 Extract `finishStreaming()`
- [ ] 5.2.2.4 Extract `setBotError()`
- [ ] 5.2.2.5 Verify it does not exceed 100 lines

### Subtask 5.2.3 — Refactor `src/lib/stores/chat-actions.ts`
**Responsibility**: Action re-exports.
**Target lines**: <20

- [ ] 5.2.3.1 Re-export all actions from the new modules
- [ ] 5.2.3.2 Maintain compatibility with existing imports
- [ ] 5.2.3.3 Verify it does not exceed 100 lines

---

## Task 5.3 — Create `src/lib/api/widget-uri-map.ts`
**Responsibility**: Widget-to-URI mapping.
**Target lines**: ~20

### Subtasks
- [ ] 5.3.1 Extract `uriMap` from ChatInput (lines 178-184)
- [ ] 5.3.2 Export as a typed constant
- [ ] 5.3.3 Verify it does not exceed 100 lines

---

## Task 5.4 — Create `src/lib/api/allowed-ui-paths.ts`
**Responsibility**: List of allowed UI paths for iframes.
**Target lines**: ~15

### Subtasks
- [ ] 5.4.1 Extract `ALLOWED_UI_PATHS` from MessageBubble (line 225)
- [ ] 5.4.2 Export as constant + function `isAllowedUiPath(path: string): boolean`
- [ ] 5.4.3 Verify it does not exceed 100 lines

---

## Task 5.5 — Create `src/lib/config/constants.ts`
**Responsibility**: Project-wide constants.
**Target lines**: ~30

### Subtasks
- [ ] 5.5.1 Move `WIDGET_RE` regex here (from utils/widget-detector.ts)
- [ ] 5.5.2 Add configuration constants (max messages, timeouts, etc.)
- [ ] 5.5.3 Verify it does not exceed 100 lines

---

## Task 5.6 — Final Verification
### Subtasks
- [ ] 5.6.1 Run `pnpm build` — must pass without errors
- [ ] 5.6.2 Verify all old imports still work (compatibility)
- [ ] 5.6.3 Run `pnpm test` — db.ts tests must pass
- [ ] 5.6.4 Confirm no new file exceeds 100 lines
- [ ] 5.6.5 Verify chat functionality (send, receive, history) is not broken
