import { redirect } from "next/navigation";

/** 旧路由 /database 重定向到 /knowledge/database(数据库已迁入知识库) */
export default function DatabaseRedirect() {
  redirect("/knowledge/database");
}
