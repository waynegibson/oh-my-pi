// Groups of extension names that must never be simultaneously active (e.g. they hook the
// same events and would double-fire). Add new groups here as more conflicting extensions
// are introduced; no other code changes needed.
export const MUTUALLY_EXCLUSIVE_GROUPS = [["damage-control", "damage-control-continue"]];

/**
 * Pure, no I/O. Returns the first violated group ({ group, conflicting }) or null.
 */
export function findConflict(selectedNames) {
  const set = new Set(selectedNames);
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    const conflicting = group.filter((name) => set.has(name));
    if (conflicting.length > 1) {
      return { group, conflicting };
    }
  }
  return null;
}
