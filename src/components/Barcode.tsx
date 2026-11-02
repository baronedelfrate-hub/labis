import { code128Modules } from "@/lib/code128";

// Código de barras Code 128 em SVG. Estica na largura do espaço disponível (use className para definir o tamanho),
// mantendo as barras nítidas na impressão. A zona de silêncio (margem branca) é incluída.
export function Barcode({ value, className, quiet = 10 }: { value: string; className?: string; quiet?: number }) {
  const mods = code128Modules(value);
  let x = quiet;
  let d = "";
  mods.forEach((w, i) => {
    if (i % 2 === 0) d += `M${x} 0h${w}v1h-${w}z`;
    x += w;
  });
  const total = x + quiet;
  return (
    <svg
      viewBox={`0 0 ${total} 1`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={`Código de barras ${value}`}
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
