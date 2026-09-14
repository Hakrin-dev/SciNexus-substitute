/** 安全解码 Cookie 值；非法百分号编码按无效值处理。 */
export function decodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
