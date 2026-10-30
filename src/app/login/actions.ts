"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/session";
import { getEmployeeService } from "@/services/employees";
import { homePathFor } from "../_lib/auth";

export type SignInState = {
  email: string;
  remember: boolean;
  errors?: { email?: string; password?: string };
};

const signInSchema = z.object({
  email: z.email("Informe um e-mail válido, como nome@nexo.com.br."),
  // The prototype accepts any password; it is still required, like the real form
  password: z.string().min(1, "Informe sua senha."),
  remember: z.boolean(),
});

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const input = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    remember: formData.get("remember") === "on",
  };
  const state: SignInState = { email: input.email, remember: input.remember };

  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    return { ...state, errors: { email: fields.email?.[0], password: fields.password?.[0] } };
  }

  const employee = await getEmployeeService().findByEmail(parsed.data.email);
  if (!employee) {
    return {
      ...state,
      errors: { email: "Não encontramos esse e-mail. Use seu e-mail corporativo da Nexo." },
    };
  }

  await createSession(employee.id, { remember: parsed.data.remember });
  redirect(homePathFor(employee.role));
}

export async function signOut(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
