import { useStore } from '@nanostores/react';
import { $researchMode } from '../../../stores/chat-store';

export function ResearchToggle() {
  const active = useStore($researchMode);

  return (
    <button
      className={`icon-btn research-toggle${active ? ' research-toggle--active' : ''}`}
      aria-pressed={active}
      aria-label={active ? 'Modo investigacion activo' : 'Activar modo investigacion profunda'}
      title={active ? 'Modo investigacion activo' : 'Activar modo investigacion profunda'}
      onClick={() => $researchMode.set(!active)}
    >
      <span className="material-symbols-outlined" aria-hidden="true">travel_explore</span>
    </button>
  );
}
