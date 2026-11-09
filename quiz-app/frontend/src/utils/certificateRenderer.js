// High-Resolution Canvas 2D Renderer for Certificates & WhatsApp Wrapped Cards
// Zero external dependencies — works reliably on iOS Safari, Android Chrome, and Desktop

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
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

  // Corner diamond
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

function drawRoyalCrestOrPhoto(ctx, cx, cy, radius, photoImg, badgeLabel = 'UCE 87') {
  ctx.save();
  // Outer golden rays / laurel ring
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 1.28);
  grad.addColorStop(0, 'rgba(197, 160, 89, 0.35)');
  grad.addColorStop(1, 'rgba(197, 160, 89, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.28, 0, Math.PI * 2);
  ctx.fill();

  // Decorative outer ring dots
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

  // Gold metallic border ring
  const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ringGrad.addColorStop(0, '#f9e498');
  ringGrad.addColorStop(0.5, '#c5a059');
  ringGrad.addColorStop(1, '#8c6928');
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#09132c';
  ctx.fill();

  if (photoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.clip();
    // Cover-fit image
    const iw = photoImg.width;
    const ih = photoImg.height;
    const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(photoImg, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    // Draw Royal Star & Trophy Emblem
    ctx.fillStyle = '#f3d88c';
    ctx.font = `bold ${Math.round(radius * 0.65)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', cx, cy - radius * 0.12);

    ctx.fillStyle = '#e6c67c';
    ctx.font = `bold ${Math.round(radius * 0.24)}px Georgia, serif`;
    ctx.fillText(badgeLabel, cx, cy + radius * 0.52);
  }
  ctx.restore();
}

export async function renderCertificateToDataUrl({
  player,
  certType = 'award', // 'award' | 'participation'
  awardIndex = 0,
  photoDataUrl = null,
}) {
  const canvas = document.createElement('canvas');
  const W = 2000;
  const H = 1414;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let photoImg = null;
  if (photoDataUrl) {
    try {
      photoImg = await loadImage(photoDataUrl);
    } catch {
      photoImg = null;
    }
  }

  const isAward = certType === 'award' && player?.awards?.length > 0;
  const activeAward = isAward ? (player.awards[awardIndex] || player.awards[0]) : null;

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
  ctx.fillText('✦   U C E  ’ 8 7   A L U M N I   Q U I Z   C L U B   •   T H E   U L T I M A T E   C H A L L E N G E   E X P E R I E N C E   ✦', W / 2, 125);

  // Main Certificate Title
  const titleGrad = ctx.createLinearGradient(W * 0.25, 150, W * 0.75, 220);
  titleGrad.addColorStop(0, '#f3d88c');
  titleGrad.addColorStop(0.5, '#ffffff');
  titleGrad.addColorStop(1, '#f3d88c');
  ctx.fillStyle = titleGrad;
  ctx.font = 'bold 62px Georgia, serif';
  ctx.fillText(
    isAward ? 'CERTIFICATE OF EXCELLENCE' : 'CERTIFICATE OF APPRECIATION',
    W / 2,
    205
  );

  // Subtitle pill
  const pillText = isAward
    ? `${activeAward.tier.toUpperCase()}  •  40-WEEK GRAND FINALE (2026)`
    : 'OFFICIAL CONTENDER & SEASON FINISHER  •  40-WEEK GRAND FINALE (2026)';
  ctx.font = 'bold 20px Arial, sans-serif';
  const pillW = Math.max(ctx.measureText(pillText).width + 70, 560);
  drawRoundedRect(ctx, W / 2 - pillW / 2, 232, pillW, 42, 21);
  ctx.fillStyle = 'rgba(197, 160, 89, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.fillText(pillText, W / 2, 260);

  // 4. Centerpiece Crest or Member Photo
  drawRoyalCrestOrPhoto(ctx, W / 2, 395, 92, photoImg, isAward ? 'HONOREE' : 'UCE 87');

  // 5. "PROUDLY PRESENTED TO" & Member Name
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('This certificate is proudly presented to', W / 2, 540);

  const nameGrad = ctx.createLinearGradient(W * 0.3, 560, W * 0.7, 630);
  nameGrad.addColorStop(0, '#f9e498');
  nameGrad.addColorStop(0.5, '#ffd700');
  nameGrad.addColorStop(1, '#d4af37');
  ctx.fillStyle = nameGrad;
  ctx.font = 'bold 68px Georgia, serif';
  ctx.fillText(player.realName || player.displayName, W / 2, 615);

  // Decorative underline beneath name
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 340, 640);
  ctx.lineTo(W / 2 + 340, 640);
  ctx.stroke();

  // 6. Award Title Plaque OR Contender Title Plaque
  const plaqueY = 670;
  const plaqueW = 1320;
  const plaqueH = 82;
  drawRoundedRect(ctx, W / 2 - plaqueW / 2, plaqueY, plaqueW, plaqueH, 16);
  const plaqueGrad = ctx.createLinearGradient(W / 2 - plaqueW / 2, plaqueY, W / 2 + plaqueW / 2, plaqueY);
  plaqueGrad.addColorStop(0, 'rgba(197, 160, 89, 0.08)');
  plaqueGrad.addColorStop(0.5, 'rgba(197, 160, 89, 0.26)');
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
  ctx.fillText(mainAwardTitle, W / 2, plaqueY + 52);

  // 7. Citation Text
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '27px Georgia, serif';
  const citationText = isAward ? activeAward.citation : player.participationCitation;
  wrapText(ctx, citationText, W / 2, 810, 1460, 42);

  // 8. Verified Performance Stats Row (5 Stat Boxes)
  const statsY = 965;
  const boxW = 265;
  const boxH = 118;
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
    ctx.fillStyle = 'rgba(15, 28, 63, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(st.label, startX + boxW / 2, statsY + 38);

    ctx.fillStyle = '#f3d88c';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(st.value, startX + boxW / 2, statsY + 86);

    startX += boxW + gap;
  });

  // 9. Footer Signatures & Official Seal
  const footY = 1225;

  // Left signature
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(220, footY);
  ctx.lineTo(640, footY);
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'italic bold 28px Georgia, serif';
  ctx.fillText('U N Das', 430, footY - 18);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('ORGANIZER • ORGANIZING COMMITTEE • UCE BURLA BATCH OF 1987', 430, footY + 32);

  // Center Official Gold Seal
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

  // Right date & verification
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W - 640, footY);
  ctx.lineTo(W - 220, footY);
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('November 2026 • Quiz 40 Finale', W - 430, footY - 18);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText(
    player.rank ? `OFFICIAL SEASON RANK #${player.rank} • VERIFIED PURE SCORE` : 'VERIFIED PIONEER RECORD • UCE-QUIZ.WEB.APP',
    W - 430,
    footY + 32
  );

  return canvas.toDataURL('image/png');
}

export async function renderWrappedCardToDataUrl({ player, photoDataUrl = null }) {
  const canvas = document.createElement('canvas');
  const W = 1080;
  const H = 1620;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let photoImg = null;
  if (photoDataUrl) {
    try {
      photoImg = await loadImage(photoDataUrl);
    } catch {
      photoImg = null;
    }
  }

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#09132c');
  bg.addColorStop(0.5, '#132550');
  bg.addColorStop(1, '#060c1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 4;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText('✨  U C E  ’ 8 7   Q U I Z   R E W I N D   2 0 2 6  ✨', W / 2, 100);

  // Crest or Photo
  drawRoyalCrestOrPhoto(
    ctx,
    W / 2,
    245,
    95,
    photoImg,
    player.rank ? `RANK #${player.rank}` : 'UCE 87'
  );

  // Name & Persona
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText(player.realName || player.displayName, W / 2, 415);

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillText(player.persona, W / 2, 465);

  // Special Award Banner if any
  const topAward = player.awards?.[0];
  drawRoundedRect(ctx, 80, 505, W - 160, 105, 18);
  ctx.fillStyle = 'rgba(197, 160, 89, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText(topAward ? 'SPECIAL SEASON HONOR' : '2026 CONTENDER MILESTONE', W / 2, 540);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(
    topAward ? `🏆 ${topAward.title}` : `🎖️ Official 2026 Season Contender (${player.maxScore}/10 Best)`,
    W / 2,
    584
  );

  // 6-Card Bento Grid
  const grid = [
    { label: 'PURE SCORE', val: `${player.pureScore} Pts`, sub: player.rank ? `Overall Rank #${player.rank}` : 'Pilot Pioneer' },
    { label: 'QUIZZES PLAYED', val: `${player.weeksPlayed} / 40`, sub: `Max Streak: ${player.maxAttStreak} Wks` },
    { label: 'SEASON AVG', val: `${player.avgScore} / 10`, sub: `Best: ${player.maxScore} / 10` },
    { label: 'AVG SPEED', val: `${player.avgTime}s`, sub: `Fastest: ${player.fastestTime || player.pilotTime || 0}s` },
    { label: '10/10 & 9+ CLUB', val: `${player.count10}x 10/10`, sub: `${player.count9Plus}x Scored 9 or 10` },
    { label: 'WEEKLY MEDALS', val: `${player.podiums} Podiums`, sub: `${player.gold}🥇  ${player.silver}🥈  ${player.bronze}🥉` },
  ];

  const cardW = 445;
  const cardH = 165;
  const startY = 645;
  grid.forEach((g, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 80 + col * (cardW + 30);
    const y = startY + row * (cardH + 24);

    drawRoundedRect(ctx, x, y, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(9, 19, 44, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText(g.label, x + cardW / 2, y + 40);

    ctx.fillStyle = '#f3d88c';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText(g.val, x + cardW / 2, y + 98);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px Arial, sans-serif';
    ctx.fillText(g.sub, x + cardW / 2, y + 138);
  });

  // 40-Week Mini Trajectory Chart
  const chartX = 80;
  const chartY = 1235;
  const chartW = W - 160;
  const chartH = 220;
  drawRoundedRect(ctx, chartX, chartY, chartW, chartH, 16);
  ctx.fillStyle = 'rgba(9, 19, 44, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
  ctx.stroke();

  ctx.fillStyle = '#f3d88c';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('40-WEEK SCORE TRAJECTORY (QUIZ 1 TO QUIZ 40)', W / 2, chartY + 36);

  const barAreaX = chartX + 32;
  const barAreaY = chartY + 60;
  const barAreaW = chartW - 64;
  const barAreaH = 130;
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
