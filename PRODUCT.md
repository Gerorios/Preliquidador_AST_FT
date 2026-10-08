# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Preliquidador** (rol `operador` en el código): personal de liquidación de sueldos y
  contadores. Prepara cada quincena: genera la preliquidación, resuelve las líneas
  incompletas o con alerta, carga conceptos y precios, controla y exporta.
- **Gerente**: mira la Vista gerencial (sólo lectura) y maneja el maestro de Conceptos,
  porque muchas veces es quien decide un cambio de precios.
- **Admin**: rol global; administra usuarios. El usuario es el CUIL.

Hoy son hasta 5 personas, personal administrativo en oficina, con PC de escritorio. Son
usuarios que necesitan señales claras; el sistema se pensó para gente mayor y poco
habituada a apps modernas.

A futuro, sin fecha ni decisión: la app podría abrirse a gente de campo para cargar
tareas, y entonces tendría que funcionar en celular. Hoy no.

## Product Purpose

Toma las tareas de campo de la quincena (pulverizadas, maquinaria, tareas manuales,
cosecha), las cruza con el maestro de sueldos, les aplica los conceptos y precios que
define el liquidador y entrega un Excel que alimenta la liquidación formal en el área de
sueldos. Reemplaza el trabajo a mano sobre planillas.

Éxito: una quincena se prepara sin perder líneas, sin pagar dos veces y sin contar a mano,
y el Excel sale correcto.

## Positioning

Es una herramienta interna de La Asturiana hecha sobre sus propios datos: las tareas de
campo, el padrón de sueldos y las reglas de precio por cliente, finca y supervisor. No
compite con un producto de mercado; su valor es que conoce las reglas de la empresa.

## Operating Context

El trabajo gira alrededor de la quincena ("1ra/2da MAY 2026"):

1. En el Inicio del módulo se elige la quincena y se toca "Generar / Actualizar".
2. Revisión: tabla de líneas con alertas (duplicado, posible duplicado, incompleta, sin
   legajo, sin empresa), filtros, panel por línea y liquidación masiva por persona.
3. Conceptos: maestro de reglas y precios (comunes, por cliente, por finca, por
   supervisor), con solapamientos y precios heredados. Un cambio impacta solo en las
   líneas, sin botón de aplicar.
4. Mantenimiento: categoría de cada operario de taller.
5. Verificación: controles de razonabilidad antes de cerrar.
6. Exportar el Excel de la quincena desde Revisión.

La base de datos es remota y agrega latencia: cada escritura tarda lo suficiente como para
que la app parezca colgada si no avisa.

Lo que hoy más duele, según el dueño: encontrar qué falta en una quincena, entender y usar
Conceptos, y una interfaz que se ve vieja y poco clara.

## Capabilities and Constraints

- Vocabulario del dominio, a usar tal cual: Quincena, Línea (no "registro" ni "fila"),
  Línea incompleta, Línea duplicada, Posible duplicado, Concepto (la regla) y Concepto
  adicional (el pago ya congelado), Concepto común / por cliente / específico / por
  supervisor, Solapamiento, Precio heredado, Concepto manual, Concepto extra, Unidad base,
  Tancada, Categoría de operario, Grupo de pago, Grupo de tareas, Empresa, Legajo, CUIL,
  Mensualizados. Glosario completo en el repo del backend
  (`docs/modulos/preliquidacion/CONTEXT-preliquidacion.md`).
- Feedback siempre visible, pedido explícito de los usuarios: toda escritura muestra un
  overlay bloqueante "Procesando...", toda carga inicial un indicador de carga y todo
  resultado un aviso.
- Textos en español, con acentos, sin emojis en la interfaz.
- Nadie ve su propio rol en la interfaz.
- El Excel de exportación no cambia: lo lee el área de sueldos.
- Stack fijo: React 18 + Vite, CSS Modules con tokens en `src/index.css`, sin Tailwind ni
  librería de componentes; dependencias nuevas (fuentes incluidas) se aprueban antes.
- El sistema tiene un segundo módulo, Liquidación Terceros, que comparte el núcleo (Inicio,
  menú, login, tokens) y hereda su estética. Sus pantallas no se rediseñan acá.
- Sin decidir: modo oscuro; cierre formal de una quincena (hoy no existe).

## Brand Commitments

- Marca: La Asturiana. El logo se conserva (`src/assets/logo-asturiana.png` y
  `src/assets/logo-asturiana-icono.png`).
- La paleta sale de los colores del logo: un rediseño los puede reinterpretar, no
  reemplazar.
- La estética actual del sistema (tokens de `src/index.css`, menú lateral oscuro, tema
  claro) es la identidad vigente: el dueño la considera clara y buena. Los cambios de
  interfaz la **refinan**, no la reemplazan. Descartados el 2026-10-08: mundos temáticos o
  metáforas visuales ("no es serio") y un rediseño completo con otra estructura ("no tiene
  nada que ver con lo que hoy existe").

## Evidence on Hand

- Logo y favicons en `src/assets/` y `public/`.
- Ayuda de uso en el repo del backend (`docs/AYUDA.md`), parcialmente desactualizada.
- No hay capturas, métricas de uso ni testimonios: no se inventan.

## Product Principles

1. **Lo que falta, primero.** Cada pantalla deja ver enseguida qué está incompleto o con
   alerta y qué hacer con eso.
2. **Nunca parecer colgada.** Toda acción tiene una respuesta visible inmediata.
3. **El vocabulario de la empresa.** La interfaz habla con los términos del glosario, no
   con palabras genéricas.
4. **Claro antes que compacto.** Densidad sí, porque es trabajo de planilla, pero con
   jerarquía legible para gente que no es nativa digital.
5. **Explicar las reglas.** Lo que el sistema decide solo (qué regla aplica, de dónde viene
   un precio) se muestra, no se esconde.

## Accessibility & Inclusion

Usuarios mayores: texto legible, contraste WCAG AA (la paleta actual está verificada),
señales que no dependen sólo del color y objetivos de clic cómodos. Sin requisitos
conocidos de lector de pantalla.
