export default function AlertasBanner({
  total, incompletas, duplicados, alertaLegajo, onFiltrar,
  mensaje, ctaLabel = 'Ver solo alertas →', ctaSubrayada = true,
}) {
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
        {mensaje ?? (
          <>
            <strong>{total} alertas sin resolver:</strong>
            {incompletas > 0 && ` ${incompletas} incompletas`}
            {duplicados > 0 && ` · ${duplicados} duplicados`}
            {alertaLegajo > 0 && ` · ${alertaLegajo} legajos`}
          </>
        )}
      </span>
      <button
        onClick={onFiltrar}
        style={ctaSubrayada
          ? { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--warn)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }
          : { marginLeft: 'auto', background: 'var(--warn)', border: 'none', color: 'var(--bg-base)', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)' }
        }
      >
        {ctaLabel}
      </button>
    </div>
  )
}
