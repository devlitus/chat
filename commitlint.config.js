/**
 * Commitlint config — Antigravity Team
 * Extiende Conventional Commits con tipos adicionales del proyecto
 * @see .agents/skills/conventional-commits.md
 */
export default {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Permitir el tipo 'security' (no está en el estándar por defecto)
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'ci',
        'build',
        'security',
        'revert',
      ],
    ],

    // La descripción debe tener al menos 10 caracteres (nada de "fix" solo)
    'subject-min-length': [2, 'always', 10],

    // Sin punto final en la descripción
    'subject-full-stop': [2, 'never', '.'],

    // El caso debe ser: lower-case, upper-case, camel-case, etc.
    // Conventional commits recomienda lower-case para el subject
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],

    // Máximo 72 caracteres en el header
    'header-max-length': [2, 'always', 72],

    // Línea en blanco entre header y body
    'body-leading-blank': [1, 'always'],

    // Máximo 100 caracteres por línea en el body
    'body-max-line-length': [2, 'always', 100],
  },
};
