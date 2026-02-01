// src/lib/markdown.ts

import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  return html;
}

export function renderStreamingMarkdown(accumulatedContent: string): string {
  return renderMarkdown(accumulatedContent);
}
