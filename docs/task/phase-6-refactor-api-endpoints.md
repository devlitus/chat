# Phase 6 — Refactor API Endpoints

## Objective
Extract business logic from API endpoints into `src/lib/`. Endpoints should be thin controllers (<100 lines each).

---

## Task 6.1 — Refactor `src/pages/api/chat.ts` (106 lines)

### Subtasks
- [ ] 6.1.1 Analyze current endpoint logic
- [ ] 6.1.2 Extract streaming logic to `src/lib/api/stream-chat-handler.ts`
- [ ] 6.1.3 Extract request validation to `src/lib/api/validate-chat-request.ts`
- [ ] 6.1.4 Leave `chat.ts` as a thin controller (<50 lines)
- [ ] 6.1.5 Verify no file exceeds 100 lines

---

## Task 6.2 — Refactor `src/pages/api/mcp.ts` (150 lines)

### Subtasks
- [ ] 6.2.1 Analyze current MCP endpoint logic
- [ ] 6.2.2 Extract MCP tool handlers to `src/lib/mcp/tools/`
  - [ ] 6.2.2.1 `src/lib/mcp/tools/weather.ts`
  - [ ] 6.2.2.2 `src/lib/mcp/tools/crypto.ts`
  - [ ] 6.2.2.3 `src/lib/mcp/tools/chart.ts`
  - [ ] 6.2.2.4 `src/lib/mcp/tools/travel.ts`
  - [ ] 6.2.2.5 `src/lib/mcp/tools/time.ts`
- [ ] 6.2.3 Extract postMessage logic to `src/lib/mcp/iframe-bridge.ts`
- [ ] 6.2.4 Leave `mcp.ts` as a thin controller (<60 lines)
- [ ] 6.2.5 Verify no file exceeds 100 lines

---

## Task 6.3 — Verify `src/pages/api/upload.ts` (53 lines)

### Subtasks
- [ ] 6.3.1 Review if refactor is needed (53 < 100, likely OK)
- [ ] 6.3.2 If there is extractable logic, move to `src/lib/api/file-upload.ts`
- [ ] 6.3.3 Confirm it is within the limit

---

## Task 6.4 — Verify `src/pages/api/models.ts` (28 lines)

### Subtasks
- [ ] 6.4.1 Review if refactor is needed (28 < 100, OK)
- [ ] 6.4.2 Confirm it is within the limit

---

## Task 6.5 — Verify `src/pages/api/read-temp.ts` (26 lines)

### Subtasks
- [ ] 6.5.1 Review if refactor is needed (26 < 100, OK)
- [ ] 6.5.2 Confirm it is within the limit

---

## Task 6.6 — Final Verification
### Subtasks
- [ ] 6.6.1 Run `pnpm build` — must pass without errors
- [ ] 6.6.2 Run `pnpm dev` — verify that:
  - AI chat works (streaming)
  - MCP widgets respond correctly
  - File upload works
  - Models endpoint returns data
- [ ] 6.6.3 Run `pnpm test` — API tests must pass
- [ ] 6.6.4 Confirm no file exceeds 100 lines
- [ ] 6.6.5 Verify coverage tests haven't dropped significantly
