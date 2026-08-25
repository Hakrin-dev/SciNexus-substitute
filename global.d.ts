/**
 * 全局类型声明
 * - 静态资源导入（Next.js 自动为这些模块提供 string 类型的 src）
 * - 运行时注入的外部后端地址(见 lib/api/client.ts)
 */

interface Window {
  /** 可选:运行时覆盖 API 基址(未设置时走同源相对路径) */
  __API_BASE__?: string;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.gif" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

declare module "*.ico" {
  const src: string;
  export default src;
}

declare module "*.bmp" {
  const src: string;
  export default src;
}
