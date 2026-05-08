"use client";

import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Icon, IconSearch, IconX, type IconName } from "@/components/icons";
import { navigationItems } from "@/lib/navigation";

type CommandAction = {
  id: string;
  label: string;
  description: string;
  keywords?: string[];
  icon?: IconName;
  run: () => void;
};

type CommandEntry = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  icon: IconName;
  run: () => void;
};

export function CommandBar({ actions = [] }: { actions?: CommandAction[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandEntry[] = [
    ...navigationItems.map((item) => ({
      id: item.href,
      label: item.label,
      description: item.description,
      keywords: [item.label, item.description, item.href],
      icon: item.icon,
      run: () => {
        startTransition(() => {
          router.push(item.href);
        });
        setOpen(false);
        setQuery("");
      },
    })),
    ...actions.map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      keywords: [action.label, action.description, ...(action.keywords ?? [])],
      icon: action.icon ?? "activity",
      run: () => {
        action.run();
        setOpen(false);
        setQuery("");
      },
    })),
  ];

  const filtered = query.trim()
    ? commands.filter((command) =>
        command.keywords.some((keyword) =>
          keyword.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      )
    : commands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (!open) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setQuery("");
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) =>
          filtered.length === 0 ? 0 : (current + 1) % filtered.length,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) =>
          filtered.length === 0 ? 0 : (current - 1 + filtered.length) % filtered.length,
        );
        return;
      }

      if (event.key === "Enter" && filtered[selectedIndex]) {
        event.preventDefault();
        filtered[selectedIndex]?.run();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, open, selectedIndex]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 w-full items-center gap-2 border border-[var(--line)] bg-[var(--surface-soft)] px-2 text-left text-[0.75rem] text-slate-400 transition hover:border-[var(--line-strong)]"
      >
        <IconSearch size={13} className="text-slate-300" />
        <span className="min-w-0 flex-1 truncate">Search or jump...</span>
        <kbd className="workspace-kbd">Ctrl K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/50 px-4 pb-8 pt-[10vh]">
          <div className="w-full max-w-2xl overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2.5">
              <IconSearch size={14} className="text-slate-500" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a route, queue, or command"
                className="flex-1 bg-transparent text-[0.8rem] text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="p-1 text-slate-500 transition hover:text-slate-300"
              >
                <IconX size={14} />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-[0.8rem] text-slate-500">
                  No commands match the current query.
                </div>
              ) : (
                filtered.map((command, index) => {
                  const selected = index === selectedIndex;
                  const active =
                    command.id.startsWith("/") &&
                    (pathname === command.id || pathname.startsWith(`${command.id}/`));

                  return (
                    <button
                      key={command.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => command.run()}
                      className={`flex w-full items-center gap-3 border-b border-slate-800 px-3 py-2 text-left transition ${
                        selected ? "bg-slate-800" : "bg-transparent hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon name={command.icon} size={15} className="text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[0.8rem] font-medium text-slate-200">
                            {command.label}
                          </span>
                          {active ? (
                            <span className="border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.06em] text-emerald-400">
                              Open
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-[0.7rem] text-slate-500">{command.description}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-700 px-3 py-2 text-[0.625rem] uppercase tracking-[0.06em] text-slate-500">
              <span>Enter to run</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
