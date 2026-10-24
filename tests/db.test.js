import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  openDB,
  saveEntry,
  allEntries,
  importEntries,
  deleteEntry,
  setValue,
  getValue,
} from "../js/db.js";
import { validateEntry } from "../js/schema.js";
test("IndexedDB CRUD, transaction uniqueness, merge, replace, rollback, settings", async () => {
  await openDB();
  const e = await saveEntry({ word: "mitigate", type: "word" });
  assert.equal((await allEntries()).length, 1);
  await assert.rejects(saveEntry({ word: "MITIGATE", type: "word" }));
  assert.equal((await allEntries()).length, 1);
  await saveEntry({
    ...e,
    translations: ["減輕"],
    updatedAt: new Date().toISOString(),
  });
  assert.equal((await allEntries())[0].createdAt, e.createdAt);
  const newer = validateEntry({ word: "empirical", type: "word" }),
    conflict = validateEntry({ word: "MITIGATE", type: "word" });
  assert.deepEqual(await importEntries([e, conflict, newer]), {
    added: 1,
    skipped: 2,
  });
  assert.equal((await allEntries()).length, 2);
  const collision = validateEntry({ ...e, id: crypto.randomUUID() });
  await assert.rejects(importEntries([e, collision], true));
  assert.equal(
    (await allEntries()).length,
    2,
    "failed replace must roll back clear",
  );
  assert.deepEqual(await importEntries([e], true), { added: 1, skipped: 0 });
  await setValue("settings", "theme", "dark");
  assert.equal(await getValue("settings", "theme"), "dark");
  await deleteEntry(e.id);
  assert.equal((await allEntries()).length, 0);
});
