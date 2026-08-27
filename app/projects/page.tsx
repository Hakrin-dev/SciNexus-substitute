"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/api/services";

/** `/projects` 无独立主页面,重定向到第一个项目 */
export default function ProjectsIndexPage() {
  const router = useRouter();
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    const active = projects.find((p) => p.status === "进行中");
    if (active?.id) router.replace(`/projects/${active.id}`);
    else if (projects.length) router.replace("/my-projects");
  }, [projects, router]);

  return null;
}
