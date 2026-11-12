/**
 * 生成带时间前缀的随机 id。纯 JS 实现，保证 node 测试环境可用（不依赖 expo-crypto）。
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}
