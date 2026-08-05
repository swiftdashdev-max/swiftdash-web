/**
 * Contrast helpers for applying customer-chosen brand colours safely.
 *
 * A business picks its colours once, against one page. Those same values then
 * get reused on surfaces they never saw — and a colour that reads beautifully
 * on a white delivery page can be invisible on a dark emergency one. RCERT, for
 * instance, set a near-black body text colour; drawn on a near-black ground it
 * would simply not be there.
 *
 * So brand colours are treated as a *preference*, checked before use. The rule
 * is WCAG relative luminance, which is the same thing a person means by "can I
 * read that".
 */

/** #rgb, #rrggbb, or null-ish. Anything else is treated as unusable. */
function parseHex(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 0;
  const la = luminance(ca);
  const lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The brand colour if it can actually be read on this ground, else the
 * fallback. `large` relaxes the threshold to the WCAG large-text rule, which is
 * the honest bar for display type and buttons.
 */
export function readable(
  colour: string | null | undefined,
  ground: string,
  fallback: string,
  large = false
): string {
  if (!colour || !parseHex(colour)) return fallback;
  return contrastRatio(colour, ground) >= (large ? 3 : 4.5) ? colour : fallback;
}

/**
 * Black or white — whichever can be read on top of the given colour. For text
 * sitting on a brand-coloured button, where the brand owns the background and
 * the foreground just has to work.
 */
export function onColour(background: string | null | undefined, fallback = '#FFFFFF'): string {
  if (!background || !parseHex(background)) return fallback;
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000')
    ? '#FFFFFF'
    : '#0B1017';
}

/** A usable hex, or the fallback. For backgrounds, where readability is relative. */
export function hexOr(colour: string | null | undefined, fallback: string): string {
  return parseHex(colour) ? colour!.trim() : fallback;
}
