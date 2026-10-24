/**
 * Adaptive polling, for servers whose sessions poll on a timer when
 * pushes don't reach them. Each answer suggests when to poll next: the
 * shortest interval after activity, growing by a step with every empty
 * poll up to a ceiling, so an idle session stops spending tokens on
 * checks that find nothing.
 *
 * Shared by crew and pr through a symlink; it imports only Node itself,
 * since it resolves from wherever the link points.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Interval bounds, in minutes. */
export interface PollBounds {
  min: number;
  step: number;
  max: number;
}

const DEFAULTS: PollBounds = { min: 10, step: 10, max: 60 };

/** Where the shared settings live; `JAY_CONFIG` points elsewhere, for tests. */
const JAY_CONFIG = process.env.JAY_CONFIG || join(homedir(), ".jay", "config.json");

/**
 * The `polling` section of `~/.jay/config.json`, over the defaults. A
 * value that isn't a positive number is an error, not ignored: a typo
 * would otherwise poll at a rate nobody chose.
 */
export function pollBounds(path = JAY_CONFIG): PollBounds {
  if (!existsSync(path)) return DEFAULTS;
  const section = JSON.parse(readFileSync(path, "utf8")).polling ?? {};
  const bounds = { ...DEFAULTS, ...section };
  for (const key of ["min", "step", "max"] as const) {
    if (typeof bounds[key] !== "number" || !(bounds[key] > 0)) {
      throw new Error(`${path}: polling.${key} must be a positive number of minutes`);
    }
  }
  return { ...bounds, max: Math.max(bounds.min, bounds.max) };
}

/** One session's interval, which a server keeps for the life of its process. */
export class Backoff {
  private minutes: number;

  constructor(private readonly bounds: PollBounds = pollBounds()) {
    this.minutes = bounds.min;
  }

  /** Records a poll, and returns the minutes until the next one. */
  next(active: boolean): number {
    this.minutes = active ? this.bounds.min : Math.min(this.minutes + this.bounds.step, this.bounds.max);
    return this.minutes;
  }
}
