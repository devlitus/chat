#!/usr/bin/env bash
# SessionStart hook: avisa si docs/deuda-tecnica.md tiene items sin resolver.
FILE="docs/deuda-tecnica.md"

if [ ! -f "$FILE" ]; then
  exit 0
fi

PENDING=$(grep -c '^- \[ \]' "$FILE" 2>/dev/null || echo 0)

if [ "$PENDING" -eq 0 ]; then
  exit 0
fi

ITEMS=$(grep '^- \[ \]' "$FILE" | sed 's/^- \[ \] //')

jq -n \
  --arg msg "⚠️ Deuda técnica pendiente: $PENDING ítem(s) sin resolver en docs/deuda-tecnica.md" \
  --arg items "$ITEMS" \
  --arg pending "$PENDING" \
  '{
    systemMessage: $msg,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ("Al iniciar esta sesión, avisa con urgencia al usuario que hay " + $pending + " ítem(s) de deuda técnica sin resolver en docs/deuda-tecnica.md (revisión de código pendiente de aplicar). Lista breve:\n" + $items + "\n\nRepite este aviso en cada sesión hasta que el usuario marque los ítems como resueltos (\"- [x]\") en ese archivo.")
    }
  }'
