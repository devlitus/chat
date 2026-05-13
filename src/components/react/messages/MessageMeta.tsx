interface Props {
  name: string;
  time: string;
}

export function MessageMeta({ name, time }: Props) {
  return (
    <div className="meta">
      <span className="msg-name">{name}</span>
      <span className="msg-time">{time}</span>
    </div>
  );
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
