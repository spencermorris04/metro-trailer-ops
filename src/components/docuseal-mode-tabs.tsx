"use client";

import { WorkspaceLink } from "@/components/workspace-link";
import { Icon, type IconName } from "@/components/icons";

type DocusealMode = "create" | "manage";

const tabs: Array<{
  key: DocusealMode;
  href: string;
  label: string;
  icon: IconName;
}> = [
  { key: "create", href: "/docuseal", label: "Create document", icon: "file-text" },
  { key: "manage", href: "/docuseal/templates", label: "Manage templates", icon: "folder" },
];

export function DocusealModeTabs({ active }: { active: DocusealMode }) {
  return (
    <div
      role="tablist"
      aria-label="E-Sign mode"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] border border-[var(--line)] bg-[var(--surface-soft)] p-0.5"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <WorkspaceLink
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[3px] px-3 text-[0.74rem] font-semibold transition ${
              isActive
                ? "bg-[#0f172a] text-white"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </WorkspaceLink>
        );
      })}
    </div>
  );
}
