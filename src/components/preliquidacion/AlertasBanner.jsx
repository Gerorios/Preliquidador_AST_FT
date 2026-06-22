export default function AlertasBanner({ total, sinPrecio, duplicados, alertaLegajo, onFiltrar }) {
  return (
    <div style={{
      background: 'var(--warn-dim)',
      borderBottom: '1px solid rgba(232,168,74,0.3)',
      padding: '7px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 12,
      color: 'var(--warn)',
      flexShrink: 0,
    }}>
      <span>⚠</span>
      <span>
        <strong>{total} alertas sin resolver:</strong>
        {sinPrecio > 0 && ` ${sinPrecio} sin precio`}
        {duplicados > 0 && ` · ${duplicados} duplicados`}
        {alertaLegajo > 0 && ` · ${alertaLegajo} legajos`}
      </span>
      <button
        onClick={onFiltrar}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          color: 'var(--warn)',
          cursor: 'pointer',
          fontSize: 11,
          textDecoration: 'underline',
          padding: 0,
        }}
      >
        Ver solo alertas →
      </button>
    </div>
  )
}
