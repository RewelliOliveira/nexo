import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppShell, TopBar } from "../_components/AppShell";
import { requireEmployee } from "../_lib/auth";
import { formatRelative } from "../_lib/format";
import { PasswordCard } from "./_components/PasswordCard";

export const metadata: Metadata = { title: "Meu perfil · Nexo Assist" };

const CARD_CLASS =
  "overflow-hidden rounded-2xl border border-ink/9 bg-paper shadow-[0_1px_2px_#1b24310d,0_6px_18px_#1b24310a]";

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const employee = await requireEmployee("employee");
  const changedLabel = employee.passwordChangedAt
    ? `Alterada ${formatRelative(employee.passwordChangedAt, new Date())}`
    : null;

  return (
    <AppShell employee={employee} current="profile">
      <TopBar current="Meu perfil" />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-10 sm:py-12">
        <div className="mx-auto flex w-full max-w-150 flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-[-0.4px] text-ink">Meu perfil</h1>
            <p className="text-[14.5px] text-ink-3">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <dl className={CARD_CLASS}>
            <ProfileRow label="Nome">{employee.name}</ProfileRow>
            <ProfileRow
              label="E-mail corporativo"
              note={
                <span className="flex shrink-0 items-center gap-1.25 text-[12.5px] text-ink-3">
                  <Lock aria-hidden className="size-3.25" />
                  Gerenciado pela TI
                </span>
              }
            >
              {employee.email}
            </ProfileRow>
          </dl>

          <PasswordCard
            email={employee.email}
            changedLabel={changedLabel}
            className={CARD_CLASS}
          />
        </div>
      </main>
    </AppShell>
  );
}

function ProfileRow({ label, note, children }: {
  label: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-rule px-6 py-5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <dt className="shrink-0 text-[13.5px] text-ink-3 sm:w-40">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="min-w-0 text-[14.5px] font-medium wrap-anywhere text-ink">{children}</span>
        {note}
      </dd>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" className="flex h-dvh bg-paper">
      <span className="sr-only">Carregando seu perfil…</span>
      <div aria-hidden className="hidden w-58 shrink-0 border-r border-rule md:block" />
      <div aria-hidden className="flex flex-1 flex-col">
        <div className="h-16 border-b border-rule" />
        <div className="mx-auto flex w-full max-w-150 animate-pulse flex-col gap-8 px-4 pt-12">
          <div className="h-12 w-72 rounded-sm bg-desk" />
          <div className="h-32 rounded-2xl bg-desk" />
          <div className="h-32 rounded-2xl bg-desk" />
        </div>
      </div>
    </div>
  );
}
