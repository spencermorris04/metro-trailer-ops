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
        className="flex h-10 w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 text-left text-sm text-slate-500 transition hover:border-[var(--line-strong)] hover:bg-white"
      >
        <IconSearch size={16} className="text-slate-400" />
        <span className="min-w-0 flex-1 truncate">Run command, jump, or open a workspace</span>
        <kbd className="rounded border border-[var(--line)] bg-white px-1.5 py-0.5 font-mono text-[0.625rem] font-medium text-slate-400">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/50 px-4 pb-8 pt-[12vh] backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
              <IconSearch size={17} className="text-slate-500" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a route, queue, or command"
                className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-900 hover:text-slate-300"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
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
                      className={`flex w-full items-start gap-4 border-b border-slate-900 px-5 py-4 text-left transition ${
                        selected ? "bg-slate-900" : "bg-transparent hover:bg-slate-900/70"
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300">
                        <Icon name={command.icon} size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {command.label}
                          </p>
                          {active ? (
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-emerald-300">
                              Open
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {command.description}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-[0.68rem] uppercase tracking-[0.08em] text-slate-500">
              <span>Enter to run</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
