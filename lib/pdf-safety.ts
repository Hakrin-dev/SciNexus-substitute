/** Reject loopback, link-local, and RFC1918 addresses before a server-side PDF fetch. */
export function isPrivatePdfAddress(address: string): boolean {
  const value = address.toLowerCase();
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;
  const pieces = value.split(".").map(Number);
  if (pieces.length !== 4 || pieces.some((piece) => !Number.isInteger(piece) || piece < 0 || piece > 255)) return false;
  const [a, b] = pieces;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}
