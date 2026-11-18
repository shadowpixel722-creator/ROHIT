import sharp from "sharp";

/**
 * Estimates how many degrees a photographed page is tilted (projection-profile method).
 * Text lines and notebook rulings form sharp horizontal bands only when the page is level, so we
 * try angles within ±12° and keep the one whose row histogram is "peakiest". Returns the angle to
 * pass to sharp.rotate() to level the page, or 0 when unsure (few dark pixels, small gain).
 */
export async function estimateDeskew(input: Buffer): Promise<number> {
  const { data, info } = await sharp(input).greyscale().resize({ width: 500, withoutEnlargement: true }).normalise().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const xs: number[] = [];
  const ys: number[] = [];
  // Dark pixels, ignoring a 3% border (photo edges, table background).
  const mx = Math.floor(width * 0.03);
  const my = Math.floor(height * 0.03);
  for (let y = my; y < height - my; y++)
    for (let x = mx; x < width - mx; x++)
      if (data[y * width + x] < 110) { xs.push(x); ys.push(y); }
  if (xs.length < 400) return 0;
  // Subsample very dense images for speed.
  const step = Math.max(1, Math.floor(xs.length / 40_000));
  const diag = Math.ceil(Math.hypot(width, height));
  const bins = new Float64Array(diag * 2 + 2);

  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    const s = Math.sin(a);
    const c = Math.cos(a);
    bins.fill(0);
    for (let i = 0; i < xs.length; i += step) bins[Math.round(xs[i] * s + ys[i] * c) + diag]++;
    let sum = 0;
    for (const b of bins) sum += b * b;
    return sum;
  };

  let best = 0;
  let bestScore = score(0);
  const base = bestScore;
  for (let d = -12; d <= 12; d += 0.5) {
    const sc = score(d);
    if (sc > bestScore) { bestScore = sc; best = d; }
  }
  for (let d = best - 0.5; d <= best + 0.5; d += 0.1) {
    const sc = score(d);
    if (sc > bestScore) { bestScore = sc; best = d; }
  }
  // Only correct when clearly better than leaving the page alone.
  if (Math.abs(best) < 0.4 || bestScore < base * 1.05) return 0;
  return Math.round(best * 10) / 10;
}

/** Levels a tilted page. Corners revealed by rotation are filled white. */
export async function deskew(input: Buffer): Promise<{ data: Buffer; angle: number }> {
  const angle = await estimateDeskew(input);
  if (!angle) return { data: input, angle: 0 };
  const data = await sharp(input).rotate(angle, { background: "#ffffff" }).toBuffer();
  return { data, angle };
}
