interface Props {
  role: 'user' | 'assistant';
}

export function MessageAvatar({ role }: Props) {
  const icon = role === 'user' ? 'person' : 'smart_toy';
  const cls = role === 'user' ? 'avatar user-avatar' : 'avatar bot-avatar';

  return (
    <div className={cls}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </div>
  );
}
