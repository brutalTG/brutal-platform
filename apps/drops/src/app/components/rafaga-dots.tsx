// Progreso dentro de una ráfaga: bullets debajo del header; el actual se estira en una pastilla.
// Responde al duotono (color del frente sobre el fondo).
export function RafagaDots({ total, current, color = "var(--dynamic-fg, #fff)" }: { total: number; current: number; color?: string }) {
  return (
    <div className="flex items-center justify-center gap-[10px]" aria-label={`${current + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: i === current ? 46 : 12,
            height: 12,
            backgroundColor: i === current ? color : `color-mix(in srgb, ${color} 40%, transparent)`,
            transition: "width 0.25s ease, background-color 0.25s ease",
          }}
        />
      ))}
    </div>
  );
}
