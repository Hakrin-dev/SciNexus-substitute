"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Eye, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/lib/api/services";
import { apiDelete, apiPut } from "@/lib/api/client";
import { toast } from "@/stores/toast";

/** 归档项目 `/my-projects` —— 已完成/已搁置的项目,可一键恢复为进行中(真实接口) */
export function ArchivedProjects() {
  const { data: projects = [], isLoading } = useProjects();
  const queryClient = useQueryClient();
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const archived = projects.filter((p) => p.status !== "进行中");

  const handleRestore = async (projectId: string, name: string) => {
    setRestoringId(projectId);
    try {
      await apiPut(`/api/projects/${projectId}`, { status: "进行中" });
      await queryClient.invalidateQueries({ queryKey: ["api", "projects"] });
      toast.success(`「${name}」已恢复为进行中`);
    } catch {
      toast.error("恢复失败，请稍后重试");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (projectId: string, name: string) => {
    if (typeof window !== "undefined" && !window.confirm(`确定删除「${name}」吗？此操作不可撤销。`))
      return;
    setDeletingId(projectId);
    try {
      await apiDelete(`/api/projects/${projectId}`);
      await queryClient.invalidateQueries({ queryKey: ["api", "projects"] });
      await queryClient.invalidateQueries({ queryKey: ["api", "project", projectId] });
      toast.success(`「${name}」已删除`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return null;

  if (archived.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-12 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-chip">
          <Archive className="size-5 text-faint" />
        </span>
        <p className="mt-3 text-sm text-muted">还没有归档的项目</p>
        <p className="mt-1 text-xs text-faint">
          项目完成后或手动搁置时，会自动出现在这里
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline"
        >
          前往课题工作台 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-faint">共 {archived.length} 个项目 · 数据来自你的项目库</p>
      {archived.map((project, i) => (
        <article
          key={project.id}
          className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both rounded-2xl bg-card p-5 shadow-card duration-300"
          style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-[15px] font-bold text-ink">{project.name}</h2>
            <Badge variant={project.status === "已完成" ? "green" : "gray"}>
              {project.status}
            </Badge>
            <span className="text-xs text-faint">
              创建于 {project.createdAt} · {project.milestones.length} 个里程碑
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={restoringId === project.id}
              onClick={() => void handleRestore(project.id, project.name)}
            >
              <ArchiveRestore className="size-3.5" />
              {restoringId === project.id ? "恢复中…" : "恢复为进行中"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto rounded-full text-faint hover:text-red-500"
              disabled={deletingId === project.id}
              onClick={() => void handleDelete(project.id, project.name)}
            >
              <Trash2 className="size-3.5" />
              {deletingId === project.id ? "删除中…" : "删除"}
            </Button>
          </div>

          <p className="mt-1.5 line-clamp-1 text-[13px] text-muted">{project.tagline}</p>

          {/* 进度条 */}
          <div className="mt-3 flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuenow={project.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 w-48 overflow-hidden rounded-full bg-chip"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted">{project.progress}%</span>
            <Link
              href={`/projects/${project.id}`}
              prefetch={false}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-xs font-medium text-primary hover:bg-primary/15"
            >
              <Eye className="size-3.5" />查看工作台
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
