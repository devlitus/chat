// src/lib/markdown.ts

import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

function sanitizeHtml(html: string): string {
  // Remover tags peligrosos (script, iframe, object, embed)
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
