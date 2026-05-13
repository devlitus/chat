# Phase 4 — Refactor MCP Apps (200+ → <100 each)

## Objective
Split each monolithic MCP app (WeatherApp, CryptoApp, ChartApp, TravelApp) into UI component + data hook + display subcomponent. Each file must have <100 lines.

---

## Task 4.1 — Refactor WeatherApp.tsx (217 lines)

### Subtask 4.1.1 — Create `src/components/mcp/weather/useWeatherData.ts`
**Responsibility**: Weather data fetch + state.
**Target lines**: ~70

- [ ] 4.1.1.1 Create hook `useWeatherData()`
- [ ] 4.1.1.2 Extract weather fetch logic
- [ ] 4.1.1.3 Extract loading, error, data handling
- [ ] 4.1.1.4 Extract `get-location` handler via postMessage
- [ ] 4.1.1.5 Verify it does not exceed 100 lines

### Subtask 4.1.2 — Create `src/components/mcp/weather/WeatherDisplay.tsx`
**Responsibility**: Weather display UI.
**Target lines**: ~60

- [ ] 4.1.2.1 Create component `WeatherDisplay` with props `{ data, loading, error }`
- [ ] 4.1.2.2 Extract weather presentation JSX
- [ ] 4.1.2.3 Extract icons and inline styles to classes
- [ ] 4.1.2.4 Verify it does not exceed 100 lines

### Subtask 4.1.3 — Refactor `WeatherApp.tsx`
**Responsibility**: Orchestrator using hook + display.
**Target lines**: <60

- [ ] 4.1.3.1 Replace internal logic with `useWeatherData`
- [ ] 4.1.3.2 Use `WeatherDisplay` for rendering
- [ ] 4.1.3.3 Verify it does not exceed 100 lines

---

## Task 4.2 — Refactor CryptoApp.tsx (214 lines)

### Subtask 4.2.1 — Create `src/components/mcp/crypto/useCryptoData.ts`
**Responsibility**: Cryptocurrency price fetch + state.
**Target lines**: ~70

- [ ] 4.2.1.1 Create hook `useCryptoData()`
- [ ] 4.2.1.2 Extract CoinGecko API fetch logic
- [ ] 4.2.1.3 Extract loading, error, rate-limit handling
- [ ] 4.2.1.4 Extract `get-crypto-price` handler via postMessage
- [ ] 4.2.1.5 Verify it does not exceed 100 lines

### Subtask 4.2.2 — Create `src/components/mcp/crypto/CryptoTable.tsx`
**Responsibility**: Crypto price table UI.
**Target lines**: ~60

- [ ] 4.2.2.1 Create component `CryptoTable` with props `{ coins, loading, error }`
- [ ] 4.2.2.2 Extract crypto table/list JSX
- [ ] 4.2.2.3 Extract price formatting and 24h change display
- [ ] 4.2.2.4 Verify it does not exceed 100 lines

### Subtask 4.2.3 — Refactor `CryptoApp.tsx`
**Responsibility**: Orchestrator using hook + table.
**Target lines**: <60

- [ ] 4.2.3.1 Replace internal logic with `useCryptoData`
- [ ] 4.2.3.2 Use `CryptoTable` for rendering
- [ ] 4.2.3.3 Verify it does not exceed 100 lines

---

## Task 4.3 — Refactor ChartApp.tsx (201 lines)

### Subtask 4.3.1 — Create `src/components/mcp/chart/useChartData.ts`
**Responsibility**: Chart data retrieval via MCP.
**Target lines**: ~50

- [ ] 4.3.1.1 Create hook `useChartData()`
- [ ] 4.3.1.2 Extract `get-chart-data` handler via postMessage
- [ ] 4.3.1.3 Extract loading, error, data handling
- [ ] 4.3.1.4 Verify it does not exceed 100 lines

### Subtask 4.3.2 — Create `src/components/mcp/chart/ChartCanvas.tsx`
**Responsibility**: Chart rendering UI.
**Target lines**: ~80

- [ ] 4.3.2.1 Create component `ChartCanvas` with props `{ data, loading, error }`
- [ ] 4.3.2.2 Extract chart rendering logic (SVG or Canvas)
- [ ] 4.3.2.3 Extract axes, bars, labels
- [ ] 4.3.2.4 Verify it does not exceed 100 lines

### Subtask 4.3.3 — Refactor `ChartApp.tsx`
**Responsibility**: Orchestrator using hook + canvas.
**Target lines**: <60

- [ ] 4.3.3.1 Replace internal logic with `useChartData`
- [ ] 4.3.3.2 Use `ChartCanvas` for rendering
- [ ] 4.3.3.3 Verify it does not exceed 100 lines

---

## Task 4.4 — Refactor TravelApp.tsx (249 lines)

### Subtask 4.4.1 — Create `src/components/mcp/travel/useTravelData.ts`
**Responsibility**: Travel data + state.
**Target lines**: ~70

- [ ] 4.4.1.1 Create hook `useTravelData()`
- [ ] 4.4.1.2 Extract travel data logic
- [ ] 4.4.1.3 Extract loading, error, data handling
- [ ] 4.4.1.4 Verify it does not exceed 100 lines

### Subtask 4.4.2 — Create `src/components/mcp/travel/TravelCards.tsx`
**Responsibility**: Travel cards UI.
**Target lines**: ~80

- [ ] 4.4.2.1 Create component `TravelCards` with props `{ destinations, loading, error }`
- [ ] 4.4.2.2 Extract destination cards JSX
- [ ] 4.4.2.3 Extract individual card styles
- [ ] 4.4.2.4 Verify it does not exceed 100 lines

### Subtask 4.4.3 — Refactor `TravelApp.tsx`
**Responsibility**: Orchestrator using hook + cards.
**Target lines**: <60

- [ ] 4.4.3.1 Replace internal logic with `useTravelData`
- [ ] 4.4.3.2 Use `TravelCards` for rendering
- [ ] 4.4.3.3 Verify it does not exceed 100 lines

---

## Task 4.5 — Refactor McpClientApp.tsx (111 lines)

### Subtasks
- [ ] 4.5.1 Analyze whether it needs splitting (111 > 100)
- [ ] 4.5.2 If needed, extract postMessage logic to `useMcpClient` hook
- [ ] 4.5.3 Leave the component with only routing UI
- [ ] 4.5.4 Verify no file exceeds 100 lines

---

## Task 4.6 — Final Verification
### Subtasks
- [ ] 4.6.1 Run `pnpm build` — must pass without errors
- [ ] 4.6.2 Run `pnpm dev` — verify each widget individually:
  - Weather: displays weather correctly
  - Crypto: shows prices and 24h changes
  - Chart: renders chart with data
  - Travel: shows destination cards
- [ ] 4.6.3 Verify iframe ↔ host communication (postMessage)
- [ ] 4.6.4 Run `pnpm test` — tests must pass
- [ ] 4.6.5 Confirm no new file exceeds 100 lines
