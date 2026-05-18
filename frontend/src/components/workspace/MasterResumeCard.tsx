import { FileText, LayoutTemplate, Clock } from "lucide-react";
import type { Workspace } from "../../types/workspace";
import type { ResumeSection } from "../../types/resume";

interface MasterResumeCardProps {
  workspace: Workspace;
  sections: ResumeSection[];
  onViewDetails?: () => void;
}

export default function MasterResumeCard({
  workspace,
  sections,
  onViewDetails,
}: MasterResumeCardProps) {
  const visibleSectionCount = sections.filter((s) => s.visible).length;

  const formattedDate = new Date(workspace.updatedAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          主简历
        </span>
      </div>

      <button
        onClick={onViewDetails}
        className="w-full text-left rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50 cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground truncate">
            {workspace.title}
          </span>
          {onViewDetails && (
            <span className="text-[11px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
              详情 →
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 text-muted-foreground">
          <span className="flex items-center gap-1 text-[11px]">
            <FileText className="w-3 h-3" />
            {visibleSectionCount}
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <LayoutTemplate className="w-3 h-3" />
            {workspace.template}
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3" />
            {formattedDate}
          </span>
        </div>
      </button>
    </div>
  );
}
