interface Props {
  onClick: () => void;
  disabled: boolean;
}

export function SendButton({ onClick, disabled }: Props) {
  return (
    <button
      className="send-btn"
      title="Send message"
      aria-label="Send message"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="material-symbols-outlined" aria-hidden="true">send</span>
    </button>
  );
}
