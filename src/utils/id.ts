/**
 * Local-only id generator (not cryptographically secure). Avoids depending on
 * expo-crypto/react-native-get-random-values for ids that never leave the device.
 */
export function generateId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}_${timestamp}${random}`;
}
