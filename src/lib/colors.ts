/**
 * Generate a consistent HSL color from a string (name).
 * Used to assign unique colors to group chat participants.
 */
const SENDER_COLORS = [
  'hsl(210, 70%, 45%)',  // blue
  'hsl(340, 65%, 47%)',  // rose
  'hsl(160, 60%, 38%)',  // emerald
  'hsl(270, 55%, 50%)',  // purple
  'hsl(25, 75%, 47%)',   // orange
  'hsl(190, 65%, 40%)',  // teal
  'hsl(45, 70%, 42%)',   // amber
  'hsl(300, 50%, 45%)',  // fuchsia
  'hsl(140, 55%, 35%)',  // green
  'hsl(0, 60%, 50%)',    // red
  'hsl(220, 60%, 55%)',  // indigo
  'hsl(330, 55%, 50%)',  // pink
];

const SENDER_BG_COLORS = [
  'hsl(210, 70%, 95%)',
  'hsl(340, 65%, 95%)',
  'hsl(160, 60%, 93%)',
  'hsl(270, 55%, 95%)',
  'hsl(25, 75%, 95%)',
  'hsl(190, 65%, 93%)',
  'hsl(45, 70%, 93%)',
  'hsl(300, 50%, 95%)',
  'hsl(140, 55%, 93%)',
  'hsl(0, 60%, 95%)',
  'hsl(220, 60%, 95%)',
  'hsl(330, 55%, 95%)',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getColorForName(name: string): string {
  return SENDER_COLORS[hashString(name) % SENDER_COLORS.length];
}

export function getBgColorForName(name: string): string {
  return SENDER_BG_COLORS[hashString(name) % SENDER_BG_COLORS.length];
}

/** Generate a gradient for avatar backgrounds based on name */
export function getAvatarGradient(name: string): string {
  const idx = hashString(name) % SENDER_COLORS.length;
  const nextIdx = (idx + 1) % SENDER_COLORS.length;
  return `linear-gradient(135deg, ${SENDER_COLORS[idx]}, ${SENDER_COLORS[nextIdx]})`;
}
