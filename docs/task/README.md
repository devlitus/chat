# Codebase Refactor — Master Index

## Overview
Complete refactor of the Chat AI project (Astro 5 + React) applying Clean Code, SOLID, and the **maximum 100 lines per file** rule.

## Current State
- **Total lines**: 5271
- **Files >100 lines**: 12
- **Largest file**: `Layout.astro` (1230 lines)

## Final Goal
- **All files <100 lines**
- **Modular CSS** in `src/styles/`
- **Atomic components** following Atomic Design
- **Hooks separated** from UI
- **API endpoints** as thin controllers

---

## Phases (execute in order)

| Phase | File | Tasks | Impact | Risk |
|-------|------|-------|--------|------|
| **1** | [Extract CSS from Layout](./phase-1-extract-css-layout.md) | 10 tasks, 38 subtasks | High | Low |
| **2** | [Refactor ChatInput](./phase-2-refactor-chat-input.md) | 10 tasks, 35 subtasks | High | Medium |
| **3** | [Refactor MessageBubble](./phase-3-refactor-message-bubble.md) | 10 tasks, 38 subtasks | High | Medium |
| **4** | [Refactor MCP Apps](./phase-4-refactor-mcp-apps.md) | 6 tasks, 30 subtasks | Medium | Medium |
| **5** | [Refactor lib/](./phase-5-refactor-lib.md) | 6 tasks, 25 subtasks | Medium | Low |
| **6** | [Refactor API Endpoints](./phase-6-refactor-api-endpoints.md) | 6 tasks, 20 subtasks | Low | Low |

## Phase Dependencies

```
Phase 1 (CSS) ──────────────────────────────────────────┐
Phase 2 (ChatInput) ──→ Phase 3 (MessageBubble) ──→ Phase 4 (MCP Apps)
Phase 5 (lib/) ──────────────────────────────────────────┤
Phase 6 (API) ───────────────────────────────────────────┘
                                                         ↓
                                               Global Final Verification
```

- **Phase 1** is independent and can be executed first
- **Phase 2 and 3** have dependencies with **Phase 5** (lib/) due to imports
- **Phase 4** depends on **Phase 3** (widgets extracted from MessageBubble)
- **Phase 6** is last and depends on everything above

## Unbreakable Rules
1. **No file may exceed 100 lines**
2. **Each phase must pass `pnpm build` before continuing**
3. **Do not break existing functionality**
4. **Maintain import compatibility during transition**
5. **Update project memory after each completed phase**

## Verification Commands (run after each phase)
```bash
pnpm build        # Production build
pnpm test         # Unit tests
pnpm dev          # Manual visual verification
```
