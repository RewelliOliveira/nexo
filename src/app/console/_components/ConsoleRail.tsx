import { LogOut, MessageCircle } from "lucide-react";
import type { Employee } from "@/db/schema";
import { NexoMark } from "../../_components/NexoMark";
import { signOut } from "../../login/actions";
import { initials } from "../_lib/console-view";

type ConsoleRailProps = {
  analyst: Pick<Employee, "name" | "email">;
  /** Conversations waiting for an analyst */
  waiting: number;
};

/** Narrow navigation of the console: logo, conversations and the analyst. */
export function ConsoleRail({ analyst, waiting }: ConsoleRailProps) {
  return (
    <nav
      aria-label="Console"
      className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-rule bg-desk py-4"
    >
      <span className="flex size-10 items-center justify-center pb-2 text-[#037AF6]">
        <NexoMark className="w-5.5" />
      </span>
      <span
        aria-current="page"
        title="Conversas"
        className="relative flex size-10 items-center justify-center rounded-[12px] bg-paper text-ink shadow-[0_1px_2px_#1b24310d]"
      >
        <MessageCircle aria-hidden className="size-4.75" />
        <span className="sr-only">Conversas</span>
        {waiting > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-desk bg-cta px-1 text-[10px] leading-none font-bold text-white">
            {waiting}
            <span className="sr-only"> aguardando atendimento</span>
          </span>
        )}
      </span>

      <form action={signOut} className="mt-auto">
        <button
          type="submit"
          title="Sair"
          className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-ink-3 hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-cta"
        >
          <LogOut aria-hidden className="size-4" />
          <span className="sr-only">Sair</span>
        </button>
      </form>
      <span
        title={`${analyst.name} · ${analyst.email}`}
        className="relative mt-1 flex size-9 items-center justify-center rounded-full bg-primary-soft text-[12.5px] font-bold text-primary-text"
      >
        {initials(analyst.name)}
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-desk bg-success"
        />
      </span>
    </nav>
  );
}
