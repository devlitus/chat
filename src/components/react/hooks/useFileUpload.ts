import { useState, useRef, useCallback } from 'react';
import { setBotError } from '../../../stores/chat-actions';

interface PendingFile {
  id: string;
  name: string;
  type: string;
  base64?: string;
  mimeType?: string;
}

export function useFileUpload(
  activeChatId: string | null,
  isStreaming: boolean
) {
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId || isStreaming) return;

    try {
      const lowerName = file.name.toLowerCase();
      const isSpreadsheet = lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
      const isPdf = lowerName.endsWith('.pdf');
      const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

      if (!isSpreadsheet && !isPdf && !isImage) {
        setBotError('Tipo de archivo no admitido. Solo CSV, Excel, PDF e imágenes.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setBotError('El archivo supera el límite de 5 MB.');
        return;
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
      });
      reader.readAsDataURL(file);
      const base64Content = await base64Promise;

      if (isImage) {
        setPendingFile({
          id: '',
          name: file.name,
          type: 'Imagen',
          base64: base64Content,
          mimeType: file.type,
        });
        return;
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content: base64Content }),
      });

      if (!res.ok) throw new Error('Error al subir el archivo al servidor local');
      const apiData = await res.json();

      setPendingFile({
        id: apiData.filename,
        name: file.name,
        type: isPdf ? 'Documento PDF' : 'Hoja de cálculo',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      setBotError(`No se pudo procesar el archivo: ${msg}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  }, [activeChatId, isStreaming]);

  const clearPendingFile = useCallback(() => setPendingFile(null), []);

  return { pendingFile, handleFileChange, clearPendingFile, fileInputRef };
}
