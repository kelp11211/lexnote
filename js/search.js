import { normalize } from "./schema.js";
export function search(entries, f = {}) {
  const q = normalize(f.q || "");
  return entries
    .filter(
      (e) =>
        (!f.type || e.type === f.type) &&
        (!f.tag || e.tags.includes(f.tag)) &&
        (!f.section || e.sections.includes(f.section)) &&
        (!f.favorite || e.favorite) &&
        (!q ||
          normalize(
            [
              e.word,
              ...e.translations,
              e.definition,
              e.usage,
              ...e.collocations,
              ...e.academicExamples.flatMap((x) => [x.en, x.zh]),
              ...e.synonyms.map((x) => x.word),
              ...e.tags,
              e.originalContext,
            ].join(" "),
          ).includes(q)),
    )
    .sort((a, b) =>
      f.sort === "alpha"
        ? a.word.localeCompare(b.word, "en")
        : b[f.sort === "updated" ? "updatedAt" : "createdAt"].localeCompare(
            a[f.sort === "updated" ? "updatedAt" : "createdAt"],
          ),
    );
}
