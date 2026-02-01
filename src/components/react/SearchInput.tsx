// src/components/react/SearchInput.tsx

import { useCallback, useRef } from 'react';
import { useChatDispatch } from './ChatContext';

export function SearchInput() {
  const dispatch = useChatDispatch();
  const timerRef = useRef<number>(0);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      clearTimeout(timerRef.current);
      const value = e.target.value;
      timerRef.current = window.setTimeout(() => {
        dispatch({ type: 'SET_SEARCH_QUERY', query: value.trim() });
      }, 250);
    },
    [dispatch]
  );

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
