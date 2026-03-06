// src/components/react/UserProfile.tsx

import { useStore } from '@nanostores/react';
import { $session } from '../../stores/chat-store';

export function UserProfile() {
  const session = useStore($session);
  const displayName = session?.displayName ?? 'Usuario';

  return (
    <div className="user-profile">
      <button className="profile-btn" aria-label={`Perfil de ${session?.displayName ?? 'usuario'}`}>
        <div className="profile-avatar">
          <span
            className="material-symbols-outlined"
            style={{ color: 'var(--color-text-secondary)', fontSize: '20px' }}
          >
            person
          </span>
        </div>
        <div className="profile-info">
          <p className="profile-name">{displayName}</p>
          <p className="profile-plan">Free Plan</p>
        </div>
        <span className="material-symbols-outlined settings-icon">settings</span>
      </button>
    </div>
  );
}
