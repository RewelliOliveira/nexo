import type { Metadata } from "next";
import { NexoMark } from "../_components/NexoMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Nexo Assist" };

const STATS = [
  { value: "8 s", label: "primeira resposta, em média" },
  { value: "72%", label: "resolvidos sem fila" },
  { value: "6", label: "analistas online agora", live: true },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 bg-paper">
      <Showcase />

      <main className="flex min-w-0 flex-1 flex-col justify-between gap-10 px-6 py-8 sm:px-10 lg:py-10 xl:px-14">
        <div className="flex items-center justify-between gap-1.5 text-[13.5px] lg:justify-end">
          <span className="flex shrink-0 items-center gap-2.5 text-ink lg:hidden">
            <NexoMark className="w-6" />
            <span className="text-[17px] font-bold tracking-[-0.2px]">Nexo Assist</span>
          </span>
          <span className="flex flex-wrap justify-end gap-x-1.5">
            <span className="text-ink-3">Problema para entrar?</span>
            <a href="tel:4000" className="font-semibold text-primary-text hover:underline">
              Ligue no ramal 4000
            </a>
          </span>
        </div>

        <div className="flex justify-center">
          <LoginForm />
        </div>

        <footer className="flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-3">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </main>
    </div>
  );
}

/** Dark brand panel with a sample conversation; hidden on small screens. */
function Showcase() {
  return (
    <aside className="hidden w-[55.5%] max-w-200 shrink-0 flex-col justify-between overflow-hidden bg-ink px-12 pt-10 pb-12 lg:flex xl:px-16">
      <div className="flex items-center gap-2.5 text-white">
        <NexoMark className="w-6" />
        <span className="text-[17px] font-bold tracking-[-0.2px]">Nexo Assist</span>
      </div>

      <div className="flex flex-col gap-9">
        <div className="flex flex-col gap-4.5">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <p className="font-display text-[54px] leading-[1.04] tracking-[-1.2px] text-white">
            Seu problema de TI, resolvido em uma conversa.
          </p>
          <p className="max-w-130 text-base leading-[1.55] text-white/65">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na
            central de ajuda e chama um analista quando precisa.
          </p>
        </div>

        <div className="xl:pl-24">
          <div
            aria-hidden
            className="flex w-full max-w-125 flex-col gap-2.5 rounded-2xl border border-white/8 bg-white/4 p-4.5 text-[13.5px]"
          >
            <div className="flex justify-end">
              <p className="rounded-[12px_12px_4px_12px] bg-paper px-3.5 py-2.25 text-ink">
                Meu notebook não conecta na VPN. Erro 809.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="flex flex-wrap gap-x-1.5 text-[12.5px]">
                <span className="font-semibold text-white/80">Nexo Assist</span>
                <span className="text-white/45">consultou seus chamados · criou um chamado</span>
              </p>
              <p className="max-w-95 rounded-[4px_12px_12px_12px] bg-white/8 px-3.5 py-2.5 leading-normal text-white">
                Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h
                úteis.
              </p>
              <p className="flex w-fit items-center gap-2 rounded-xl bg-paper px-3 py-1.75 text-[12.5px]">
                <span className="size-1.75 rounded-full bg-warning" />
                <span className="font-semibold text-ink">INC-20517</span>
                <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 border-t border-white/10 pt-6">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className={`flex flex-col-reverse gap-1.5 ${index > 0 ? "border-l border-white/10 pl-6" : ""}`}
          >
            <dt className="text-[13.5px] text-white/55">{stat.label}</dt>
            <dd className="flex items-center gap-2 font-display text-[34px] leading-tight tracking-[-0.6px] text-white">
              {stat.value}
              {stat.live && <span className="size-2 rounded-full bg-success" />}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
