// src/components/react/SearchInput.tsx

import { useCallback, useRef } from 'react';
import { setSearchQuery } from '../../stores/chat-actions';

export function SearchInput() {
  const timerRef = useRef<number>(0);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    clearTimeout(timerRef.current);
    const value = e.target.value;
    timerRef.current = window.setTimeout(() => {
      setSearchQuery(value.trim());
    }, 250);
  }, []);

  return (
    <div className="search-wrapper">
      <label className="search-label">
        <div className="search-container">
          <div className="search-icon">
            <span className="material-symbols-outlined">search</span>
          </div>
          <input
            type="text"
            placeholder="Search history..."
            aria-label="Search chat history"
            onChange={handleInput}
          />
        </div>
      </label>
    </div>
  );
}
