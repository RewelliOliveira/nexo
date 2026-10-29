"use client";

import { ArrowRight, Check, Info, LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";
import { Button } from "../_components/Button";
import { Input } from "../_components/Input";
import { signIn, type SignInState } from "./actions";

const INITIAL_STATE: SignInState = { email: "", remember: true };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} noValidate className="flex w-full max-w-95 flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[40px] leading-[1.1] tracking-[-0.8px] text-ink">
          Entrar
        </h1>
        <p className="text-[15.5px] leading-normal text-ink-3">
          Use seu e-mail corporativo e a senha da rede Nexo.
        </p>
      </div>

      <div className="flex flex-col gap-4.5">
        <Input
          label="E-mail corporativo"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="username"
          placeholder="nome@nexo.com.br"
          defaultValue={state.email}
          error={state.errors?.email}
          required
          autoFocus
        />
        <Input
          label="Senha"
          name="password"
          type="password"
          icon={LockKeyhole}
          autoComplete="current-password"
          placeholder="Sua senha da rede"
          error={state.errors?.password}
          required
          labelAction={
            <a
              href="https://senha.nexo.com.br"
              className="text-[13.5px] font-medium text-primary-text hover:underline"
            >
              Esqueci minha senha
            </a>
          }
        />
        <label className="flex w-fit cursor-pointer items-center gap-2.25 pt-0.5 text-[13.5px] text-ink-2">
          <span className="relative flex size-4.5 shrink-0">
            <input
              type="checkbox"
              name="remember"
              defaultChecked={state.remember}
              className="peer size-full cursor-pointer appearance-none rounded-sm border border-ink/20 bg-paper checked:border-cta checked:bg-cta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
            />
            <Check
              aria-hidden
              strokeWidth={3}
              className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-checked:opacity-100"
            />
          </span>
          Manter conectado neste computador
        </label>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar"}
        <ArrowRight aria-hidden />
      </Button>

      <p className="flex gap-2.5 border-t border-rule pt-4 text-[12.5px] leading-normal text-ink-3">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Ambiente de demonstração: qualquer senha é aceita para os e-mails cadastrados.
      </p>
    </form>
  );
}
