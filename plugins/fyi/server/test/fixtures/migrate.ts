/**
 * Runs `prepareStore` with a stand-in migration list, so the migration hook
 * can be tested before any real migration exists. Usage: `migrate.ts
 * <current> <migration versions…>`; prints each migration as it runs.
 */

import { prepareStore } from "../../store-version.js";

const [current, ...versions] = process.argv.slice(2).map(Number);
prepareStore(
  versions.map((version) => ({ version, description: `step ${version}`, run: () => console.log(`ran ${version}`) })),
  current,
);
