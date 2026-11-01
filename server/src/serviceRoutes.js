import { mkdir, writeFile, readFile, unlink, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const DEFAULT_UPLOADS = join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
const LANGUAGES = ['vi', 'en', 'zh'];
const MEDIA_PATH = /^\/api\/media\/([0-9a-f-]{36}\.(?:mp4|webm|mov))$/;
const ownerKey = (user) => user.id != null ? 'id:' + user.id : 'email:' + user.email;
const MB = 1024 * 1024;
const publicError = (status, code) => Object.assign(new Error(code), { status, publicCode: code });
const positive = (v, fallback) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
const MIME = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const validId = (v) => /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v));
const text = (v, max, required = true) => typeof v === 'string' && v.length <= max && (!required || !!v.trim());
const timing = (start, end) => Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= 86400;

/** Validate only supported languages, bounded content and coherent timestamps. */
export function validateProject(b) {
  if (!b || !text(b.title, 200) || !LANGUAGES.includes(b.originalLanguage)
    || !text(b.sourceName || '', 255, false) || !text(b.videoUrl || '', 1000, false)
    || !Array.isArray(b.segments) || !b.segments.length || b.segments.length > 1000) return null;
  const segments = [];
  let total = 0;
  let previousStart = -1;
  for (const s of b.segments) {
    if (!s || typeof s !== 'object') return null;
    const timed = s.start != null || s.end != null;
    if (timed && (!timing(s.start, s.end) || s.start < previousStart)) return null;
    if (timed) previousStart = s.start;
    const row = timed ? { start: s.start, end: s.end } : {};
    for (const lang of LANGUAGES) {
      if (s[lang] != null) {
        if (!text(s[lang], 4000, false)) return null;
        row[lang] = s[lang].trim();
        total += row[lang].length;
      }
    }
    if (!LANGUAGES.some((lang) => row[lang])) return null;
    segments.push(row);
  }
  if (total > 100000) return null;
  return { title: b.title.trim(), originalLanguage: b.originalLanguage, sourceName: (b.sourceName || '').trim(), videoUrl: b.videoUrl || '', segments };
}

export function installServiceRoutes(app, repo, { authenticated, adminOnly, uploadDir = process.env.UPLOAD_DIR || DEFAULT_UPLOADS,
  uploadQuotaBytes = positive(process.env.UPLOAD_QUOTA_MB, 500) * MB,
  totalUploadQuotaBytes = positive(process.env.UPLOAD_TOTAL_QUOTA_MB, 5120) * MB,
  maxUploadBytes = 100 * MB, maxConcurrentUploads = 4,
}) {
  uploadDir = resolve(uploadDir);
  const manifest = async (filename) => {
    try {
      const item = JSON.parse(await readFile(join(uploadDir, filename + '.json'), 'utf8'));
      return item && typeof item.owner === 'string' && MIME[item.mime] ? item : null;
    } catch (err) { if (err.code === 'ENOENT' || err instanceof SyntaxError) return null; throw err; }
  };

  // Stream files to disk: a concurrent upload does not allocate a 100 MB Buffer.
  // Budgets include unfinished/orphan files. Reservations prevent parallel requests exceeding the quota.
  const activeOwners = new Set();
  let reservedBytes = 0;
  const usage = async (owner) => {
    let total = 0, own = 0;
    for (const filename of await readdir(uploadDir)) {
      if (!MEDIA_PATH.test('/api/media/' + filename)) continue;
      try {
        const size = (await stat(join(uploadDir, filename))).size;
        total += size;
        const m = await manifest(filename);
        if (m?.owner === owner) own += size;
      } catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
    return { total, own };
  };

  app.post('/api/uploads', authenticated, wrap(async (req, res) => {
    const mime = req.get('content-type')?.split(';')[0];
    if (!MIME[mime]) return res.status(415).json({ code: 'video_type' });
    if (req.get('content-encoding') && req.get('content-encoding') !== 'identity') return res.status(415).json({ code: 'video_encoding' });
    let originalName;
    try { originalName = decodeURIComponent(req.get('x-file-name') || 'video'); }
    catch { return res.status(400).json({ code: 'invalid' }); }
    if (!text(originalName, 255) || /[\r\n\0]/.test(originalName)) return res.status(400).json({ code: 'invalid' });
    const owner = ownerKey(req.user);
    if (activeOwners.has(owner) || activeOwners.size >= maxConcurrentUploads) return res.status(429).json({ code: 'upload_busy' });
    activeOwners.add(owner);
    const filename = randomUUID() + '.' + MIME[mime];
    const target = join(uploadDir, filename);
    let reserved = 0;
    let size = 0;
    let onAborted, onError;
    let counter;
    try {
      await mkdir(uploadDir, { recursive: true });
      const used = await usage(owner);
      const available = Math.min(uploadQuotaBytes - used.own, totalUploadQuotaBytes - used.total - reservedBytes);
      if (available <= 0) throw publicError(413, 'upload_quota');
      const limit = Math.min(maxUploadBytes, available);
      const declared = Number(req.get('content-length'));
      if (Number.isFinite(declared) && declared > limit) throw publicError(413, declared > maxUploadBytes ? 'too_large' : 'upload_quota');
      reserved = Number.isSafeInteger(declared) && declared > 0 ? declared : limit;
      reservedBytes += reserved;
      counter = new Transform({
        transform(chunk, encoding, callback) {
          size += chunk.length;
          if (size > limit) return callback(publicError(413, size > maxUploadBytes ? 'too_large' : 'upload_quota'));
          callback(null, chunk);
        },
      });
      onAborted = () => counter.destroy(publicError(400, 'upload_aborted'));
      onError = (err) => counter.destroy(err);
      req.once('aborted', onAborted);
      req.once('error', onError);
      req.setTimeout(120000, () => counter.destroy(publicError(408, 'upload_timeout')));
      // Keep the request outside pipeline so a size rejection can still return JSON 413.
      const writing = pipeline(counter, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
      req.pipe(counter);
      await writing;
      if (!size) throw publicError(400, 'empty_file');
      await writeFile(target + '.json', JSON.stringify({ owner, email: req.user.email, originalName, mime, size, at: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
      res.status(201).json({ url: '/api/media/' + filename, filename: originalName });
    } catch (err) {
      if (counter) req.unpipe(counter);
      req.resume();
      await unlink(target).catch(() => {});
      await unlink(target + '.json').catch(() => {});
      throw err;
    } finally {
      if (onAborted) req.off('aborted', onAborted);
      if (onError) req.off('error', onError);
      req.setTimeout(0);
      reservedBytes -= reserved;
      activeOwners.delete(owner);
    }
  }));

  app.get('/api/media/:filename', authenticated, wrap(async (req, res, next) => {
    if (!MEDIA_PATH.test('/api/media/' + req.params.filename)) return res.status(404).json({ code: 'not_found' });
    const m = await manifest(req.params.filename);
    if (!m || (m.owner !== ownerKey(req.user) && req.user.role !== 'admin')) return res.status(404).json({ code: 'not_found' });
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.type(m.mime).sendFile(join(uploadDir, req.params.filename), (err) => {
      if (!err) return;
      if (err.code === 'ENOENT' && !res.headersSent) return res.status(404).json({ code: 'not_found' });
      next(err);
    });
  }));

  app.post('/api/projects', authenticated, wrap(async (req, res) => {
    const value = validateProject(req.body);
    if (!value) return res.status(400).json({ code: 'invalid' });
    if (value.videoUrl) {
      const match = MEDIA_PATH.exec(value.videoUrl);
      const m = match && await manifest(match[1]);
      if (!m || m.owner !== ownerKey(req.user)) return res.status(400).json({ code: 'video_owner' });
    }
    const project = await repo.createProject(req.user.email, value);
    res.status(201).json({ project });
  }));
  app.get('/api/projects', authenticated, wrap(async (req, res) => {
    res.json({ projects: await repo.listProjects(req.user.email) });
  }));
  app.get('/api/account/messages', authenticated, wrap(async (req, res) => {
    res.json({ messages: await repo.listMessages(req.user.email) });
  }));

  app.get('/api/admin/narrations', adminOnly, wrap(async (req, res) => {
    res.json({ narrations: await repo.listNarrations() });
  }));
  app.patch('/api/admin/narrations/:id', adminOnly, wrap(async (req, res) => {
    const b = req.body || {};
    if (!validId(req.params.id) || !text(b.text, 100000) || !['draft', 'ready'].includes(b.status)) return res.status(400).json({ code: 'invalid' });
    const narration = await repo.updateNarration(Number(req.params.id), { text: b.text.trim(), status: b.status });
    if (!narration) return res.status(404).json({ code: 'not_found' });
    res.json({ narration });
  }));
  app.get('/api/admin/subtitles', adminOnly, wrap(async (req, res) => {
    res.json({ subtitles: await repo.listSubtitles() });
  }));
  app.patch('/api/admin/subtitles/:id', adminOnly, wrap(async (req, res) => {
    const b = req.body || {};
    const untimed = b.start === null && b.end === null;
    if (!validId(req.params.id) || !text(b.text, 4000) || (!untimed && !timing(b.start, b.end))) return res.status(400).json({ code: 'invalid' });
    const subtitle = await repo.updateSubtitle(Number(req.params.id), { text: b.text.trim(), start: b.start, end: b.end });
    if (!subtitle) return res.status(404).json({ code: 'not_found' });
    res.json({ subtitle });
  }));
  app.get('/api/admin/feedback', adminOnly, wrap(async (req, res) => {
    res.json({ feedback: await repo.listFeedback() });
  }));
  app.patch('/api/admin/feedback/:id', adminOnly, wrap(async (req, res) => {
    const b = req.body || {};
    if (!validId(req.params.id) || !text(b.reply, 2000, b.status === 'replied') || !['open', 'replied', 'closed'].includes(b.status)) return res.status(400).json({ code: 'invalid' });
    const feedback = await repo.replyFeedback(Number(req.params.id), { reply: b.reply.trim(), status: b.status });
    if (!feedback) return res.status(404).json({ code: 'not_found' });
    res.json({ feedback });
  }));
}
