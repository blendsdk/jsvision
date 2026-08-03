/**
 * Removes terminal control code points from bounded diagnostic labels.
 *
 * This package-internal boundary keeps pure contract imports independently executable. Mounted
 * components still use the SDK rendering sanitizer at their output boundary.
 */
export function sanitizeContractText(value: string): string {
  let result = '';
  const characters = Array.from(value);
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint === 0x1b) {
      if (characters[index + 1] === '\\') index += 1;
      continue;
    }
    if (codePoint === 0x09 || codePoint === 0x0a) {
      result += character;
      continue;
    }
    if (codePoint < 0x20 || (codePoint >= 0x80 && codePoint <= 0x9f)) continue;
    result += character;
  }
  return result;
}
