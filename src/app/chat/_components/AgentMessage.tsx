import { isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import type { TicketView } from "@/agent/tools/ticket-view";
import { TicketCard } from "../../_components/TicketCard";
import { quickRepliesOf, toCardTicket, toolCallsOf, type ToolCall } from "../_lib/tool-parts";
import { AgentActions, type DecisionIndex } from "./AgentActions";
import { DraftTicketCard, type DraftState } from "./DraftTicketCard";
import { RichText } from "./RichText";
import { TicketSelector } from "./TicketSelector";

export type AgentMessageContext = {
  decisions: DecisionIndex;
  /** The most recent reply of the conversation */
  latest: boolean;
  /** Buttons work: latest reply, agent free and the conversation still open */
  interactive: boolean;
  /** What the employee answered to this reply, if they did */
  nextUserText: string | null;
  /** Tickets created from drafts, by draft id */
  ticketsByDraft: ReadonlyMap<string, string>;
  now: Date;
  onSend(text: string): void;
  onCorrectDraft(): void;
};

type AgentMessageProps = AgentMessageContext & { message: UIMessage };

const TICKET_ID = /\b(?:INC|REQ)-\d+\b/i;

/**
 * A reply of Nexo Assist: who answered and what it did, then its text and
 * cards in the order they came. Cards that wait for the employee (ticket
 * selection, draft) go last, under the question.
 */
export function AgentMessage({ message, ...context }: AgentMessageProps) {
  const calls = toolCallsOf(message);
  const callsById = new Map(calls.map((call) => [call.toolCallId, call]));
  // The list is a question only when listing was the last step and the agent
  // asked nothing else; otherwise it was just a check (e.g. for duplicates)
  const asksWhichTicket =
    calls.at(-1)?.toolName === "listMyTickets" && quickRepliesOf(message).length === 0;

  const flow: ReactNode[] = [];
  const awaiting: ReactNode[] = [];
  let texts: string[] = [];
  const flushText = () => {
    if (texts.length === 0) return;
    flow.push(
      <AgentBubble key={`text-${flow.length}`}>
        <RichText text={texts.join("\n\n")} />
      </AgentBubble>,
    );
    texts = [];
  };

  for (const part of message.parts) {
    if (part.type === "text") {
      if (part.text.trim()) texts.push(part.text);
      continue;
    }
    if (!isToolUIPart(part)) continue;
    const call = callsById.get(part.toolCallId);
    if (!call || call.state !== "done" || !call.result) continue;

    const result = call.result;
    switch (result.tool) {
      case "listMyTickets":
        if (asksWhichTicket && result.data.tickets.length > 0) {
          awaiting.push(
            <TicketSelector
              key={call.toolCallId}
              tickets={result.data.tickets}
              selectedId={selectedTicket(result.data.tickets, context.nextUserText)}
              interactive={context.interactive}
              onSelect={(ticket) => context.onSend(`${ticket.id} · ${ticket.title}`)}
            />,
          );
        }
        break;
      case "draftTicket":
        awaiting.push(
          <DraftTicketCard
            key={call.toolCallId}
            draft={result.data.draft}
            dueAtIfCreatedNow={result.data.dueAtIfCreatedNow}
            similar={result.data.similar.active}
            state={draftState(result.data.draftId, context)}
            interactive={context.interactive}
            now={context.now}
            onConfirm={() => context.onSend("Pode abrir o chamado.")}
            onCorrect={context.onCorrectDraft}
            onCancel={() => context.onSend("Pode cancelar, não precisa abrir o chamado.")}
          />,
        );
        break;
      case "getTicket":
      case "createTicket":
      case "updateTicket":
      case "reopenTicket":
        flushText();
        flow.push(<ResultTicketCard key={call.toolCallId} call={call} now={context.now} />);
        break;
      default:
        break;
    }
  }
  flushText();

  return (
    <article className="flex flex-col gap-1.5">
      <AgentHeader>
        <AgentActions calls={calls} decisions={context.decisions} />
      </AgentHeader>
      {flow}
      {awaiting}
    </article>
  );
}

function ResultTicketCard({ call, now }: { call: ToolCall; now: Date }) {
  if (call.state !== "done" || !call.result) return null;
  const result = call.result;
  const view =
    result.tool === "getTicket" ||
    result.tool === "createTicket" ||
    result.tool === "updateTicket" ||
    result.tool === "reopenTicket"
      ? result.data.ticket
      : null;
  const ticket = view ? toCardTicket(view) : null;
  return ticket ? <TicketCard ticket={ticket} now={now} /> : null;
}

function selectedTicket(tickets: TicketView[], answer: string | null): string | null {
  const id = answer?.match(TICKET_ID)?.[0].toUpperCase();
  return tickets.some((ticket) => ticket.id === id) ? (id ?? null) : null;
}

function draftState(
  draftId: string,
  { ticketsByDraft, latest }: AgentMessageContext,
): DraftState {
  const ticketId = ticketsByDraft.get(draftId);
  if (ticketId) return { kind: "created", ticketId };
  return latest ? { kind: "pending" } : { kind: "unused" };
}

export function AgentHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
      <span className="font-semibold text-ink">Nexo Assist</span>
      {children}
    </div>
  );
}

export function AgentBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-fit max-w-150 flex-col gap-3 rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4 py-3 text-[14.5px] leading-normal text-ink">
      {children}
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-130 rounded-[12px_12px_4px_12px] bg-ink px-4 py-2.75 text-[14.5px] leading-[1.45] whitespace-pre-wrap text-white">
        {text}
      </p>
    </div>
  );
}

/** Shown while the agent has not written anything yet. */
export function AgentThinking() {
  return (
    <div role="status" className="flex flex-col gap-1.5">
      <AgentHeader>
        <span className="text-ink-3">pensando…</span>
      </AgentHeader>
      <div className="flex h-11 w-fit items-center gap-1 rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            style={{ animationDelay: `${delay}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-ink-3/60"
          />
        ))}
        <span className="sr-only">O Nexo Assist está respondendo</span>
      </div>
    </div>
  );
}
