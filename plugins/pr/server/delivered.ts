/**
 * Which events have already been pushed, so none is pushed twice. Every
 * source reports through it: a source's cursor can slip, for example on a
 * stale page from GitHub, and a watcher acts on each event it receives.
 */

/** How many deliveries are remembered: well over one round of every source. */
const REMEMBERED = 1000;

/** The recent deliveries, kept in the state file so a restart remembers them. */
export class Delivered {
  private keys: string[];
  private set: Set<string>;

  /** Starts from the keys saved in the state file, oldest first. */
  constructor(saved: string[] = []) {
    this.keys = saved.slice(-REMEMBERED);
    this.set = new Set(this.keys);
  }

  /**
   * Records a delivery, and whether it is new. The key includes the
   * timestamp because a notification keeps its id across updates, and
   * each update is news.
   */
  first(eventId: string, timestamp: string): boolean {
    const key = `${eventId}@${timestamp}`;
    if (this.set.has(key)) return false;
    this.set.add(key);
    this.keys.push(key);
    if (this.keys.length > REMEMBERED) {
      this.set.delete(this.keys.shift()!);
    }
    return true;
  }

  /** The keys to save, oldest first. */
  saved(): string[] {
    return [...this.keys];
  }
}
