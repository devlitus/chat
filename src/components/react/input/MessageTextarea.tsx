import { useRef, type RefObject } from 'react';
import { useAutoResize } from '../hooks/useAutoResize';

interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

export function MessageTextarea({ value, onChange, onKeyDown, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useAutoResize(textareaRef as RefObject<HTMLTextAreaElement>, value);

  return (
    <textarea
      ref={textareaRef}
      placeholder="Type a message..."
      rows={1}
      aria-label="Type a message"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      disabled={disabled}
    />
  );
}
