# Phase 3 — Refactor MessageBubble.tsx (262 → multiple <100)

## Objective
Split `MessageBubble.tsx` into presentation components, MCP hooks, and utilities. Each file must have <100 lines.

---

## Task 3.1 — Create `src/components/react/messages/MessageAvatar.tsx`
**Responsibility**: User or bot avatar.
**Target lines**: ~25

### Subtasks
- [ ] 3.1.1 Create component `MessageAvatar` with props `{ role: 'user' | 'assistant' }`
- [ ] 3.1.2 Extract avatar JSX (lines 182-184 for user, 215-217 for bot)
- [ ] 3.1.3 Use existing CSS classes (`avatar`, `user-avatar`, `bot-avatar`)
- [ ] 3.1.4 Verify it does not exceed 100 lines

---

## Task 3.2 — Create `src/components/react/messages/MessageMeta.tsx`
**Responsibility**: Message name and timestamp.
**Target lines**: ~20

### Subtasks
- [ ] 3.2.1 Create component `MessageMeta` with props `{ name, time }`
- [ ] 3.2.2 Extract `formatTime` function (lines 12-14)
- [ ] 3.2.3 Extract meta block JSX (lines 186-189 and 219-222)
- [ ] 3.2.4 Verify it does not exceed 100 lines

---

## Task 3.3 — Create `src/components/react/messages/AttachmentCard.tsx`
**Responsibility**: Attachment card in user messages.
**Target lines**: ~40

### Subtasks
- [ ] 3.3.1 Create component `AttachmentCard` with props `{ name, type }`
- [ ] 3.3.2 Extract attachment card JSX (lines 192-200)
- [ ] 3.3.3 Extract icon selection logic based on type
- [ ] 3.3.4 Verify it does not exceed 100 lines

---

## Task 3.4 — Create `src/components/react/utils/parse-file-message.ts`
**Responsibility**: Parse user messages with file attachments.
**Target lines**: ~30

### Subtasks
- [ ] 3.4.1 Create function `parseFileMessage(content: string): { displayContent: string, attachmentData: {...} | null }`
- [ ] 3.4.2 Extract regex and parsing logic (lines 167-178)
- [ ] 3.4.3 Export type `ParsedFileMessage`
- [ ] 3.4.4 Verify it does not exceed 100 lines

---

## Task 3.5 — Create `src/components/react/messages/UserMessage.tsx`
**Responsibility**: Render complete user message.
**Target lines**: ~60

### Subtasks
- [ ] 3.5.1 Create component `UserMessage` with props `{ message }`
- [ ] 3.5.2 Use `parseFileMessage` to extract content and attachment
- [ ] 3.5.3 Compose with `MessageAvatar`, `MessageMeta`, `AttachmentCard`
- [ ] 3.5.4 Extract user block JSX (lines 180-210)
- [ ] 3.5.5 Verify it does not exceed 100 lines

---

## Task 3.6 — Create `src/components/react/widgets/useMcpTools.ts`
**Responsibility**: MCP tool handlers for iframes.
**Target lines**: ~90

### Subtasks
- [ ] 3.6.1 Create hook `useMcpTools(iframeRef, message)`
- [ ] 3.6.2 Extract `buildHandler` and its tool handlers (lines 54-141)
- [ ] 3.6.3 Separate each tool handler into internal functions:
  - `handleGetTime()`
  - `handleGetLocation()`
  - `handleGetCryptoPrice()`
  - `handleGetChartData()`
- [ ] 3.6.4 Keep the `useEffect` with iframe load registration
- [ ] 3.6.5 Verify it does not exceed 100 lines

---

## Task 3.7 — Create `src/components/react/widgets/WidgetFrame.tsx`
**Responsibility**: Iframe wrapper for MCP widgets.
**Target lines**: ~50

### Subtasks
- [ ] 3.7.1 Create component `WidgetFrame` with props `{ uiResourceUri, message }`
- [ ] 3.7.2 Extract `ALLOWED_UI_PATHS` logic and path mapping (lines 225-227)
- [ ] 3.7.3 Extract dimension logic per widget type (lines 235-236)
- [ ] 3.7.4 Extract iframe title logic (lines 230-234)
- [ ] 3.7.5 Use `useMcpTools` hook internally
- [ ] 3.7.6 Verify it does not exceed 100 lines

---

## Task 3.8 — Create `src/components/react/messages/BotMessage.tsx`
**Responsibility**: Render bot message (markdown or widget).
**Target lines**: ~60

### Subtasks
- [ ] 3.8.1 Create component `BotMessage` with props `{ message }`
- [ ] 3.8.2 Extract `renderedHtml` with `useMemo` (lines 20-25)
- [ ] 3.8.3 Extract `handleCopy` callback (lines 29-40)
- [ ] 3.8.4 Compose with `MessageAvatar`, `MessageMeta`, `WidgetFrame`
- [ ] 3.8.5 Extract bot block JSX (lines 213-260)
- [ ] 3.8.6 Verify it does not exceed 100 lines

---

## Task 3.9 — Refactor `MessageBubble.tsx`
**Responsibility**: Dispatcher that chooses between UserMessage and BotMessage.
**Target lines**: <30

### Subtasks
- [ ] 3.9.1 Replace all JSX with `UserMessage` and `BotMessage` components
- [ ] 3.9.2 Keep only dispatch logic: `if (message.role === 'user')`
- [ ] 3.9.3 Remove all extracted internal logic
- [ ] 3.9.4 Verify it does not exceed 100 lines
- [ ] 3.9.5 Run `pnpm build` and confirm no errors

---

## Task 3.10 — Final Verification
### Subtasks
- [ ] 3.10.1 Run `pnpm build` — must pass without errors
- [ ] 3.10.2 Run `pnpm dev` — verify messages render correctly
- [ ] 3.10.3 Verify MCP widgets (weather, crypto, chart, travel) work inside messages
- [ ] 3.10.4 Verify code copy button works
- [ ] 3.10.5 Verify attachments display correctly
- [ ] 3.10.6 Run `pnpm test` — tests must pass
- [ ] 3.10.7 Confirm no new file exceeds 100 lines
