// High-Resolution Canvas 2D Renderer for Certificates & WhatsApp Wrapped Cards
// Zero external dependencies — works reliably on iOS Safari, Android Chrome, and Desktop

import uceLogoAssetUrl from '../assets/images/uce-logo.jpg';

export const LOGO_STYLE_OPTIONS = [
  {
    id: 'v1-side-portrait',
    label: '🖼️ 1D: Side Portrait + Open Center (Selected ★)',
    shortLabel: '1D: Side Portrait (Open Center)',
    desc: 'Moves the member photo circle to the upper-right wing, leaving the entire center watermark 100% unobstructed from top to bottom.',
  },
  {
    id: 'hybrid',
    label: '✨ 1A: Watermark Below Photo',
    shortLabel: '1A: Watermark Below Photo',
    desc: 'Keeps dummy/member photo in center and shifts watermark down so Maa Saraswati’s face shines clearly below the photo circle.',
  },
  {
    id: 'v1-halo-gap',
    label: '🌟 1B: Dedicated Open Window for Face',
    shortLabel: '1B: Open Window for Face',
    desc: 'Creates a dedicated open sky gap directly below the photo circle so neither the photo circle nor any text touches the goddess’s face.',
  },
  {
    id: 'v1-face-above',
    label: '👑 1C: Goddess Halo Above Photo Circle',
    shortLabel: '1C: Face Above Photo Circle',
    desc: 'Raises the watermark and shifts the photo circle slightly lower so Maa Saraswati’s face & halo glow above the member portrait.',
  },
];

export const SIGNATURE_STYLE_OPTIONS = [
  {
    id: 'sig-undas-exec',
    label: '✒️ S1: Cursive "U. N. Das" + Classic Flourish',
    shortLabel: 'S1: Cursive "U. N. Das"',
    desc: 'Flowing calligraphic "U. N. Das" with an executive loop underline flourish and two ink dots; "UDAYA NARAYAN DAS" printed below.',
  },
  {
    id: 'sig-udaya-full',
    label: '📜 S2: Full Cursive "Udaya Narayan Das"',
    shortLabel: 'S2: Full "Udaya Narayan Das"',
    desc: 'Full-name calligraphic script "Udaya Narayan Das" with a graceful tapered S-curve underline swoop.',
  },
  {
    id: 'sig-udaya-mid',
    label: '👑 S3: Presidential "Udaya N. Das"',
    shortLabel: 'S3: "Udaya N. Das"',
    desc: 'Balanced executive signature "Udaya N. Das" with an ascending tail loop and double fountain-pen dots.',
  },
  {
    id: 'sig-undas-autograph',
    label: '⚡ S4: Hand-Drawn Autograph "UNDas"',
    shortLabel: 'S4: Fast Autograph "UNDas"',
    desc: 'Continuous-stroke vector fountain-pen CEO autograph "UNDas" with a bold upward slash and ink dot.',
  },
  {
    id: 'sig-platinum-full',
    label: '✨ S5: Champagne-Platinum "Udaya Narayan Das"',
    shortLabel: 'S5: Platinum Ink Full Name',
    desc: 'Bright pearl-champagne fountain-pen ink "Udaya Narayan Das" with royal quill flourish for high contrast over the gold line.',
  },
];

let cachedLogoPromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function getUceLogoImage(customLogoSrc = null) {
  if (customLogoSrc) {
    try {
      return await loadImage(customLogoSrc);
    } catch {
      // fall through
    }
  }
  if (!cachedLogoPromise) {
    cachedLogoPromise = loadImage(uceLogoAssetUrl || '/uce-logo.jpg').catch(() =>
      loadImage('/uce-logo.jpg').catch(() => null)
    );
  }
  return cachedLogoPromise;
}

/**
 * Renders the rectangular UCE Saraswati logo onto an offscreen square canvas
 * with an elliptical radial alpha feather so that:
 * 1) Both Maa Saraswati's halo at the top and "Ultimate Challenge EXPERIENCE" at the bottom fit inside.
 * 2) All 4 rectangular edges fade smoothly to 0 alpha before the image boundary (zero hard seams).
 */
function createFeatheredLogoCanvas(logoImg, diameter) {
  const off = document.createElement('canvas');
  off.width = diameter;
  off.height = diameter;
  const octx = off.getContext('2d');

  const cx = diameter / 2;
  const cy = diameter / 2;

  const drawH = diameter * 0.96;
  const drawW = drawH * (logoImg.width / logoImg.height);
  octx.drawImage(logoImg, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

  const rx = (drawW / 2) * 0.96;
  const ry = (drawH / 2) * 0.97;
  octx.save();
  octx.globalCompositeOperation = 'destination-in';
  octx.translate(cx, cy);
  octx.scale(rx, ry);
  const maskGrad = octx.createRadialGradient(0, 0, 0.52, 0, 0, 1.0);
  maskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  maskGrad.addColorStop(0.72, 'rgba(0, 0, 0, 0.92)');
  maskGrad.addColorStop(0.88, 'rgba(0, 0, 0, 0.45)');
  maskGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  octx.fillStyle = maskGrad;
  octx.beginPath();
  octx.arc(0, 0, 1.05, 0, Math.PI * 2);
  octx.fill();
  octx.restore();

  return off;
}

/**
 * Draws a large, soft circular background watermark of the UCE logo.
 */
function drawUceLogoWatermark(ctx, logoImg, cx, cy, radius, opacity = 0.20) {
  if (!logoImg) return;
  ctx.save();

  const glow = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 1.05);
  glow.addColorStop(0, `rgba(197, 160, 89, ${opacity * 0.42})`);
  glow.addColorStop(0.65, `rgba(197, 160, 89, ${opacity * 0.16})`);
  glow.addColorStop(1, 'rgba(197, 160, 89, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
  ctx.fill();

  const feathered = createFeatheredLogoCanvas(logoImg, Math.round(radius * 2));

  // Soft source-over body
  ctx.globalAlpha = opacity * 0.35;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(feathered, cx - radius, cy - radius, radius * 2, radius * 2);

  // Screen blend so golden rays & Saraswati illuminate without darkening the blue canvas
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(feathered, cx - radius, cy - radius, radius * 2, radius * 2);

  // Delicate circular watermark filigree ring
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = `rgba(243, 216, 140, ${Math.min(opacity * 0.85, 0.22)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.93, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([8, 10]);
  ctx.strokeStyle = `rgba(197, 160, 89, ${Math.min(opacity * 0.65, 0.16)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.97, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

/**
 * Draws a crisp, full-color circular gold-rimmed medallion featuring the UCE Saraswati logo.
 */
function drawUceLogoMedallion(
  ctx,
  logoImg,
  cx,
  cy,
  radius,
  { showOuterRays = true, showDots = true, ribbonText = null } = {}
) {
  if (!logoImg) return;
  ctx.save();

  if (showOuterRays) {
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.32);
    grad.addColorStop(0, 'rgba(243, 216, 140, 0.38)');
    grad.addColorStop(1, 'rgba(197, 160, 89, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.32, 0, Math.PI * 2);
    ctx.fill();
  }

  if (showDots) {
    const numDots = 28;
    const dotOffset = Math.max(Math.round(radius * 0.13), 8);
    for (let i = 0; i < numDots; i++) {
      const angle = (i / numDots) * Math.PI * 2;
      const dx = cx + Math.cos(angle) * (radius + dotOffset);
      const dy = cy + Math.sin(angle) * (radius + dotOffset);
      ctx.fillStyle = i % 2 === 0 ? '#f3d88c' : '#c5a059';
      ctx.beginPath();
      ctx.arc(
        dx,
        dy,
        i % 2 === 0 ? Math.max(radius * 0.036, 2.2) : Math.max(radius * 0.022, 1.5),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  const borderPad = Math.max(Math.round(radius * 0.065), 4);
  const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ringGrad.addColorStop(0, '#fff2b2');
  ringGrad.addColorStop(0.5, '#c5a059');
  ringGrad.addColorStop(1, '#7a581b');
  ctx.beginPath();
  ctx.arc(cx, cy, radius + borderPad, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  const innerBg = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  innerBg.addColorStop(0, '#2b1704');
  innerBg.addColorStop(0.65, '#120a02');
  innerBg.addColorStop(1, '#070503');
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = innerBg;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1.5, 0, Math.PI * 2);
  ctx.clip();
  const feathered = createFeatheredLogoCanvas(logoImg, Math.round(radius * 2.04));
  ctx.drawImage(feathered, cx - radius * 1.02, cy - radius * 1.02, radius * 2.04, radius * 2.04);
  ctx.restore();

  ctx.strokeStyle = 'rgba(249, 228, 152, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
  ctx.stroke();

  if (ribbonText) {
    ctx.font = `bold ${Math.max(Math.round(radius * 0.2), 13)}px Arial, sans-serif`;
    const rw = Math.max(ctx.measureText(ribbonText).width + 28, radius * 1.35);
    const rh = Math.max(Math.round(radius * 0.32), 22);
    const rx = cx - rw / 2;
    const ry = cy + radius - rh * 0.55;
    drawRoundedRect(ctx, rx, ry, rw, rh, rh / 2);
    ctx.fillStyle = '#09132c';
    ctx.fill();
    ctx.strokeStyle = '#f3d88c';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#f3d88c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ribbonText, cx, ry + rh / 2 + 1);
  }

  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ');
  let line = '';
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  if (line.trim()) lines.push(line.trim());
  lines.forEach((l, i) => {
    ctx.fillText(l, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCornerOrnament(ctx, x, y, size, flipX = 1, flipY = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX, flipY);
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14, size * 0.75);
  ctx.lineTo(14, 14);
  ctx.lineTo(size * 0.75, 14);
  ctx.stroke();

  ctx.fillStyle = '#e6c67c';
  ctx.beginPath();
  ctx.moveTo(26, 18);
  ctx.lineTo(34, 26);
  ctx.lineTo(26, 34);
  ctx.lineTo(18, 26);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws the Organizer's handwritten cursive signature & flourish above the signature line,
 * plus the formal printed name and title below the line.
 * Defaults to Option S2 ("Udaya Narayan Das" cursive script).
 */
function drawOrganizerSignature(ctx, cx, footY, sigStyle = 'sig-udaya-full') {
  ctx.save();

  // 1. Horizontal Gold Signature Rule
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 215, footY);
  ctx.lineTo(cx + 215, footY);
  ctx.stroke();

  const cursiveFontStack =
    '"Snell Roundhand", "Great Vibes", "Alex Brush", "Apple Chancery", "Brush Script MT", "Segoe Script", cursive, "Playfair Display", Georgia, serif';

  const goldInkGrad = ctx.createLinearGradient(cx - 160, footY - 75, cx + 160, footY - 5);
  if (sigStyle === 'sig-platinum-full') {
    goldInkGrad.addColorStop(0, '#ffffff');
    goldInkGrad.addColorStop(0.5, '#fef08a');
    goldInkGrad.addColorStop(1, '#f3d88c');
  } else {
    goldInkGrad.addColorStop(0, '#fff4b8');
    goldInkGrad.addColorStop(0.5, '#f3d88c');
    goldInkGrad.addColorStop(1, '#d4af37');
  }

  // Subtle ink depth shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  if (sigStyle === 'sig-undas-exec') {
    // S1: Cursive "U. N. Das" with classic executive loop underline flourish + 2 dots
    ctx.save();
    ctx.translate(cx, footY - 34);
    ctx.transform(1, -0.06, -0.22, 1, 0, 0);
    ctx.font = `italic bold 50px ${cursiveFontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = goldInkGrad;
    ctx.fillText('U. N. Das', 0, 0);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(255, 244, 184, 0.55)';
    ctx.strokeText('U. N. Das', 0, 0);
    ctx.restore();

    // Executive fountain-pen loop flourish beneath "U. N. Das"
    ctx.strokeStyle = goldInkGrad;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx + 88, footY - 26);
    ctx.bezierCurveTo(cx + 135, footY - 22, cx + 95, footY - 4, cx - 15, footY - 9);
    ctx.bezierCurveTo(cx - 95, footY - 13, cx - 130, footY - 5, cx - 85, footY - 19);
    ctx.bezierCurveTo(cx - 35, footY - 30, cx + 65, footY - 16, cx + 135, footY - 12);
    ctx.stroke();

    // Two classic fountain-pen dots below the flourish
    ctx.fillStyle = '#f3d88c';
    ctx.beginPath();
    ctx.arc(cx + 12, footY - 4, 2.2, 0, Math.PI * 2);
    ctx.arc(cx + 26, footY - 5, 2.0, 0, Math.PI * 2);
    ctx.fill();
  } else if (sigStyle === 'sig-udaya-full' || sigStyle === 'sig-platinum-full') {
    // S2 & S5: Flowing Full-Name Calligraphic "Udaya Narayan Das" + Tapered Swoop
    const isPlat = sigStyle === 'sig-platinum-full';
    ctx.save();
    ctx.translate(cx, footY - 33);
    ctx.transform(1, isPlat ? -0.055 : -0.045, isPlat ? -0.24 : -0.19, 1, 0, 0);
    ctx.font = `italic ${isPlat ? 'bold ' : ''}41px ${cursiveFontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = goldInkGrad;
    ctx.fillText('Udaya Narayan Das', 0, 0);
    ctx.lineWidth = isPlat ? 1.1 : 0.7;
    ctx.strokeStyle = isPlat ? 'rgba(255, 255, 255, 0.65)' : 'rgba(243, 216, 140, 0.45)';
    ctx.strokeText('Udaya Narayan Das', 0, 0);
    ctx.restore();

    // Graceful S-curve underline flourish
    ctx.strokeStyle = goldInkGrad;
    ctx.lineCap = 'round';
    ctx.lineWidth = isPlat ? 2.5 : 2.2;
    ctx.beginPath();
    if (isPlat) {
      ctx.moveTo(cx - 145, footY - 10);
      ctx.bezierCurveTo(cx - 40, footY - 24, cx + 65, footY - 6, cx + 165, footY - 20);
      ctx.bezierCurveTo(cx + 185, footY - 23, cx + 150, footY - 6, cx + 95, footY - 7);
    } else {
      ctx.moveTo(cx - 120, footY - 11);
      ctx.bezierCurveTo(cx - 20, footY - 20, cx + 70, footY - 7, cx + 155, footY - 16);
    }
    ctx.stroke();
  } else if (sigStyle === 'sig-udaya-mid') {
    // S3: Presidential "Udaya N. Das" with ascending tail loop + double dots
    ctx.save();
    ctx.translate(cx, footY - 34);
    ctx.transform(1, -0.055, -0.21, 1, 0, 0);
    ctx.font = `italic bold 45px ${cursiveFontStack}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = goldInkGrad;
    ctx.fillText('Udaya N. Das', 0, 0);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255, 244, 184, 0.5)';
    ctx.strokeText('Udaya N. Das', 0, 0);
    ctx.restore();

    ctx.strokeStyle = goldInkGrad;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + 118, footY - 26);
    ctx.bezierCurveTo(cx + 155, footY - 28, cx + 140, footY - 8, cx + 30, footY - 10);
    ctx.bezierCurveTo(cx - 60, footY - 12, cx - 125, footY - 8, cx - 145, footY - 14);
    ctx.stroke();

    ctx.fillStyle = '#f3d88c';
    ctx.beginPath();
    ctx.arc(cx - 10, footY - 4, 2.1, 0, Math.PI * 2);
    ctx.arc(cx + 6, footY - 5, 2.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (sigStyle === 'sig-undas-autograph') {
    // S4: Pure Hand-Drawn Vector Fountain-Pen Autograph "UNDas" + Bold Slash
    ctx.strokeStyle = goldInkGrad;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Connected U -> N -> D monogram + rapid 'as'
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    // Capital U
    ctx.moveTo(cx - 115, footY - 64);
    ctx.bezierCurveTo(cx - 125, footY - 58, cx - 122, footY - 18, cx - 100, footY - 20);
    ctx.bezierCurveTo(cx - 82, footY - 22, cx - 76, footY - 56, cx - 72, footY - 62);
    // Downstroke of U into N
    ctx.bezierCurveTo(cx - 76, footY - 36, cx - 74, footY - 20, cx - 64, footY - 24);
    ctx.bezierCurveTo(cx - 56, footY - 28, cx - 52, footY - 58, cx - 46, footY - 60);
    ctx.bezierCurveTo(cx - 40, footY - 56, cx - 36, footY - 22, cx - 28, footY - 24);
    ctx.bezierCurveTo(cx - 18, footY - 26, cx - 12, footY - 66, cx - 2, footY - 68);
    // Tall looped D
    ctx.bezierCurveTo(cx - 8, footY - 46, cx - 12, footY - 18, cx - 4, footY - 18);
    ctx.bezierCurveTo(cx + 22, footY - 16, cx + 32, footY - 48, cx + 10, footY - 64);
    ctx.bezierCurveTo(cx - 8, footY - 74, cx - 16, footY - 52, cx + 18, footY - 34);
    // Rapid 'as' wave + trailing tail
    ctx.bezierCurveTo(cx + 32, footY - 26, cx + 38, footY - 38, cx + 48, footY - 28);
    ctx.bezierCurveTo(cx + 56, footY - 22, cx + 64, footY - 38, cx + 76, footY - 26);
    ctx.bezierCurveTo(cx + 88, footY - 18, cx + 115, footY - 28, cx + 145, footY - 42);
    ctx.stroke();

    // Dramatic executive diagonal-horizontal underline slash
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - 130, footY - 8);
    ctx.bezierCurveTo(cx - 30, footY - 14, cx + 60, footY - 18, cx + 150, footY - 22);
    ctx.stroke();

    ctx.fillStyle = '#f3d88c';
    ctx.beginPath();
    ctx.arc(cx + 15, footY - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Formal Printed Name & Organizer Title Below the Signature Line
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText('U D A Y A   N A R A Y A N   D A S   ( U .  N .  D A S )', cx, footY + 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('ORGANIZER • ORGANIZING COMMITTEE • UCE BURLA BATCH OF 1987', cx, footY + 50);

  ctx.restore();
}

/**
 * Draws a royal portrait frame with either the uploaded member photo OR a dummy person
 * silhouette placeholder so the user always knows they can upload their own profile photo.
 */
function drawRoyalCrestOrPhoto(
  ctx,
  cx,
  cy,
  radius,
  photoImg,
  badgeLabel = 'UCE 87',
  { logoImg = null, showCornerLogoBadge = false } = {}
) {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.28);
  grad.addColorStop(0, 'rgba(197, 160, 89, 0.35)');
  grad.addColorStop(1, 'rgba(197, 160, 89, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.28, 0, Math.PI * 2);
  ctx.fill();

  const numDots = 28;
  for (let i = 0; i < numDots; i++) {
    const angle = (i / numDots) * Math.PI * 2;
    const dx = cx + Math.cos(angle) * (radius + 14);
    const dy = cy + Math.sin(angle) * (radius + 14);
    ctx.fillStyle = i % 2 === 0 ? '#f3d88c' : '#c5a059';
    ctx.beginPath();
    ctx.arc(dx, dy, i % 2 === 0 ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ringGrad.addColorStop(0, '#f9e498');
  ringGrad.addColorStop(0.5, '#c5a059');
  ringGrad.addColorStop(1, '#8c6928');
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0c1938';
  ctx.fill();

  if (photoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.clip();
    const iw = photoImg.width;
    const ih = photoImg.height;
    const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(photoImg, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    // Dummy Person Avatar Silhouette inside the circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    const avatarBg = ctx.createRadialGradient(cx, cy - radius * 0.15, radius * 0.1, cx, cy, radius);
    avatarBg.addColorStop(0, '#1e3a6e');
    avatarBg.addColorStop(1, '#09132c');
    ctx.fillStyle = avatarBg;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const silGrad = ctx.createLinearGradient(cx, cy - radius * 0.55, cx, cy + radius * 0.85);
    silGrad.addColorStop(0, 'rgba(243, 216, 140, 0.82)');
    silGrad.addColorStop(1, 'rgba(197, 160, 89, 0.45)');
    ctx.fillStyle = silGrad;

    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.22, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Shoulders
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.68, radius * 0.58, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineTo(cx + radius * 0.54, cy + radius);
    ctx.lineTo(cx - radius * 0.54, cy + radius);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(243, 216, 140, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const pillText = photoImg ? badgeLabel : `📷 ${badgeLabel}`;
  ctx.font = `bold ${Math.max(Math.round(radius * 0.2), 14)}px Arial, sans-serif`;
  const rw = Math.max(ctx.measureText(pillText).width + 26, radius * 1.3);
  const rh = Math.max(Math.round(radius * 0.32), 24);
  const rx = cx - rw / 2;
  const ry = cy + radius - rh * 0.55;
  drawRoundedRect(ctx, rx, ry, rw, rh, rh / 2);
  ctx.fillStyle = '#09132c';
  ctx.fill();
  ctx.strokeStyle = '#f3d88c';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, cx, ry + rh / 2 + 1);

  if (showCornerLogoBadge && logoImg) {
    const badgeR = Math.round(radius * 0.42);
    drawUceLogoMedallion(
      ctx,
      logoImg,
      cx + radius * 0.76,
      cy - radius * 0.62,
      badgeR,
      { showOuterRays: false, showDots: false }
    );
  }

  ctx.restore();
}

export async function renderCertificateToDataUrl({
  player,
  certType = 'award', // 'award' | 'participation'
  awardIndex = 0,
  award = null,
  photoDataUrl = null,
  logoStyle = 'v1-side-portrait', // Default locked to Option 1D (unobstructed center watermark + top-right member portrait)
  signatureStyle = 'sig-udaya-full', // Default locked to Option S2 ("Udaya Narayan Das" cursive script + flourish)
  customLogoSrc = null,
}) {
  const canvas = document.createElement('canvas');
  const W = 2000;
  const H = 1414;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const [photoImg, logoImg] = await Promise.all([
    photoDataUrl
      ? loadImage(photoDataUrl).catch(() => null)
      : Promise.resolve(null),
    logoStyle !== 'none' ? getUceLogoImage(customLogoSrc) : Promise.resolve(null),
  ]);

  const isAward = certType === 'award' && player?.awards?.length > 0;
  const activeAward = isAward ? (award || player.awards[awardIndex] || player.awards[0]) : null;

  // 1. Deep Royal Midnight Blue Background
  const bgGrad = ctx.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H / 2, W * 0.75);
  bgGrad.addColorStop(0, '#132347');
  bgGrad.addColorStop(0.55, '#0a1329');
  bgGrad.addColorStop(1, '#050914');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative background rings
  ctx.strokeStyle = 'rgba(197, 160, 89, 0.04)';
  ctx.lineWidth = 2;
  for (let r = 250; r <= 950; r += 140) {
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  let wmCenterY = 630;
  let wmRadius = 465;
  let crestX = 1695;
  let crestY = 385;
  let crestR = 90;
  let presentedY = 505;
  let nameY = 585;
  let nameLineY = 612;
  let plaqueY = 648;
  let plaqueH = 82;
  let citationY = 795;
  let statsY = 960;

  if (logoStyle === 'hybrid') {
    wmCenterY = 825;
    wmRadius = 435;
    crestX = W / 2;
    crestY = 368;
    crestR = 84;
    presentedY = 535;
    nameY = 612;
    nameLineY = 636;
    plaqueY = 666;
    plaqueH = 80;
    citationY = 806;
    statsY = 965;
  } else if (logoStyle === 'v1-halo-gap') {
    crestX = W / 2;
    crestY = 346;
    crestR = 76;
    wmCenterY = 805;
    wmRadius = 430;
    presentedY = 588;
    nameY = 656;
    nameLineY = 678;
    plaqueY = 702;
    plaqueH = 78;
    citationY = 828;
    statsY = 972;
  } else if (logoStyle === 'v1-face-above') {
    wmCenterY = 620;
    wmRadius = 460;
    crestX = W / 2;
    crestY = 490;
    crestR = 74;
    presentedY = 612;
    nameY = 678;
    nameLineY = 698;
    plaqueY = 720;
    plaqueH = 76;
    citationY = 840;
    statsY = 975;
  }

  if (logoImg && logoStyle !== 'none') {
    drawUceLogoWatermark(ctx, logoImg, W / 2, wmCenterY, wmRadius, 0.20);
  }

  // 2. Ornate Gold Borders
  const pad = 48;
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 4;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  ctx.strokeStyle = 'rgba(243, 216, 140, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad + 14, pad + 14, W - (pad + 14) * 2, H - (pad + 14) * 2);

  drawCornerOrnament(ctx, pad + 8, pad + 8, 90, 1, 1);
  drawCornerOrnament(ctx, W - pad - 8, pad + 8, 90, -1, 1);
  drawCornerOrnament(ctx, pad + 8, H - pad - 8, 90, 1, -1);
  drawCornerOrnament(ctx, W - pad - 8, H - pad - 8, 90, -1, -1);

  // 3. Top Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c5a059';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText(
    '✦   U C E  ’ 8 7   A L U M N I   Q U I Z   C L U B   •   T H E   U L T I M A T E   C H A L L E N G E   E X P E R I E N C E   ✦',
    W / 2,
    120
  );

  // Main Certificate Title
  const titleY = 198;
  const titleGrad = ctx.createLinearGradient(W * 0.25, titleY - 55, W * 0.75, titleY + 15);
  titleGrad.addColorStop(0, '#f3d88c');
  titleGrad.addColorStop(0.5, '#ffffff');
  titleGrad.addColorStop(1, '#f3d88c');
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 62px Georgia, serif';
  ctx.fillText(
    isAward ? 'CERTIFICATE OF EXCELLENCE' : 'CERTIFICATE OF APPRECIATION',
    W / 2,
    titleY
  );

  // Subtitle pill
  const pillY = 224;
  const pillText = isAward
    ? `${activeAward.tier.toUpperCase()}  •  40-WEEK GRAND FINALE (2026)`
    : 'OFFICIAL CONTENDER & SEASON FINISHER  •  40-WEEK GRAND FINALE (2026)';
  ctx.font = 'bold 20px Arial, sans-serif';
  const pillW = Math.max(ctx.measureText(pillText).width + 70, 560);
  drawRoundedRect(ctx, W / 2 - pillW / 2, pillY, pillW, 40, 20);
  ctx.fillStyle = 'rgba(197, 160, 89, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.fillText(pillText, W / 2, pillY + 27);

  // 4. Member Photo or Dummy Person Silhouette Circle
  drawRoyalCrestOrPhoto(
    ctx,
    crestX,
    crestY,
    crestR,
    photoImg,
    isAward ? 'HONOREE' : 'UCE 87'
  );

  // 5. "PROUDLY PRESENTED TO" & Member Name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('This certificate is proudly presented to', W / 2, presentedY);

  const nameGrad = ctx.createLinearGradient(W * 0.3, nameY - 55, W * 0.7, nameY + 15);
  nameGrad.addColorStop(0, '#f9e498');
  nameGrad.addColorStop(0.5, '#ffd700');
  nameGrad.addColorStop(1, '#d4af37');
  ctx.fillStyle = nameGrad;
  ctx.font = 'bold 68px Georgia, serif';
  ctx.fillText(player.realName || player.displayName, W / 2, nameY);

  // Decorative underline beneath name
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 340, nameLineY);
  ctx.lineTo(W / 2 + 340, nameLineY);
  ctx.stroke();

  // 6. Award Title Plaque OR Contender Title Plaque
  const plaqueW = 1320;
  drawRoundedRect(ctx, W / 2 - plaqueW / 2, plaqueY, plaqueW, plaqueH, 16);
  const plaqueGrad = ctx.createLinearGradient(W / 2 - plaqueW / 2, plaqueY, W / 2 + plaqueW / 2, plaqueY);
  plaqueGrad.addColorStop(0, 'rgba(197, 160, 89, 0.08)');
  plaqueGrad.addColorStop(0.5, 'rgba(197, 160, 89, 0.24)');
  plaqueGrad.addColorStop(1, 'rgba(197, 160, 89, 0.08)');
  ctx.fillStyle = plaqueGrad;
  ctx.fill();
  ctx.strokeStyle = '#e6c67c';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Georgia, serif';
  const mainAwardTitle = isAward
    ? `🏆  ${activeAward.title.toUpperCase()}`
    : `🎖️  DISTINGUISHED CONTENDER  •  ${player.persona.toUpperCase()}`;
  ctx.fillText(mainAwardTitle, W / 2, plaqueY + 50);

  // 7. Citation Text
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '27px Georgia, serif';
  const citationText = isAward ? activeAward.citation : player.participationCitation;
  wrapText(ctx, citationText, W / 2, citationY, 1460, 42);

  // 8. Verified Performance Stats Row (5 Translucent Glass Stat Boxes)
  const boxW = 265;
  const boxH = 114;
  const gap = 24;
  const statsItems = [
    {
      label: 'PURE QUIZ SCORE',
      value: player.weeksPlayed > 0 ? `${player.pureScore} Pts` : `${player.pilotScore || 0}/10 (Pilot)`,
    },
    {
      label: 'QUIZZES PLAYED',
      value: player.weeksPlayed > 0 ? `${player.weeksPlayed} / 40` : 'Pilot Pioneer',
    },
    {
      label: 'SEASON AVERAGE',
      value: player.weeksPlayed > 0 ? `${player.avgScore} / 10` : `${player.pilotScore || 0} / 10`,
    },
    {
      label: 'AVERAGE SPEED',
      value: player.weeksPlayed > 0 ? `${player.avgTime}s` : `${player.pilotTime || 0}s`,
    },
    {
      label: isAward && player.count10 > 0 ? 'PERFECT 10/10s' : 'BEST PERFORMANCE',
      value:
        player.count10 > 0
          ? `${player.count10} Quizzes`
          : `${player.maxScore}/10 (${player.fastestTime || player.pilotTime || 0}s)`,
    },
  ];

  const totalStatsW = statsItems.length * boxW + (statsItems.length - 1) * gap;
  let startX = W / 2 - totalStatsW / 2;

  statsItems.forEach((st) => {
    drawRoundedRect(ctx, startX, statsY, boxW, boxH, 14);
    ctx.fillStyle = 'rgba(12, 23, 52, 0.58)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(st.label, startX + boxW / 2, statsY + 36);

    ctx.fillStyle = '#f3d88c';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(st.value, startX + boxW / 2, statsY + 84);

    startX += boxW + gap;
  });

  // 9. Footer Signatures & Official UCE Logo Seal
  const footY = 1225;

  // Left Organizer Cursive Signature + Printed Name
  drawOrganizerSignature(ctx, 430, footY, signatureStyle);

  // Center Official Gold Seal with Full-Color UCE Saraswati Logo
  if (logoImg && logoStyle !== 'none') {
    drawUceLogoMedallion(ctx, logoImg, W / 2, footY - 18, 72, {
      showOuterRays: true,
      showDots: true,
      ribbonText: '40 WEEKS • 2026',
    });
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, footY - 15, 58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(197, 160, 89, 0.2)';
    ctx.fill();
    ctx.strokeStyle = '#f3d88c';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#f3d88c';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('OFFICIAL SEAL', W / 2, footY - 26);
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('40 WEEKS', W / 2, footY - 2);
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('JAN – NOV 2026', W / 2, footY + 20);
    ctx.restore();
  }

  // Right date & verification (balanced two-line caption matching left signature block)
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W - 645, footY);
  ctx.lineTo(W - 215, footY);
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('November 2026 • Quiz 40 Finale', W - 430, footY - 22);

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.fillText(
    player.rank ? `OFFICIAL SEASON RANK #${player.rank}` : 'OFFICIAL PIONEER RECORD',
    W - 430,
    footY + 26
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('VERIFIED PURE SCORE • UCE-QUIZ.WEB.APP', W - 430, footY + 50);

  return canvas.toDataURL('image/png');
}

export async function renderWrappedCardToDataUrl({
  player,
  photoDataUrl = null,
  logoStyle = 'v1-side-portrait',
  customLogoSrc = null,
}) {
  const canvas = document.createElement('canvas');
  const W = 1080;
  const H = 1620;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const [photoImg, logoImg] = await Promise.all([
    photoDataUrl
      ? loadImage(photoDataUrl).catch(() => null)
      : Promise.resolve(null),
    logoStyle !== 'none' ? getUceLogoImage(customLogoSrc) : Promise.resolve(null),
  ]);

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#09132c');
  bg.addColorStop(0.5, '#132550');
  bg.addColorStop(1, '#060c1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (logoImg && logoStyle !== 'none') {
    const wmY = logoStyle === 'v1-halo-gap' ? 840 : logoStyle === 'v1-face-above' ? 870 : 910;
    drawUceLogoWatermark(ctx, logoImg, W / 2, wmY, 425, 0.22);
  }

  // Border
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('✨  U C E  ’ 8 7   Q U I Z   R E W I N D   2 0 2 6  ✨', W / 2, 100);

  // Dummy Person Silhouette or Uploaded Photo + Corner UCE Medallion Badge
  drawRoyalCrestOrPhoto(
    ctx,
    W / 2,
    240,
    92,
    photoImg,
    player.rank ? `RANK #${player.rank}` : 'UCE 87',
    {
      logoImg,
      showCornerLogoBadge: Boolean(logoImg && logoStyle !== 'none'),
    }
  );

  // Name & Persona
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText(player.realName || player.displayName, W / 2, 412);

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillText(player.persona, W / 2, 462);

  // Special Award Banner if any
  const topAward = player.awards?.[0];
  drawRoundedRect(ctx, 80, 498, W - 160, 102, 18);
  ctx.fillStyle = 'rgba(197, 160, 89, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText(topAward ? 'SPECIAL SEASON HONOR' : '2026 CONTENDER MILESTONE', W / 2, 533);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(
    topAward ? `🏆 ${topAward.title}` : `🎖️ Official 2026 Season Contender (${player.maxScore}/10 Best)`,
    W / 2,
    577
  );

  // 6-Card Bento Grid (Translucent glass so watermark face & UCE emblem shine through)
  const grid = [
    { label: 'PURE SCORE', val: `${player.pureScore} Pts`, sub: player.rank ? `Overall Rank #${player.rank}` : 'Pilot Pioneer' },
    { label: 'QUIZZES PLAYED', val: `${player.weeksPlayed} / 40`, sub: `Max Streak: ${player.maxAttStreak} Wks` },
    { label: 'SEASON AVG', val: `${player.avgScore} / 10`, sub: `Best: ${player.maxScore} / 10` },
    { label: 'AVG SPEED', val: `${player.avgTime}s`, sub: `Fastest: ${player.fastestTime || player.pilotTime || 0}s` },
    { label: '10/10 & 9+ CLUB', val: `${player.count10}x 10/10`, sub: `${player.count9Plus}x Scored 9 or 10` },
    { label: 'WEEKLY MEDALS', val: `${player.podiums} Podiums`, sub: `${player.gold}🥇  ${player.silver}🥈  ${player.bronze}🥉` },
  ];

  const cardW = 445;
  const cardH = 162;
  const startY = logoStyle === 'v1-halo-gap' ? 675 : 645;
  grid.forEach((g, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 80 + col * (cardW + 30);
    const y = startY + row * (cardH + 22);

    drawRoundedRect(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(9, 19, 44, 0.56)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(g.label, x + cardW / 2, y + 40);

    ctx.fillStyle = '#f3d88c';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(g.val, x + cardW / 2, y + 96);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(g.sub, x + cardW / 2, y + 136);
  });

  // 40-Week Mini Trajectory Chart
  const chartX = 80;
  const chartY = logoStyle === 'v1-halo-gap' ? 1245 : 1235;
  const chartW = W - 160;
  const chartH = 215;
  drawRoundedRect(ctx, chartX, chartY, chartW, chartH, 16);
  ctx.fillStyle = 'rgba(9, 19, 44, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('40-WEEK SCORE TRAJECTORY (QUIZ 1 TO QUIZ 40)', W / 2, chartY + 36);

  const barAreaX = chartX + 32;
  const barAreaY = chartY + 58;
  const barAreaW = chartW - 64;
  const barAreaH = 126;
  const bw = barAreaW / 40;

  (player.weeklyJourney || []).forEach((wj, i) => {
    const bx = barAreaX + i * bw + 2;
    const wBar = Math.max(bw - 4, 4);
    if (wj.played && wj.score !== null) {
      const hBar = Math.max((wj.score / 10) * barAreaH, 8);
      ctx.fillStyle = wj.score === 10 ? '#10b981' : wj.score >= 8 ? '#f3d88c' : '#60a5fa';
      ctx.fillRect(bx, barAreaY + barAreaH - hBar, wBar, hBar);
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.fillRect(bx, barAreaY + barAreaH - 6, wBar, 6);
    }
  });

  // Footer
  ctx.fillStyle = '#c5a059';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('UCE ’87 ULTIMATE CHALLENGE EXPERIENCE  •  40 WEEKS OF BRILLIANCE (2026)', W / 2, 1535);

  return canvas.toDataURL('image/png');
}
