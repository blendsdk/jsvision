/**
 * Removes terminal control code points from bounded diagnostic labels.
 *
 * This package-internal boundary keeps pure contract imports independently executable. Mounted
 * components still use the SDK rendering sanitizer at their output boundary.
 */
export function sanitizeContractText(value: string, maximumCharacters: number): string {
  let result = '';
  let retainedCharacters = 0;
  const inputCeiling = Math.min(value.length, maximumCharacters * 8);
  for (let index = 0; index < inputCeiling && retainedCharacters < maximumCharacters;) {
    const codePoint = value.codePointAt(index) ?? 0;
    const character = String.fromCodePoint(codePoint);
    const width = codePoint > 0xffff ? 2 : 1;
    if (codePoint === 0x1b) {
      index += value[index + width] === '\\' ? width + 1 : width;
      continue;
    }
    index += width;
    if (codePoint === 0x09 || codePoint === 0x0a) {
      result += character;
      retainedCharacters += 1;
      continue;
    }
    if (codePoint < 0x20 || (codePoint >= 0x80 && codePoint <= 0x9f)) continue;
    result += character;
    retainedCharacters += 1;
  }
  return result;
}
