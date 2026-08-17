import { z } from "zod";

/** 搜索表单校验 —— React Hook Form 配合 zodResolver 使用 */
export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "请输入搜索内容")
    .max(200, "搜索内容过长"),
});

export type SearchFormValues = z.infer<typeof searchSchema>;
