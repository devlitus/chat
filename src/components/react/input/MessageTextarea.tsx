import { forwardRef, useImperativeHandle, useRef, type RefObject } from 'react';
import { useAutoResize } from '../hooks/useAutoResize';

interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

export const MessageTextarea = forwardRef<HTMLTextAreaElement, Props>(
  function MessageTextarea({ value, onChange, onKeyDown, disabled }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useAutoResize(textareaRef as RefObject<HTMLTextAreaElement>, value);
    useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

    return (
      <textarea
        ref={textareaRef}
        placeholder="Escribe un mensaje..."
        rows={1}
        aria-label="Escribe un mensaje"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
    );
  }
);
