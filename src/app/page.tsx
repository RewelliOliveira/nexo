import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentEmployee, homePathFor } from "./_lib/auth";

export default function Home() {
  return (
    <Suspense>
      <RedirectToHome />
    </Suspense>
  );
}

async function RedirectToHome(): Promise<null> {
  const employee = await getCurrentEmployee();
  redirect(employee ? homePathFor(employee.role) : "/login");
}
