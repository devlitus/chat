// src/components/react/messages/hooks/useReuseInInput.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useReuseInInput } from './useReuseInInput';

const requestInsertIntoInputMock = vi.fn();

vi.mock('../../../../stores/chat-actions', () => ({
  requestInsertIntoInput: (text: string) => requestInsertIntoInputMock(text),
}));

interface Api {
  bubble: HTMLDivElement;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function TestHost({ fullText, register }: { fullText: string; register: (api: Api) => void }) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { onMouseDown, onClick } = useReuseInInput(bubbleRef, fullText);

  useEffect(() => {
    register({ bubble: bubbleRef.current!, onMouseDown, onClick });
  });

  return createElement('div', { ref: bubbleRef }, fullText);
}

function renderHost(fullText: string): Api {
  let api!: Api;
  act(() => {
    root.render(createElement(TestHost, { fullText, register: (a) => { api = a; } }));
  });
  return api;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  requestInsertIntoInputMock.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('useReuseInInput', () => {
  it('usa el fragmento seleccionado cuando la selección está dentro de la burbuja', () => {
    const api = renderHost('Hola mundo');
    const textNode = api.bubble.firstChild as Text;

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'mundo',
      anchorNode: textNode,
    } as unknown as Selection);

    api.onClick();

    expect(requestInsertIntoInputMock).toHaveBeenCalledWith('mundo');
  });

  it('usa el mensaje completo cuando no hay selección activa', () => {
    const api = renderHost('Hola mundo');

    vi.spyOn(window, 'getSelection').mockReturnValue(null);

    api.onClick();

    expect(requestInsertIntoInputMock).toHaveBeenCalledWith('Hola mundo');
  });

  it('usa el mensaje completo cuando la selección está fuera de la burbuja', () => {
    const api = renderHost('Hola mundo');
    const outsideNode = document.createTextNode('otro texto');
    document.body.appendChild(outsideNode);

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'otro',
      anchorNode: outsideNode,
    } as unknown as Selection);

    api.onClick();

    expect(requestInsertIntoInputMock).toHaveBeenCalledWith('Hola mundo');
    outsideNode.remove();
  });

  it('onMouseDown llama a preventDefault para no perder la selección nativa', () => {
    const api = renderHost('Hola mundo');
    const preventDefault = vi.fn();

    api.onMouseDown({ preventDefault } as unknown as React.MouseEvent);

    expect(preventDefault).toHaveBeenCalled();
  });
});
