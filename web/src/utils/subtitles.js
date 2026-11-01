const timed = (segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end)
  && segment.start >= 0 && segment.end > segment.start && segment.end <= 86400;
const timestamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};
/** Untimed text stays visible in the project, but is never exported with invented times. */
export function toSrt(segments, language) {
  return (segments || []).filter((segment) => timed(segment) && String(segment[language] || '').trim())
    .map((segment, index) => `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(segment.end)}\n${String(segment[language]).replace(/\r/g, '').trim()}\n`)
    .join('\n');
}
export function downloadSrt(project, language) {
  const text = toSrt(project.segments, language);
  if (!text) return false;
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'application/x-subrip;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(project.title || 'phu-de').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80)}-${language}.srt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
