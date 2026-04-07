'use strict';

// ── Utility helpers ────────────────────────────────────────────────────────

function fmt(num, decimals = 2) {
  if (num == null) return '--';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtVolume(v) {
  if (v == null) return '--';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return String(v);
}

function fmtMarketCap(v) {
  if (v == null) return '--';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
  return String(v);
}

function relativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '--';
}

function showError(show) {
  document.getElementById('error-banner').classList.toggle('hidden', !show);
}

// ── Clock ─────────────────────────────────────────────────────────────────

function startClock() {
  function tick() {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString('en-GB');
  }
  tick();
  setInterval(tick, 1000);
}

// ── Chart setup ───────────────────────────────────────────────────────────

let chart = null;
let currentPeriod = '1d';
let chartPositive = true;

function initChart() {
  const ctx = document.getElementById('price-chart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [{ data: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e2535',
          borderColor: '#2a3248',
          borderWidth: 1,
          titleColor: '#8b9cbf',
          bodyColor: '#e2e8f0',
          callbacks: {
            label: ctx => ' ' + fmt(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: { tooltipFormat: 'dd MMM HH:mm' },
          grid: { color: '#2a3248' },
          ticks: { color: '#8b9cbf', maxTicksLimit: 6 },
          border: { color: '#2a3248' },
        },
        y: {
          position: 'right',
          grid: { color: '#2a3248' },
          ticks: { color: '#8b9cbf', callback: v => fmt(v) },
          border: { color: '#2a3248' },
        },
      },
    },
  });
}

function updateChart(data) {
  if (!chart || !data.data || !data.data.length) return;

  const points = data.data.map(d => ({ x: new Date(d.t), y: d.c }));
  const first = points[0].y;
  const last = points[points.length - 1].y;
  chartPositive = last >= first;
  const color = chartPositive ? '#22c55e' : '#ef4444';

  const canvas = document.getElementById('price-chart');
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 260);
  grad.addColorStop(0, chartPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  chart.data.datasets[0] = {
    data: points,
    borderColor: color,
    borderWidth: 2,
    backgroundColor: grad,
    fill: true,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.3,
  };

  // Adjust x-axis time unit based on period
  const unitMap = { '1d': 'hour', '5d': 'day', '1mo': 'day', '3mo': 'week' };
  chart.options.scales.x.time.unit = unitMap[currentPeriod] || 'hour';

  chart.update('none');
}

// ── Quote update ──────────────────────────────────────────────────────────

function updateQuote(q) {
  setText('price', fmt(q.price));
  setText('currency', q.currency || 'NOK');
  setText('prev-close', fmt(q.prev_close));
  setText('day-high', fmt(q.day_high));
  setText('day-low', fmt(q.day_low));
  setText('volume', fmtVolume(q.volume));

  // Change row
  const changeRow = document.getElementById('change-row');
  const arrow = document.getElementById('change-arrow');
  const changeAbs = document.getElementById('change-abs');
  const changePct = document.getElementById('change-pct');
  const positive = q.change != null ? q.change >= 0 : true;

  changeRow.className = 'change-row ' + (positive ? 'positive' : 'negative');
  arrow.innerHTML = positive ? '&#9650;' : '&#9660;';
  changeAbs.textContent = q.change != null ? fmt(Math.abs(q.change)) : '--';
  changePct.textContent = q.change_pct != null ? '(' + fmt(Math.abs(q.change_pct)) + '%)' : '(--)';

  // Market state
  const state = (q.market_state || '').toUpperCase();
  const badge = document.getElementById('market-state-badge');
  badge.textContent = state || '--';
  badge.className = 'market-badge';
  if (state === 'REGULAR') badge.classList.add('open');
  else if (state === 'PRE') badge.classList.add('pre');
  else if (state === 'POST') badge.classList.add('post');
  else badge.classList.add('closed');

  // Live dot
  const dot = document.getElementById('live-indicator');
  dot.className = 'live-dot' + (state === 'REGULAR' ? ' pulsing' : '');

  // Timestamp
  if (q.timestamp) {
    const t = new Date(q.timestamp);
    document.getElementById('last-updated').textContent = t.toLocaleTimeString('en-GB');
  }
}

// ── Company info update ───────────────────────────────────────────────────

function updateInfo(info) {
  setText('company-name', info.name);
  setText('company-desc', info.description || '');
  setText('sector', info.sector || '--');
  setText('industry', info.industry || '--');
  setText('employees', info.employees ? info.employees.toLocaleString() : '--');
  setText('pe-ratio', info.pe_ratio ? fmt(info.pe_ratio) : '--');

  const mcEl = document.getElementById('market-cap');
  // market cap will be filled from the quote endpoint
  if (mcEl && mcEl.textContent === '--') mcEl.textContent = '--';

  const websiteEl = document.getElementById('website');
  if (websiteEl && info.website) {
    websiteEl.href = info.website;
    websiteEl.textContent = info.website.replace(/^https?:\/\//, '');
  }

  // 52-week range
  if (info['52w_low'] && info['52w_high']) {
    setText('w52-low', fmt(info['52w_low']));
    setText('w52-high', fmt(info['52w_high']));
  }
}

function update52wThumb(price, lo, hi) {
  if (!price || !lo || !hi || hi === lo) return;
  const pct = Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100));
  const fill = document.getElementById('w52-fill');
  const thumb = document.getElementById('w52-thumb');
  if (fill) fill.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
}

// ── News update ───────────────────────────────────────────────────────────

function updateNews(newsData) {
  const list = document.getElementById('news-list');
  if (!newsData.items || !newsData.items.length) {
    list.innerHTML = '<div class="news-loading">No recent news available.</div>';
    return;
  }

  list.innerHTML = newsData.items.map(item => {
    const thumb = item.thumbnail
      ? `<img class="news-thumb" src="${escHtml(item.thumbnail)}" alt="" loading="lazy" />`
      : '';
    const summary = item.summary
      ? `<div class="news-summary">${escHtml(item.summary)}</div>`
      : '';
    return `
      <div class="news-item">
        ${thumb}
        <div class="news-title">
          <a href="${escHtml(item.link)}" target="_blank" rel="noopener">
            ${escHtml(item.title)}
          </a>
        </div>
        ${summary}
        <div class="news-meta">
          <span class="news-publisher">${escHtml(item.publisher)}</span>
          <span class="news-dot">&bull;</span>
          <span class="news-time">${relativeTime(item.published_at)}</span>
        </div>
      </div>`;
  }).join('');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Fetch helpers ─────────────────────────────────────────────────────────

let quoteController = null;
let chartController = null;
let newsController = null;

async function fetchQuote() {
  if (quoteController) quoteController.abort();
  quoteController = new AbortController();
  try {
    const res = await fetch('/api/quote', { signal: quoteController.signal });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    updateQuote(data);
    showError(false);

    // Update 52w thumb once we have current price + info
    const lo = parseFloat(document.getElementById('w52-low')?.textContent);
    const hi = parseFloat(document.getElementById('w52-high')?.textContent);
    if (!isNaN(lo) && !isNaN(hi)) update52wThumb(data.price, lo, hi);

    // Update market cap from quote
    if (data.market_cap) {
      setText('market-cap', fmtMarketCap(data.market_cap) + ' ' + (data.currency || 'NOK'));
    }
  } catch (e) {
    if (e.name !== 'AbortError') showError(true);
  }
}

async function fetchChart(period) {
  if (chartController) chartController.abort();
  chartController = new AbortController();
  try {
    const res = await fetch(`/api/chart?period=${period}`, { signal: chartController.signal });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    updateChart(data);
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('Chart fetch failed:', e);
  }
}

async function fetchNews() {
  if (newsController) newsController.abort();
  newsController = new AbortController();
  try {
    const res = await fetch('/api/news', { signal: newsController.signal });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    updateNews(data);
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('News fetch failed:', e);
  }
}

async function fetchInfo() {
  try {
    const res = await fetch('/api/info');
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    updateInfo(data);
  } catch (e) {
    console.warn('Info fetch failed:', e);
  }
}

// ── Polling ───────────────────────────────────────────────────────────────

let chartPollTimer = null;

function startChartPolling(period) {
  if (chartPollTimer) clearInterval(chartPollTimer);
  fetchChart(period);
  // Only auto-refresh 1d chart (intraday changes)
  if (period === '1d') {
    chartPollTimer = setInterval(() => fetchChart(period), 60_000);
  }
}

function init() {
  startClock();
  initChart();

  // Initial data load
  fetchQuote();
  fetchInfo();
  fetchNews();
  startChartPolling('1d');

  // Recurring polls
  setInterval(fetchQuote, 30_000);
  setInterval(fetchNews, 300_000);

  // Period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      startChartPolling(currentPeriod);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
