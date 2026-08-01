/**
 * Simple Git Hooks config — Antigravity Team
 * Hook que ejecuta commitlint para validar cada mensaje de commit
 */
export default {
  'commit-msg': 'pnpm commitlint --edit $1',
};
