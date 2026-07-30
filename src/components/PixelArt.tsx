type Props = {
  rows: string[];
  palette: Record<string, string>;
  scale?: number;
  className?: string;
};

export function PixelArt({ rows, palette, scale = 4, className }: Props) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const shadows: string[] = [];

  rows.forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      const color = palette[ch];
      if (!color) return;
      shadows.push(`${x * scale}px ${y * scale}px 0 0 ${color}`);
    });
  });

  return (
    <div
      className={className}
      style={{
        width: scale,
        height: scale,
        marginRight: (w - 1) * scale,
        marginBottom: (h - 1) * scale,
        boxShadow: shadows.join(","),
      }}
      aria-hidden
    />
  );
}
