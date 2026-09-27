// Wipe TEST entries (submissions, votes, hazards and their photos) for one
// event year, so the team can test end to end and start event day clean.
//
//   npm run reset-test-data                 # dry run: shows what would be deleted
//   npm run reset-test-data -- --yes        # actually delete
//   npm run reset-test-data -- --year=2026 --yes
//
// Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// DO NOT run this after real submissions start on event day.

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const year = Number(args.find((a) => a.startsWith("--year="))?.split("=")[1] ?? new Date().getFullYear());
const BUCKET = "submissions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (put them in .env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function count(table) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq("event_year", year);
  if (error) throw error;
  return count ?? 0;
}

async function listFiles(prefix) {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    // Entries without an id are folders (e.g. "hazards").
    files.push(...data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`));
    if (data.length < 1000) break;
  }
  return files;
}

const [subs, hazards] = await Promise.all([count("submissions"), count("hazards")]);
const files = [...(await listFiles(`${year}`)), ...(await listFiles(`${year}/hazards`))];

console.log(`Project: ${new URL(url).host}`);
console.log(
  `Year ${year}: ${subs} submissions (+ their votes), ${hazards} hazard reports, ${files.length} photo files.`,
);

if (!yes) {
  console.log("\nDry run — nothing deleted. Re-run with --yes to delete.");
  process.exit(0);
}

for (let i = 0; i < files.length; i += 100) {
  const { error } = await db.storage.from(BUCKET).remove(files.slice(i, i + 100));
  if (error) throw error;
}
// votes cascade from submissions.
for (const table of ["submissions", "hazards"]) {
  const { error } = await db.from(table).delete().eq("event_year", year);
  if (error) throw error;
}
console.log(
  `\nDeleted. ${await count("submissions")} submissions and ${(await listFiles(`${year}`)).length} photos remain.`,
);
