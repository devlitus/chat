import { useEffect, useRef, type RefObject } from 'react';

export function useAutoResize(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  text: string
) {
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Si ya hay un reflow pendiente de un cambio de texto anterior (p. ej.
    // varias actualizaciones de `text` dentro del mismo frame al insertar
    // un fragmento largo), lo cancelamos y dejamos solo el más reciente:
    // evita forzar el par escritura+lectura de layout (`style.height` +
    // `scrollHeight`) más de una vez por frame.
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    });

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [text, textareaRef]);
}
