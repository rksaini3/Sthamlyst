import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

interface MentionSummary {
  source: string;
  mentioned: boolean | null;
  sentiment: string | null;
}

interface AuditSnapshot {
  brandName: string;
  city: string;
  date: string;
  localScore: number | null;
  websiteScore: number | null;
  mentions: MentionSummary[];
}

function scoreColor(score: number | null): string {
  if (score === null) return '#9CA3AF';
  if (score >= 70) return '#16A34A';
  if (score >= 40) return '#D97706';
  return '#DC2626';
}

function scoreCircle(label: string, before: number | null, after: number | null): string {
  const diff = before !== null && after !== null ? after - before : null;
  const diffLabel =
    diff === null ? '' : diff >= 0 ? `▲ +${diff}` : `▼ ${diff}`;
  const diffColor = diff !== null && diff >= 0 ? '#16A34A' : '#DC2626';

  return `
    <div class="score-block">
      <p class="score-label">${label}</p>
      <div class="score-row">
        <div class="score-circle" style="border-color:${scoreColor(before)}">
          <span>${before ?? '—'}</span>
        </div>
        <div class="arrow">→</div>
        <div class="score-circle" style="border-color:${scoreColor(after)}">
          <span>${after ?? '—'}</span>
        </div>
      </div>
      ${diff !== null ? `<p class="diff" style="color:${diffColor}">${diffLabel} points</p>` : ''}
    </div>
  `;
}

function mentionRow(sourceLabel: string, before?: MentionSummary, after?: MentionSummary): string {
  function badge(m?: MentionSummary): string {
    if (!m) return '<span class="badge gray">—</span>';
    if (m.mentioned === true) return '<span class="badge green">✅ Mentioned</span>';
    if (m.mentioned === false) return '<span class="badge red">❌ Not mentioned</span>';
    return '<span class="badge gray">⚠️ Unclear</span>';
  }
  return `
    <tr>
      <td>${sourceLabel}</td>
      <td>${badge(before)}</td>
      <td>${badge(after)}</td>
    </tr>
  `;
}

export function buildReportHtml(before: AuditSnapshot, after: AuditSnapshot, agencyName?: string): string {
  const sources = Array.from(
    new Set([...before.mentions.map((m) => m.source), ...after.mentions.map((m) => m.source)])
  );

  const mentionRows = sources
    .map((source) => {
      const b = before.mentions.find((m) => m.source === source);
      const a = after.mentions.find((m) => m.source === source);
      return mentionRow(source.charAt(0).toUpperCase() + source.slice(1), b, a);
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #14162E;
      margin: 0;
      padding: 40px 50px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #8B85E3;
      padding-bottom: 16px;
      margin-bottom: 28px;
    }
    .header h1 { color: #E0A44B; margin: 0; font-size: 26px; }
    .header .tag { font-size: 12px; color: #666; }
    .brand-title { font-size: 22px; font-weight: bold; margin-bottom: 2px; }
    .brand-sub { color: #666; margin-bottom: 24px; font-size: 13px; }
    .section-title {
      font-size: 15px;
      font-weight: bold;
      color: #14162E;
      margin: 30px 0 14px 0;
      border-left: 4px solid #8B85E3;
      padding-left: 10px;
    }
    .scores-grid { display: flex; gap: 24px; }
    .score-block { flex: 1; text-align: center; background: #FAFAFC; border-radius: 12px; padding: 18px; }
    .score-label { font-size: 12px; color: #666; margin-bottom: 10px; font-weight: 600; }
    .score-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .score-circle {
      width: 70px; height: 70px; border-radius: 50%; border: 5px solid;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: bold;
    }
    .arrow { font-size: 20px; color: #8B85E3; }
    .diff { margin-top: 8px; font-weight: bold; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
    th, td { border: 1px solid #E5E5EA; padding: 9px 12px; text-align: center; }
    th { background: #14162E; color: white; font-size: 11px; }
    .badge { padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .badge.green { background: #DCFCE7; color: #16A34A; }
    .badge.red { background: #FEE2E2; color: #DC2626; }
    .badge.gray { background: #F3F4F6; color: #6B7280; }
    .footer {
      margin-top: 40px; padding-top: 14px; border-top: 1px solid #eee;
      font-size: 10px; color: #999; text-align: center;
    }
    .date-row { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-top: 4px; }
    .summary-box {
      background: #F7F5FF; border-left: 4px solid #8B85E3; border-radius: 8px;
      padding: 14px 18px; margin-top: 24px; font-size: 13px; line-height: 1.6;
    }
  </style>
  </head>
  <body>
    <div class="header">
      <h1>Sthamly</h1>
      <div class="tag">AI Visibility Report ${agencyName ? `· prepared by ${agencyName}` : ''}</div>
    </div>

    <p class="brand-title">${before.brandName}</p>
    <p class="brand-sub">${before.city}</p>
    <div class="date-row">
      <span>Before: ${before.date}</span>
      <span>After: ${after.date}</span>
    </div>

    <div class="section-title">AI Visibility Score — Before vs After</div>
    <div class="scores-grid">
      ${scoreCircle('Local / Maps Score', before.localScore, after.localScore)}
      ${scoreCircle('Website AI Score', before.websiteScore, after.websiteScore)}
    </div>

    <div class="section-title">AI Model Mentions — Before vs After</div>
    <table>
      <tr><th>AI Model</th><th>Before</th><th>After</th></tr>
      ${mentionRows}
    </table>

    <div class="summary-box">
      <b>Kya badla:</b> Sthamly ke AI Visibility fix ke baad, ${before.brandName} ki AI search
      results mein presence upar diye gaye scores ke hisaab se sudhri hai. Yeh report ChatGPT, Gemini,
      Perplexity, aur Google ke actual response data par based hai — koi assumption nahi.
    </div>

    <div class="footer">
      Generated by Sthamly · sthamly.com · Yeh report AI models ke real-time response data par based hai,
      results samay ke saath badal sakte hain.
    </div>
  </body>
  </html>
  `;
}

export async function generatePdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
