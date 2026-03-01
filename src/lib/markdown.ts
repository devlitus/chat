// src/lib/markdown.ts

import { marked } from 'marked';
import hljs from 'highlight.js';

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

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, (match) => {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    })
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, (match) => {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    });
}

export function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  return sanitizeHtml(html);
}

export function renderStreamingMarkdown(accumulatedContent: string): string {
  return renderMarkdown(accumulatedContent);
}
