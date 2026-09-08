import api from '../api'

// Chat de ayuda de uso. Transversal al sistema: no pertenece a ningún módulo.

// pregunta: string; historial: [{ rol: 'user'|'assistant', contenido }]; pantalla: string|null
export const consultarAsistente = ({ pregunta, historial = [], pantalla = null }) =>
  api.post('/asistente/chat', { pregunta, historial, pantalla }).then(r => r.data)
