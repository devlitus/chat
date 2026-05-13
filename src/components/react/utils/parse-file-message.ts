export interface ParsedFileMessage {
  displayContent: string;
  attachmentData: { id: string; name: string; type: string } | null;
}

const FILE_RE = /\[Archivo subido a temp id:\s*([a-zA-Z0-9_\-.]+)\]:\s*(.+?)\s*\((.+?)\)\n\n/;

export function parseFileMessage(content: string): ParsedFileMessage {
  const match = content.match(FILE_RE);
  if (!match) return { displayContent: content, attachmentData: null };

  return {
    displayContent: content.replace(match[0], '').trim(),
    attachmentData: { id: match[1], name: match[2], type: match[3] },
  };
}
