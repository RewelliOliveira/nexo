import { ChevronRight, LogOut, MessageSquare, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Employee } from "@/db/schema";
import { signOut } from "../login/actions";
import { NexoMark } from "./NexoMark";

type AppShellProps = {
  employee: Pick<Employee, "name" | "email">;
  /** Page highlighted in the navigation */
  current: "chat" | "profile";
  children: ReactNode;
};

/** Sidebar with navigation and the signed-in employee, around the page. */
export function AppShell({ employee, current, children }: AppShellProps) {
  return (
    <div className="flex h-dvh bg-paper">
      <aside className="hidden w-58 shrink-0 flex-col border-r border-rule px-3.5 pt-5 pb-3.5 md:flex">
        <div className="flex items-center gap-2.5 px-2 text-[#037AF6]">
          <NexoMark className="w-5" />
          <span className="text-base font-bold tracking-[-0.2px] text-ink">Nexo Assist</span>
        </div>

        <nav aria-label="Principal" className="mt-5.5 flex flex-col gap-0.5">
          <NavItem href="/chat" icon={MessageSquare} label="Atendimento" active={current === "chat"} />
          <NavItem href="/profile" icon={UserRound} label="Meu perfil" active={current === "profile"} />
        </nav>

        <div className="mt-auto flex items-center gap-2.5 border-t border-rule px-2 pt-3.5 pb-1">
          <span
            aria-hidden
            className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12.5px] font-bold text-primary-text"
          >
            {initials(employee.name)}
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <span className="truncate text-[13.5px] font-semibold text-ink">{employee.name}</span>
            <span className="truncate text-[11.5px] text-ink-3">{employee.email}</span>
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-8.5 w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk focus-visible:outline-2 focus-visible:outline-cta"
          >
            <LogOut aria-hidden className="size-4 text-ink-3" />
            Sair
          </button>
        </form>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

type TopBarProps = {
  /** Last breadcrumb item, e.g. "Atendimento" */
  current: string;
  /** Right side, e.g. the assistant status */
  aside?: ReactNode;
};

export function TopBar({ current, aside }: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-rule px-4 sm:gap-4 sm:px-8">
      {/* The sidebar is hidden on small screens: the top bar takes its links */}
      <Link href="/chat" aria-label="Atendimento" className="text-[#037AF6] md:hidden">
        <NexoMark className="w-5" />
      </Link>
      <nav aria-label="Você está em" className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px]">
        <span className="hidden text-ink-3 sm:inline">Service desk de TI</span>
        <ChevronRight aria-hidden className="hidden size-3.5 text-ink-3 sm:inline" />
        <span aria-current="page" className="truncate font-semibold text-ink">
          {current}
        </span>
      </nav>
      {aside}
      <Link
        href="/profile"
        aria-label="Meu perfil"
        className="flex size-9 items-center justify-center rounded-[8px] text-ink-3 hover:bg-desk md:hidden"
      >
        <UserRound aria-hidden className="size-4" />
      </Link>
      <form action={signOut} className="md:hidden">
        <button
          type="submit"
          aria-label="Sair"
          className="flex size-9 cursor-pointer items-center justify-center rounded-[8px] text-ink-3 hover:bg-desk"
        >
          <LogOut aria-hidden className="size-4" />
        </button>
      </form>
    </header>
  );
}

function NavItem({ href, icon: Icon, label, active }: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  if (active) {
    return (
      <Link
        href={href}
        aria-current="page"
        className="flex h-9 items-center gap-2.5 rounded-[8px] bg-primary-soft px-2.5 text-[13.5px] font-semibold text-primary-text focus-visible:outline-2 focus-visible:outline-cta"
      >
        <Icon aria-hidden className="size-4" />
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk focus-visible:outline-2 focus-visible:outline-cta"
    >
      <Icon aria-hidden className="size-4 text-ink-3" />
      {label}
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
