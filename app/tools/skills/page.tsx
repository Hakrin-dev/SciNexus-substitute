import { SkillScroll } from "@/components/icons/skill-scroll";
import { ToolPage } from "@/components/features/tools/tool-page";
import { SkillsBoard } from "@/components/features/tools/skills-board";

/** Skills Bank `/tools/skills` —— 技能库(演示数据,启用状态本地持久化) */
export default function SkillsBankPage() {
  return (
    <ToolPage
      title="Skills Bank"
      subtitle="为 AI 助手扩展领域能力,开关即时生效"
      icon={SkillScroll}
      placeholder="技能库(演示占位)"
    >
      <SkillsBoard />
    </ToolPage>
  );
}
