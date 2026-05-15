interface Props {
  name: string;
  type: string;
}

export function AttachmentCard({ name, type }: Props) {
  return (
    <div className="attachment-card">
      <span className="material-symbols-outlined attachment-icon">
        {type.includes('Hoja de cálculo') ? 'table_chart' : 'picture_as_pdf'}
      </span>
      <div className="attachment-details">
        <p className="attachment-name">{name}</p>
        <p className="attachment-type">{type}</p>
      </div>
    </div>
  );
}
