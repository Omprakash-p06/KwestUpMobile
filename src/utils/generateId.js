/**
 * Centralized ID generation.
 * =========================
 * Single source of truth for entity IDs, replacing scattered
 * `Date.now()` / `Math.random()` call sites that could produce duplicate keys
 * when two entities were created within the same millisecond
 * (see `.planning/codebase/CONCERNS.md` → "Collision-prone ID generation").
 *
 * Framework-agnostic and side-effect free beyond the module-local counter, so
 * it is safe to use from headless code (Android widgets) as well as the
 * React tree.
 *
 * Uniqueness is guaranteed by combining three independent sources:
 *   1. a base36 timestamp (coarse, roughly sortable),
 *   2. a process-local monotonic counter (per-process uniqueness, including
 *      two calls in the same millisecond),
 *   3. a random base36 suffix (cross-process uniqueness after a restart).
 *
 * IDs are opaque strings — never parse them or compare them numerically.
 */

let counter = 0;

/**
 * Generate a collision-resistant opaque ID.
 * @returns {string} e.g. "m1x2y3z-00001-k4f9qm"
 */
export const generateId = () => {
  counter = (counter + 1) % 0x1000000; // wrap well before Number precision limits
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(5, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${time}-${seq}-${rand}`;
};

export default generateId;
