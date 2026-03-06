// src/lib/markdown.ts

import { marked } from 'marked';
import hljs from 'highlight.js';
// dompurify es seguro de importar en Node.js; sólo falla si se llama .sanitize() sin DOM.
// isomorphic-dompurify (que usaba jsdom) fue reemplazado para evitar ERR_REQUIRE_ESM en Vercel.
import DOMPurify from 'dompurify';

marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const language = hljs.getLanguage(lang ?? '') ? lang! : 'plaintext';
      const highlighted = hljs.highlight(text, { language }).value;
      const displayLang = lang || 'texto';
      const encoded = encodeURIComponent(text);
      return `<pre><div class="code-header"><span class="code-lang">${displayLang}</span><button class="copy-btn" data-code="${encoded}"><span class="material-symbols-outlined">content_copy</span>Copiar</button></div><code class="hljs language-${language}">${highlighted}</code></pre>`;
    },
  },
});

// Tags permitidos para contenido markdown renderizado (whitelist estricta)
const ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
  'strong', 'em', 'a', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
  // Tags necesarios para el renderer de código personalizado
  'div', 'span', 'button',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'data-code',
  'target', 'rel', 'width', 'height',
];

function sanitizeHtml(html: string): string {
  // En SSR (Node.js no tiene DOM) se devuelve el HTML sin sanitizar.
  // El XSS sólo es relevante en el cliente, donde DOMPurify funciona con el DOM del browser.
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: false,
  });
}

export function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  return sanitizeHtml(html);
}

export function renderStreamingMarkdown(accumulatedContent: string): string {
  return renderMarkdown(accumulatedContent);
}
