// Preserve prose and decimal numbers; break only recognizable list markers.
export function formatUsage(value) {
  let text = value.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\r\n?/g, "\n");
  text = text.replace(/\/n(?=\s*(?:[-*•●▪]|\d+[.)、])\s)/g, "\n");
  const numbered = text.match(/(?:^|\s)\d+\\?[.)、]\s+/g) || [];
  if (numbered.length > 1)
    text = text.replace(/[^\S\n]+(?=\d+\\?[.)、]\s+)/g, "\n");
  const bullets = text.match(/(?:^|\s)[-*]\s+/g) || [];
  if (bullets.length > 1) text = text.replace(/[^\S\n]+(?=[-*]\s+)/g, "\n");
  return text.replace(/[^\S\n]+(?=[•●▪]\s+)/g, "\n").trim();
}

// Display-only parsing: keep storage/export as the user's original text.
export function usageBlocks(value) {
  const text = formatUsage(value);
  const marker = /^[ \t]*(?:(\d+)\\?[.)、]|[-*•●▪])\s+(.+)$/;
  const groups = [];
  for (const line of text.split("\n")) {
    const match = line.match(marker);
    if (match)
      groups.push({
        number: match[1] ? Number(match[1]) : null,
        text: match[2],
        listed: true,
      });
    else if (groups.length) groups.at(-1).text += "\n" + line;
    else if (line.trim())
      groups.push({ number: null, text: line, listed: false });
  }
  return groups.map((group) => {
    const exampleMatch = /例如[：:]/.exec(group.text);
    const content = (
      exampleMatch ? group.text.slice(0, exampleMatch.index) : group.text
    ).trim();
    const example = exampleMatch
      ? group.text.slice(exampleMatch.index + exampleMatch[0].length).trim()
      : "";
    const heading = /^([^\n：:]{1,100})(?:：|:\s+)/.exec(content);
    return {
      ...group,
      title: heading?.[1].trim() || "",
      body: heading ? content.slice(heading[0].length).trim() : content,
      example,
    };
  });
}
