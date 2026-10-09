#!/usr/bin/env npx tsx
/** Test helper: hammers the state lock from a separate process. */
import { mutate } from "./store.js";

const iterations = Number(process.argv[2] ?? 10);
for (let i = 0; i < iterations; i++) {
  await mutate((state) => {
    state.seq += 1;
  });
}
