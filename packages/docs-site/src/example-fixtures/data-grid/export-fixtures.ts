/** Hostile values used to make export escaping visible and deterministic. */
export const HOSTILE_EXPORT_VALUES: readonly string[] = Object.freeze([
  '=SUM(A1:A2)',
  '+SUM(A1:A2)',
  '-10+20',
  '@cmd',
  'comma,value',
  'tab\tvalue',
  '"quoted"',
  '<script>alert(1)</script>',
  'line\nbreak',
  'crlf\r\nbreak',
]);
