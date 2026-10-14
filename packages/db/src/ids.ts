const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Prefixed, sortable, URL safe id: `cmp_lq0f3k2b_7h2k9d`.
 * Time prefix keeps rows roughly insertion ordered in indexes.
 */
export function createId(prefix: string): string {
  const time = Date.now().toString(36);
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let random = "";
  for (const byte of bytes) random += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${time}${random}`;
}
