import { useCallback, type RefObject } from 'react';
import { requestInsertIntoInput } from '../../../../stores/chat-actions';

export function useReuseInInput(
  bubbleRef: RefObject<HTMLDivElement | null>,
  fullText: string
): { onMouseDown: (e: React.MouseEvent) => void; onClick: () => void } {
  // preventDefault en mousedown evita que el navegador colapse la
  // selección de texto antes de que se dispare el evento click, en el
  // que se lee window.getSelection().
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const onClick = useCallback(() => {
    const selection = window.getSelection();
    const bubble = bubbleRef.current;
    const selectedText = selection?.toString() ?? '';

    const isSelectionInsideBubble =
      bubble != null &&
      selection != null &&
      selectedText.length > 0 &&
      bubble.contains(selection.anchorNode);

    requestInsertIntoInput(isSelectionInsideBubble ? selectedText : fullText);
  }, [bubbleRef, fullText]);

  return { onMouseDown, onClick };
}
