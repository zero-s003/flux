const FONT_STACK = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif';

/**
 * Rasterise a string to an offscreen canvas and scatter `count` points across
 * its opaque pixels. Returns a flat xyz Float32Array in world units, or null if
 * nothing was drawn.
 */
export function sampleTextPoints(text, options = {}) {
  const {
    width = 1024,
    height = 512,
    fontSize = 400,
    fontWeight = 600,
    count = 9000,
    worldWidth = 9.2,
    offsetX = 0,
    offsetY = 0,
    letterSpacing = 0,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${fontWeight} ${fontSize}px ${FONT_STACK}`;

  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`;
  }

  ctx.fillText(text, width / 2, height / 2);

  const data = ctx.getImageData(0, 0, width, height).data;
  const opaque = [];

  // Full resolution: the extra candidates give the glyph cleaner edges.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 140) {
        opaque.push(x, y);
      }
    }
  }

  if (opaque.length === 0) return null;

  const total = opaque.length / 2;
  const scale = worldWidth / width;
  const jitter = 0.0009 * worldWidth;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const pick = Math.floor(Math.random() * total);
    const px = opaque[pick * 2] + (Math.random() - 0.5) * 2;
    const py = opaque[pick * 2 + 1] + (Math.random() - 0.5) * 2;

    positions[i * 3] = (px - width / 2) * scale + offsetX + (Math.random() - 0.5) * jitter;
    positions[i * 3 + 1] = -(py - height / 2) * scale + offsetY + (Math.random() - 0.5) * jitter;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
  }

  return positions;
}
