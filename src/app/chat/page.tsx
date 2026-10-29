import { Suspense } from "react";
import { Button } from "../_components/Button";
import { requireEmployee } from "../_lib/auth";
import { signOut } from "../login/actions";

export default function ChatPage() {
  return (
    <Suspense>
      <Placeholder />
    </Suspense>
  );
}

// Placeholder until the screen is built; already guarded by role
async function Placeholder() {
  const employee = await requireEmployee("employee");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-desk p-6 text-center">
      <p className="font-display text-3xl text-ink">Olá, {employee.name.split(" ")[0]}</p>
      <p className="text-[15.5px] text-ink-3">O chat com o Nexo Assist chega no próximo passo.</p>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sair
        </Button>
      </form>
    </main>
  );
}
