import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function assertTikTokUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error('Thieu link TikTok.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Link TikTok khong hop le.');
  }
  if (!/(^|\.)tiktok\.com$/i.test(parsed.hostname) && !/(^|\.)tiktokv\.com$/i.test(parsed.hostname)) {
    throw new Error('Chi ho tro link tiktok.com hoac tiktokv.com.');
  }
  return parsed.href;
}

function safeFilename(name = 'strangetts-video.mp4') {
  const cleaned = String(name || 'strangetts-video.mp4')
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160);
  return cleaned || 'strangetts-video.mp4';
}

function pickTitle(data, videoUrl) {
  const id = data?.id || data?.aweme_id || (String(videoUrl || '').match(/\/video\/(\d+)/) || [])[1] || Date.now();
  const title = data?.title || data?.desc || 'tiktok-video';
  return `${id}_${title}.mp4`;
}

async function fetchTikwm(tiktokUrl) {
  const body = new URLSearchParams({ url: tiktokUrl, hd: '1' });
  const res = await fetch('https://tikwm.com/api/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) throw new Error(`Tikwm HTTP ${res.status}`);
  const json = await res.json();
  if (!json || json.code !== 0) throw new Error(json?.msg || 'Tikwm API loi.');
  return json.data || {};
}

async function downloadBinary(url, outputFile) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 StrangeTTS-PC-App'
    }
  });
  if (!res.ok) throw new Error(`Tai video loi HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1024) throw new Error('File video qua nho hoac rong.');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(outputFile, buffer, { mode: 0o600 });
  return buffer.length;
}

export async function downloadTikTokVideo(rawUrl) {
  const tiktokUrl = assertTikTokUrl(rawUrl);
  const data = await fetchTikwm(tiktokUrl);
  const videoUrl = data.hdplay || data.play || data.wmplay;
  if (!videoUrl) throw new Error('Khong lay duoc link video tu Tikwm.');
  const downloadsDir = path.join(os.homedir(), 'Downloads', 'STRANGETTS_Downloads');
  const filename = safeFilename(pickTitle(data, tiktokUrl));
  const outputFile = path.join(downloadsDir, filename);
  const bytes = await downloadBinary(videoUrl, outputFile);
  return {
    file: outputFile,
    bytes,
    source: 'tikwm',
    title: data.title || '',
    videoUrl
  };
}
