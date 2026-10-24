/**
 * The timers of every session in one opencode process, kept apart from
 * opencode's API so they can be tested with a fake `send`.
 *
 * A prompt sent while its session is mid-turn joins that turn, and the
 * model can drop what it was finishing, so a due prompt waits until the
 * session is idle, and only one is delivered per idle (SPEC.md).
 */

/** Milliseconds in a minute; timers are set in minutes. */
const MINUTE = 60_000;

export class Timers {
  /**
   * @param {(session: string, prompt: string, agent?: string) => Promise<void>} send
   *   delivers a prompt into a session; a rejection means it never arrived
   */
  constructor(send) {
    this.send = send;
    /** Pending timers by `session name`, each with its timeout handle. */
    this.timers = new Map();
    /** Due prompts waiting for their session to go idle, by `session name`. */
    this.held = new Map();
    /** Sessions mid-turn, or sent a prompt that has not started its turn yet. */
    this.busy = new Set();
  }

  /**
   * Sets `name` in `session` to send `prompt` after `minutes`, and every
   * `minutes` after that with `repeat`. Returns whether it replaced one.
   */
  set(session, { name, minutes, prompt, repeat = false, agent }) {
    const replaced = this.cancel(session, name);
    const timer = { session, name, minutes, prompt, repeat, agent };
    this.schedule(timer);
    this.timers.set(key(session, name), timer);
    return replaced;
  }

  /** Cancels `name` in `session`, including a prompt it left waiting. Returns whether there was one. */
  cancel(session, name) {
    const timer = this.timers.get(key(session, name));
    clearTimeout(timer?.handle);
    this.timers.delete(key(session, name));
    const held = this.held.delete(key(session, name));
    return Boolean(timer) || held;
  }

  /** A session's timers, soonest first, with the minutes left on each. */
  list(session) {
    return [...this.timers.values()]
      .filter((t) => t.session === session)
      .sort((a, b) => a.due - b.due)
      .map((t) => ({
        name: t.name,
        prompt: t.prompt,
        repeat: t.repeat,
        every_minutes: t.minutes,
        due_in_minutes: Math.max(0, Math.round(((t.due - Date.now()) / MINUTE) * 10) / 10),
        waiting_for_idle: this.held.has(key(t.session, t.name)),
      }));
  }

  /** Records a session's status from opencode's events; going idle delivers one waiting prompt. */
  status(session, busy) {
    if (busy) {
      this.busy.add(session);
      return;
    }
    this.busy.delete(session);
    const next = [...this.held.values()].find((t) => t.session === session);
    if (next) {
      this.held.delete(key(session, next.name));
      this.deliver(next);
    }
  }

  /** Drops everything for a session that no longer exists. */
  forget(session) {
    for (const timer of [...this.timers.values()]) if (timer.session === session) this.cancel(session, timer.name);
    this.busy.delete(session);
  }

  /** Starts the countdown to a timer's next firing. */
  schedule(timer) {
    timer.due = Date.now() + timer.minutes * MINUTE;
    timer.handle = setTimeout(() => this.fire(timer), timer.minutes * MINUTE);
    // Never what keeps a process alive: opencode's server does that.
    timer.handle.unref?.();
  }

  /**
   * A timer is due: deliver it now if its session is idle, else hold it,
   * replacing an older copy. A one-off stays listed until delivered.
   */
  fire(timer) {
    if (timer.repeat) this.schedule(timer);
    if (this.busy.has(timer.session)) this.held.set(key(timer.session, timer.name), timer);
    else this.deliver(timer);
  }

  /**
   * Sends a prompt, marking the session busy at once so a second timer
   * due before the turn starts waits for it. Marked as a timer's, so the
   * model can tell it from the user.
   */
  deliver(timer) {
    const k = key(timer.session, timer.name);
    if (!timer.repeat && this.timers.get(k) === timer) this.timers.delete(k);
    this.busy.add(timer.session);
    this.send(timer.session, `[timer ${timer.name}] ${timer.prompt}`, timer.agent).catch((err) => {
      this.busy.delete(timer.session);
      console.error(`[timer] couldn't send ${timer.name} to ${timer.session}: ${err?.message ?? err}`);
    });
  }
}

/** One key per timer: a name is unique within its session. */
function key(session, name) {
  return `${session} ${name}`;
}
