// Preserve prose and decimal numbers; break only recognizable list markers.
export function formatUsage(value) {
  let text = value.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\r\n?/g, "\n");
  text = text.replace(/\/n(?=\s*(?:[-*•●▪]|\d+[.)、])\s)/g, "\n");
  const numbered = text.match(/(?:^|\s)\d+[.)、]\s+/g) || [];
  if (numbered.length > 1)
    text = text.replace(/[^\S\n]+(?=\d+[.)、]\s+)/g, "\n");
  const bullets = text.match(/(?:^|\s)[-*]\s+/g) || [];
  if (bullets.length > 1) text = text.replace(/[^\S\n]+(?=[-*]\s+)/g, "\n");
  return text.replace(/[^\S\n]+(?=[•●▪]\s+)/g, "\n").trim();
}
