# Phase 2 — Refactor ChatInput.tsx (315 → multiple <100)

## Objective
Split `ChatInput.tsx` into small UI components, logic hooks, and utilities. Each file must have <100 lines.

---

## Task 2.1 — Create `src/components/react/hooks/useAutoResize.ts`
**Responsibility**: Textarea auto-resize.
**Target lines**: ~20

### Subtasks
- [ ] 2.1.1 Create hook `useAutoResize(textareaRef, text)`
- [ ] 2.1.2 Extract the auto-resize `useEffect` (lines 81-87 of ChatInput.tsx)
- [ ] 2.1.3 Export the hook
- [ ] 2.1.4 Verify it does not exceed 100 lines

---

## Task 2.2 — Create `src/components/react/hooks/useFileUpload.ts`
**Responsibility**: File upload logic (FileReader, base64, API upload).
**Target lines**: ~70

### Subtasks
- [ ] 2.2.1 Create hook `useFileUpload(activeChatId, isStreaming)`
- [ ] 2.2.2 Extract `handleFileChange` (lines 29-78 of ChatInput.tsx)
- [ ] 2.2.3 Include `pendingFile` state inside the hook
- [ ] 2.2.4 Return `{ pendingFile, handleFileChange, clearPendingFile, fileInputRef }`
- [ ] 2.2.5 Verify it does not exceed 100 lines

---

## Task 2.3 — Create `src/components/react/utils/widget-detector.ts`
**Responsibility**: Widget detection by keywords and markers.
**Target lines**: ~60

### Subtasks
- [ ] 2.3.1 Extract `WIDGET_RE` regex (line 18)
- [ ] 2.3.2 Create function `detectWidgetFromModelResponse(content: string): string | undefined`
- [ ] 2.3.3 Extract `uriMap` as an exported constant
- [ ] 2.3.4 Create function `detectWidgetFromKeywords(userMessage: string): string | undefined` (lines 193-222)
- [ ] 2.3.5 Export constants and functions
- [ ] 2.3.6 Verify it does not exceed 100 lines

---

## Task 2.4 — Create `src/components/react/utils/build-history-context.ts`
**Responsibility**: Build spreadsheet context for history.
**Target lines**: ~50

### Subtasks
- [ ] 2.4.1 Create function `buildSpreadsheetContext(allMessages, history): Promise<boolean>`
- [ ] 2.4.2 Extract `latestSpreadsheetMsg` logic + temp file fetch (lines 118-152)
- [ ] 2.4.3 Return `forcedWidgetChart` boolean
- [ ] 2.4.4 Verify it does not exceed 100 lines

---

## Task 2.5 — Create `src/components/react/hooks/useSendMessage.ts`
**Responsibility**: Main message sending logic + streaming + widgets.
**Target lines**: ~90

### Subtasks
- [ ] 2.5.1 Create hook `useSendMessage(activeChatId, selectedModel)`
- [ ] 2.5.2 Extract `sendMessage` function (lines 89-242) — the pure logic part
- [ ] 2.5.3 Separate logic for: save message, generate title, get history, streaming, detect widget, save response
- [ ] 2.5.4 Use utilities from Tasks 2.3 and 2.4
- [ ] 2.5.5 Return `{ sendMessage, isSending }`
- [ ] 2.5.6 Verify it does not exceed 100 lines

---

## Task 2.6 — Create `src/components/react/input/PendingFileChip.tsx`
**Responsibility**: Pending file chip UI.
**Target lines**: ~35

### Subtasks
- [ ] 2.6.1 Create component `PendingFileChip` with props `{ file, onRemove }`
- [ ] 2.6.2 Extract chip JSX (lines 256-270)
- [ ] 2.6.3 Use existing CSS classes (`pending-file-chip`, etc.)
- [ ] 2.6.4 Verify it does not exceed 100 lines

---

## Task 2.7 — Create `src/components/react/input/MessageTextarea.tsx`
**Responsibility**: Textarea with auto-resize and keyboard handler.
**Target lines**: ~40

### Subtasks
- [ ] 2.7.1 Create component `MessageTextarea` with props `{ value, onChange, onKeyDown, disabled }`
- [ ] 2.7.2 Extract textarea JSX (lines 288-296)
- [ ] 2.7.3 Integrate `useAutoResize` hook internally
- [ ] 2.7.4 Verify it does not exceed 100 lines

---

## Task 2.8 — Create `src/components/react/input/SendButton.tsx`
**Responsibility**: Send message button.
**Target lines**: ~25

### Subtasks
- [ ] 2.8.1 Create component `SendButton` with props `{ onClick, disabled }`
- [ ] 2.8.2 Extract send button JSX (lines 301-309)
- [ ] 2.8.3 Verify it does not exceed 100 lines

---

## Task 2.9 — Refactor `ChatInput.tsx`
**Responsibility**: UI orchestrator that uses the created components and hooks.
**Target lines**: <80

### Subtasks
- [ ] 2.9.1 Replace internal logic with hooks: `useAutoResize`, `useFileUpload`, `useSendMessage`
- [ ] 2.9.2 Replace inline JSX with components: `PendingFileChip`, `MessageTextarea`, `SendButton`
- [ ] 2.9.3 Keep only the general input area layout
- [ ] 2.9.4 The attach file and microphone buttons can stay inline or be extracted if needed
- [ ] 2.9.5 Verify it does not exceed 100 lines
- [ ] 2.9.6 Run `pnpm build` and confirm no errors

---

## Task 2.10 — Final Verification
### Subtasks
- [ ] 2.10.1 Run `pnpm build` — must pass without errors
- [ ] 2.10.2 Run `pnpm dev` — verify input works (send messages, upload files, streaming)
- [ ] 2.10.3 Run `pnpm test` — tests must pass
- [ ] 2.10.4 Confirm no new file exceeds 100 lines
- [ ] 2.10.5 Verify widget detection still works (weather, crypto, chart, travel)
