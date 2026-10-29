import { getAnalystSession } from "@/app/console/_lib/analyst-session";
import { loadConversationList } from "@/app/console/_lib/load-console";

/** Every conversation, for the console list the analyst keeps polling. */
export async function GET(): Promise<Response> {
  const session = await getAnalystSession();
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: session.status });
  }
  return Response.json({ conversations: await loadConversationList() });
}
