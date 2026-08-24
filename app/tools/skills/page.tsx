import { SkillScroll } from "@/components/icons/skill-scroll";
import { ToolPage } from "@/components/features/tools/tool-page";

/** Skills Bank `/tools/skills` —— 技能库(演示占位) */
export default function SkillsBankPage() {
  return (
    <ToolPage
      title="Skills Bank"
      icon={SkillScroll}
      placeholder="技能库(演示占位)"
    />
  );
}
