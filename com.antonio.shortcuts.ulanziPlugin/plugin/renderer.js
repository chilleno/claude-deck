// SVG renderer for the Cycle iTerm Sessions key (sized for the D200 large key, 458x196)
const W = 464;
const H = 196;
const BG = '#1f1f23';
const TEXT = '#ffffff';
const MUTED = '#9a9aa5';
const ACCENT = '#d77757';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function svgDoc(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" rx="18" fill="${BG}"/>${body}</svg>`;
}

// split name into at most 2 lines that fit the key
function splitLines(name, maxChars) {
  const words = String(name).trim().split(/\s+/);
  const lines = [''];
  for (const word of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = word;
    else if ((cur + ' ' + word).length <= maxChars) lines[lines.length - 1] = cur + ' ' + word;
    else lines.push(word);
  }
  if (lines.length > 2) {
    lines.length = 2;
    lines[1] = lines[1].slice(0, maxChars - 1) + '…';
  }
  return lines.map(l => (l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l));
}

export const STATE_STYLE = {
  working:   { color: '#3ecf6b', label: 'WORKING' },
  compacting:{ color: '#e3b341', label: 'COMPACTING' },
  waiting:   { color: '#5a6ebe', label: 'DONE' },
  attention: { color: '#e3434c', label: 'NEEDS YOU' },
  asking:    { color: '#b57edc', label: 'ASKING' },
};

export function renderSession({ name, idx, total, error, status, info, compactElapsed }) {
  const font = 'font-family="-apple-system,Helvetica,Arial,sans-serif"';

  if (error) {
    const body =
      `<text x="${W / 2}" y="88" ${font} font-size="26" font-weight="600" text-anchor="middle" fill="${MUTED}">iTerm</text>` +
      `<text x="${W / 2}" y="128" ${font} font-size="30" font-weight="700" text-anchor="middle" fill="${TEXT}">${escapeXml(error)}</text>`;
    return toDataUrl(svgDoc(body));
  }

  const hasInfo = !!(info && (info.model || info.branch || info.effort || info.ctx_pct != null));
  const isCompacting = status === 'compacting' && compactElapsed != null;
  // with the info row + a bar below, the name gets a single compact line
  const tight = hasInfo || isCompacting;
  const lines = tight ? [splitLines(name || 'untitled', 22)[0]] : splitLines(name || 'untitled', 26);
  const nameSize = tight ? 36 : (lines.length === 1 && lines[0].length <= 16 ? 44 : 32);
  const startY = tight ? 96 : (lines.length === 1 ? 118 : 100);

  let body =
    `<text x="24" y="42" ${font} font-size="22" font-weight="700" fill="${ACCENT}" letter-spacing="2">SESSION</text>`;

  lines.forEach((line, i) => {
    body += `<text x="${W / 2}" y="${startY + i * 42}" ${font} font-size="${nameSize}" font-weight="700" text-anchor="middle" fill="${TEXT}">${escapeXml(line)}</text>`;
  });

  if (hasInfo) {
    const parts = [];
    if (info.model) parts.push(info.model);
    if (info.effort) parts.push(info.effort);
    if (info.branch) parts.push(info.branch);
    if (parts.length) {
      body += `<text x="${W / 2}" y="130" ${font} font-size="19" font-weight="600" text-anchor="middle" fill="${MUTED}">${escapeXml(parts.join('  ·  '))}</text>`;
    }
    if (info.ctx_pct != null && !isCompacting) {
      const pct = Math.max(0, Math.min(100, info.ctx_pct));
      const col = pct < 60 ? '#3ecf6b' : pct < 85 ? '#e3b341' : '#e3434c';
      const bx = 24, by = 144, bh = 10, bw = W - 48 - 62;
      body +=
        `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="5" fill="#3a3a42"/>` +
        `<rect x="${bx}" y="${by}" width="${Math.max(bh, bw * pct / 100)}" height="${bh}" rx="5" fill="${col}"/>` +
        `<text x="${W - 24}" y="${by + bh}" ${font} font-size="18" font-weight="700" text-anchor="end" fill="${col}">${pct}%</text>`;
    }
  }

  if (isCompacting) {
    // Claude Code exposes no real compaction percent (only PreCompact fires),
    // so the bar is time-driven: eases toward 95% and holds until state flips
    const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-compactElapsed / 20))));
    const col = STATE_STYLE.compacting.color;
    const bx = 24, by = 144, bh = 10, bw = W - 48 - 62;
    body +=
      `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="5" fill="#3a3a42"/>` +
      `<rect x="${bx}" y="${by}" width="${Math.max(bh, bw * pct / 100)}" height="${bh}" rx="5" fill="${col}"/>` +
      `<text x="${W - 24}" y="${by + bh}" ${font} font-size="18" font-weight="700" text-anchor="end" fill="${col}">${pct}%</text>`;
  }

  if (status && STATE_STYLE[status]) {
    const st = STATE_STYLE[status];
    body +=
      `<circle cx="128" cy="34" r="8" fill="${st.color}"/>` +
      `<text x="144" y="42" ${font} font-size="22" font-weight="700" fill="${st.color}">${st.label}</text>`;
  }

  if (total > 0) {
    body += `<text x="${W - 24}" y="42" ${font} font-size="22" font-weight="600" text-anchor="end" fill="${MUTED}">${idx}/${total}</text>`;
    // window position dots
    const dotGap = 22;
    const startX = W / 2 - ((total - 1) * dotGap) / 2;
    for (let i = 1; i <= Math.min(total, 12); i++) {
      body += `<circle cx="${startX + (i - 1) * dotGap}" cy="${H - 24}" r="6" fill="${i === idx ? ACCENT : '#3a3a42'}"/>`;
    }
  }

  return toDataUrl(svgDoc(body));
}

// Placeholder shown on the big key while no Claude Code session is tracked.
export function renderNoSession() {
  const font = 'font-family="-apple-system,Helvetica,Arial,sans-serif"';
  const body =
    `<text x="24" y="42" ${font} font-size="22" font-weight="700" fill="${ACCENT}" letter-spacing="2">CLAUDE</text>` +
    `<circle cx="${W / 2 - 96}" cy="102" r="8" fill="#3a3a42"/>` +
    `<text x="${W / 2 + 12}" y="112" ${font} font-size="30" font-weight="700" text-anchor="middle" fill="${MUTED}">no session</text>` +
    `<text x="${W / 2}" y="152" ${font} font-size="20" font-weight="600" text-anchor="middle" fill="#5a5a64">waiting for a claude session…</text>`;
  return toDataUrl(svgDoc(body));
}

// Confirmation flash after answering via the OK key.
export function renderConfirm(option) {
  const font = 'font-family="-apple-system,Helvetica,Arial,sans-serif"';
  const green = STATE_STYLE.working.color;
  const lines = splitLines(option, 24);
  const startY = lines.length === 1 ? 128 : 116;
  let body =
    `<circle cx="${W / 2}" cy="58" r="26" fill="${green}"/>` +
    `<path d="M${W / 2 - 12} 58 l8 9 l16 -18" stroke="#1f1f23" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  lines.forEach((line, i) => {
    body += `<text x="${W / 2}" y="${startY + i * 30}" ${font} font-size="28" font-weight="700" text-anchor="middle" fill="${TEXT}">${escapeXml(line)}</text>`;
  });
  body += `<text x="${W / 2}" y="${H - 16}" ${font} font-size="18" font-weight="600" text-anchor="middle" fill="${MUTED}">selected</text>`;
  return toDataUrl(svgDoc(body));
}

// Options screen shown on the big key while Claude is asking.
// index = 0-based position of the currently highlighted option.
export function renderOptions({ question, options, index }) {
  const font = 'font-family="-apple-system,Helvetica,Arial,sans-serif"';
  const ask = STATE_STYLE.asking.color;
  const total = options.length;
  const cur = options[index] || '';

  let body =
    `<text x="24" y="36" ${font} font-size="20" font-weight="700" fill="${ask}" letter-spacing="2">CLAUDE ASKS</text>` +
    `<text x="${W - 24}" y="36" ${font} font-size="20" font-weight="600" text-anchor="end" fill="${MUTED}">${index + 1}/${total}</text>`;

  const q = splitLines(question, 40)[0];
  body += `<text x="24" y="66" ${font} font-size="20" font-weight="500" fill="${MUTED}">${escapeXml(q)}</text>`;

  const lines = splitLines(cur, 24);
  const size = lines.length === 1 && lines[0].length <= 18 ? 34 : 26;
  const startY = lines.length === 1 ? 118 : 106;
  lines.forEach((line, i) => {
    body += `<text x="${W / 2}" y="${startY + i * 30}" ${font} font-size="${size}" font-weight="700" text-anchor="middle" fill="${TEXT}">${escapeXml(line)}</text>`;
  });

  // side arrows hint the cycle key
  body += `<text x="18" y="${startY}" ${font} font-size="30" font-weight="700" fill="${ask}">‹</text>`;
  body += `<text x="${W - 18}" y="${startY}" ${font} font-size="30" font-weight="700" text-anchor="end" fill="${ask}">›</text>`;

  const dotGap = 22;
  const startX = W / 2 - ((Math.min(total, 12) - 1) * dotGap) / 2;
  for (let i = 0; i < Math.min(total, 12); i++) {
    body += `<circle cx="${startX + i * dotGap}" cy="${H - 20}" r="6" fill="${i === index ? ask : '#3a3a42'}"/>`;
  }

  return toDataUrl(svgDoc(body));
}
