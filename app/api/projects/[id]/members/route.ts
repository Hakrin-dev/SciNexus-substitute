import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getDB } from "@/lib/server/db";
import { ensureSeed, fail, ok, parseBody } from "@/lib/server/utils";
import { canAccessProject, projectMembers, writeAudit } from "@/lib/server/workbench";

export async function GET(req: NextRequest,{params}:{params:Promise<{id:string}>}) {
  ensureSeed(); const user=requireAuth(req); if(!user)return fail("请先登录",401,"UNAUTHORIZED");
  const {id}=await params; if(!canAccessProject(id,user.id,"read"))return fail("项目不存在",404);
  return ok(projectMembers(id));
}
export async function POST(req: NextRequest,{params}:{params:Promise<{id:string}>}) {
  ensureSeed(); const user=requireAuth(req); if(!user)return fail("请先登录",401,"UNAUTHORIZED");
  const {id}=await params; if(!canAccessProject(id,user.id,"admin"))return fail("没有成员管理权限",403,"FORBIDDEN");
  const body=await parseBody<{account?:string;role?:"admin"|"editor"|"viewer"}>(req); const account=body.account?.trim();
  if(!account)return fail("请输入用户名或邮箱",422); const db=getDB();
  const target=db.prepare("SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)").get(account,account) as {id:string}|undefined;
  if(!target)return fail("账号不存在",404); const role=["admin","editor","viewer"].includes(body.role||"") ? body.role! : "editor";
  db.prepare(`INSERT INTO project_members (project_id,user_id,role,created_at) VALUES (?,?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role`).run(id,target.id,role,new Date().toISOString());
  writeAudit({userId:user.id,projectId:id,action:"project.member.upsert",resourceType:"project_member",resourceId:target.id,metadata:{role}});
  return ok({userId:target.id,role});
}
