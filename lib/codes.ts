import "server-only";
import { randomInt } from "node:crypto";

// No 0/O, 1/I/L — matches the CHECK constraint on submissions.code.
const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";

/**
 * Short, shout-able code like "B47". 23 × 8 × 8 = 1,472 combos, which is
 * plenty for one event; after a few collisions callers ask for a longer code
 * ("B472") so the insert loop always terminates quickly.
 */
export function generateCode(digitCount = 2): string {
  let code = LETTERS[randomInt(LETTERS.length)];
  for (let i = 0; i < digitCount; i++) code += DIGITS[randomInt(DIGITS.length)];
  return code;
}
