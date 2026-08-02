import { useState } from 'react';

interface TravelSuggestion {
  id: string; title: string; description: string;
  estimatedCost: string; highlights: string[];
}

type Step = 'form' | 'loading' | 'results' | 'error';

export function useTravelData() {
  const [step, setStep] = useState<Step>('form');
  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('Standard');
  const [days, setDays] = useState('3');
  const [interests, setInterests] = useState('');
  const [suggestions, setSuggestions] = useState<TravelSuggestion[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || !days) return;
    setStep('loading'); setErrorMsg('');
    try {
      const res = await fetch('/api/travel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, budget, days, interests }),
      });
      if (!res.ok) {
        // Leer el mensaje de error real del servidor en vez de descartarlo
        let serverMsg = `Error del servidor (${res.status})`;
        try {
          const errorBody = await res.json();
          if (errorBody?.error) serverMsg = errorBody.error;
        } catch {
          // Si el body no es JSON, usar el status text del servidor
          serverMsg = res.statusText || serverMsg;
        }
        throw new Error(serverMsg);
      }
      const data = await res.json();
      if (data.suggestions && Array.isArray(data.suggestions)) { setSuggestions(data.suggestions); setStep('results'); }
      else throw new Error('La IA devolvió un formato de respuesta inesperado. Intenta de nuevo.');
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Error desconocido'); setStep('error'); }
  };

  return { step, destination, setDestination, budget, setBudget, days, setDays, interests, setInterests, suggestions, errorMsg, handleSubmit, setStep };
}
