"use client";

import { CircleCheck, KeyRound, Mail, RotateCcwKey } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../../_components/Button";
import { requestPasswordReset, type PasswordResetState } from "../actions";

const INITIAL_STATE: PasswordResetState = { sent: false };

type PasswordCardProps = {
  email: string;
  /** e.g. "Alterada há 42 dias", when the directory knows it */
  changedLabel: string | null;
  className: string;
};

export function PasswordCard({ email, changedLabel, className }: PasswordCardProps) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, INITIAL_STATE);

  return (
    <section aria-label="Senha" className={className}>
      <div className="flex flex-wrap items-center gap-4 p-6">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-desk text-ink-2"
        >
          <KeyRound className="size-4.5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <h2 className="text-[14.5px] font-semibold text-ink">Senha</h2>
          {changedLabel && <p className="text-[13.5px] text-ink-3">{changedLabel}</p>}
        </div>
        <form action={formAction}>
          <Button type="submit" variant="secondary" disabled={pending}>
            <RotateCcwKey aria-hidden />
            {pending ? "Enviando…" : "Redefinir senha"}
          </Button>
        </form>
      </div>

      <p
        role="status"
        className="flex items-start gap-2 border-t border-rule bg-desk px-6 py-3 text-[13px] leading-normal text-ink-3"
      >
        {state.sent ? (
          <>
            <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-text" />
            <span className="min-w-0 wrap-anywhere">
              Pedido simulado para {email}. Ambiente de demonstração: nenhum e-mail é enviado.
            </span>
          </>
        ) : (
          <>
            <Mail aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 wrap-anywhere">
              Enviaremos um link de redefinição para {email}.
            </span>
          </>
        )}
      </p>
    </section>
  );
}
