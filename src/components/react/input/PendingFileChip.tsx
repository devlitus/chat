interface Props {
  file: { name: string; type: string };
  onRemove: () => void;
}

export function PendingFileChip({ file, onRemove }: Props) {
  return (
    <div className="pending-file-chip">
      <span className="material-symbols-outlined pending-file-icon" aria-hidden="true">
        {file.type.includes('Hoja de cálculo') ? 'table_chart' : 'picture_as_pdf'}
      </span>
      <span className="pending-file-name">{file.name}</span>
      <button onClick={onRemove} className="pending-file-close" title="Quitar archivo" aria-label="Quitar archivo">
        <span className="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </div>
  );
}
