export function TrashList(props: { title: string; items: Array<{ id: string; label: string }>; onRestore: (id: string) => void }) {
  return (
    <div className="trash-list">
      <h4>{props.title}</h4>
      {props.items.length === 0 ? <p className="muted tiny-text">Sin registros eliminados.</p> : null}
      {props.items.map((item) => (
        <div key={item.id} className="trash-row">
          <span className="clamp-one-line">{item.label}</span>
          <button className="ghost-button small-button" onClick={() => props.onRestore(item.id)}>Restaurar</button>
        </div>
      ))}
    </div>
  );
}
