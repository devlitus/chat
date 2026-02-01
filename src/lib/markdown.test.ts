// src/lib/markdown.test.ts

import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderStreamingMarkdown } from './markdown';

describe('markdown.ts - Renderizado', () => {
  describe('renderMarkdown', () => {
    it('debe convertir texto plano a HTML', () => {
      const result = renderMarkdown('Hola mundo');

      expect(result).toContain('Hola mundo');
      expect(result).toContain('<p>');
    });

    it('debe renderizar negritas con **', () => {
      const result = renderMarkdown('Texto **negrita** normal');

      expect(result).toContain('<strong>negrita</strong>');
    });

    it('debe renderizar cursivas con *', () => {
      const result = renderMarkdown('Texto *cursiva* normal');

      expect(result).toContain('<em>cursiva</em>');
    });

    it('debe renderizar enlaces', () => {
      const result = renderMarkdown('[Link](https://example.com)');

      expect(result).toContain('<a href="https://example.com">Link</a>');
    });

    it('debe renderizar código inline con backticks', () => {
      const result = renderMarkdown('Usar `const x = 10;` en JS');

      expect(result).toContain('<code>const x = 10;</code>');
    });

    it('debe renderizar bloques de código con triple backticks', () => {
      const markdown = '```javascript\nconst x = 10;\n```';
      const result = renderMarkdown(markdown);

      expect(result).toContain('<pre>');
      expect(result).toContain('<code');
      expect(result).toContain('const x = 10;');
    });

    it('debe respetar saltos de línea (breaks: true)', () => {
      const result = renderMarkdown('Línea 1\nLínea 2');

      // Con breaks: true, \n se convierte en <br>
      expect(result).toContain('<br>');
    });

    it('debe soportar listas con -', () => {
      const markdown = '- Item 1\n- Item 2';
      const result = renderMarkdown(markdown);

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('debe escapar HTML peligroso', () => {
      const result = renderMarkdown('<script>alert("xss")</script>');

      // marked por defecto NO escapa HTML (sanitize: false)
      // Si esto falla, agregar sanitización explícita
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('renderStreamingMarkdown', () => {
    it('debe renderizar contenido parcial correctamente', () => {
      const partial = 'Esto es un **texto par';
      const result = renderStreamingMarkdown(partial);

      // Debe manejar markdown incompleto sin errores
      expect(result).toBeTruthy();
    });

    it('debe ser idéntico a renderMarkdown', () => {
      const content = 'Texto **completo**';

      const result1 = renderMarkdown(content);
      const result2 = renderStreamingMarkdown(content);

      expect(result1).toBe(result2);
    });
  });
});
