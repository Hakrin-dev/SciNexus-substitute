"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/api/services";

/** `/projects` 无独立主页面,重定向到第一个项目 */
export default function ProjectsIndexPage() {
  const router = useRouter();
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    if (projects[0]?.id) router.replace(`/projects/${projects[0].id}`);
  }, [projects, router]);

  return null;
}
