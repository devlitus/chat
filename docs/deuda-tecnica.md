# Deuda Técnica

Registro de hallazgos de revisiones de código que no bloquearon el merge pero
quedan pendientes de resolver. Marca `- [x]` al aplicar el fix — el hook de
`SessionStart` (`.claude/hooks/check-tech-debt.sh`) deja de avisar sobre un
ítem en cuanto queda marcado, y deja de avisar del todo cuando no queda
ninguno sin marcar en todo el archivo.

## PR #15 — Reutilizar texto de burbujas de usuario en el input (`feature/seleccion-texto-burbuja-usuario`)

Hallazgos de `/pr-review-toolkit:review-pr` (code-reviewer, pr-test-analyzer, comment-analyzer), 2026-08-02.

### Críticos

- [ ] **Selección cruzada entre burbujas filtra texto ajeno al input** — `src/components/react/messages/hooks/useReuseInInput.ts:21-27`. Solo se comprueba `bubble.contains(selection.anchorNode)`; si el usuario arrastra la selección desde la burbuja de usuario hacia la respuesta del bot (u otra burbuja), `anchorNode` sigue dentro pero `selection.toString()` devuelve texto ajeno. Fix: exigir también `bubble.contains(selection.focusNode)`.
- [ ] **Botón `.reuse-btn` invisible pero pulsable en táctil** — `src/styles/message-bubbles.css:31,51`. El hover-reveal (`opacity: 0` + `:hover`/`:focus-visible`) no tiene equivalente en pantallas táctiles (no hay `:hover`), pero el botón sigue recibiendo toques. Fix: envolver el hover-reveal en `@media (hover: hover) and (pointer: fine)` y dejarlo visible por defecto en punteros gruesos.
- [ ] **Cero cobertura de test en la lógica de inserción de cursor** — `src/components/react/ChatInput.tsx:47-66`. El `useEffect` que calcula inserción en `selectionStart`/`selectionEnd`, reemplazo de rango seleccionado y restauración de foco no tiene ningún test. Recomendado: extraer a un hook propio (`usePendingInputInsertion`) testeable con el mismo patrón `createElement`/`createRoot` que usa `useReuseInInput.test.ts`.

### Importantes

- [ ] **Desajuste `title`/`aria-label` en el botón reuse** — `src/components/react/messages/UserMessage.tsx:36-37`. `title="Usar en el input"` vs. `aria-label="Usar este mensaje en el input"` — el texto visible no está contenido en el nombre accesible (WCAG 2.5.3 Label in Name). Fix: unificar ambos textos.
- [ ] **`.claude/agents/planner.md` modificado dentro de un PR de feature (scope creep)** — el diff de PR #15 incluye `model: sonnet → opus` y una reescritura de la plantilla del planner, sin relación con la feature. Separar en su propio commit/PR.
- [ ] **`useAutoResize.ts` sin test** tras cambiar de resize síncrono a batching por `requestAnimationFrame` con cancelación. Testeable con fake timers en `happy-dom`.

### Sugerencias

- [ ] Falta test de selección colapsada dentro de la burbuja (`anchorNode` no-null, `toString()` vacío) en `useReuseInInput.test.ts`.
- [ ] Falta test de integración en `UserMessage.tsx` que confirme que el botón no se renderiza sin `displayContent`.
- [ ] Imprecisiones de fraseo en comentarios de `ChatInput.tsx:39-48` ("nunca tuvo foco" → "no tiene el foco en ese momento"; "de forma pura" es optimista, ya que lee `selectionStart`/`selectionEnd` del DOM).
