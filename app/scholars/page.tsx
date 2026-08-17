import { redirect } from "next/navigation";

/** 原「研究构想」页已迁移至知识库 · 学者关系 */
export default function ScholarsPage() {
  redirect("/knowledge/scholars");
}
