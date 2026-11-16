/**
 * Fondo decorativo compartido.
 *
 * Antes se usaban orbes de 500-600px con `blur()` (uno animado), lo que obliga
 * al navegador a re-rasterizar capas enormes en GPU en cada frame y dispara
 * el consumo de memoria en móviles. Un solo `radial-gradient` produce el mismo
 * efecto visual sin filtros ni animaciones.
 */
export default function Background() {
  return <div aria-hidden className="app-background pointer-events-none fixed inset-0 -z-10" />;
}
