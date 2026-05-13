import { useEffect, type RefObject } from 'react';

export function useAutoResize(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  text: string
) {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text, textareaRef]);
}
