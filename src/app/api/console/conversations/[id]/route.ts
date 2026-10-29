import { getAnalystSession } from "@/app/console/_lib/analyst-session";
import { loadConversationDetail } from "@/app/console/_lib/load-console";
import { ConversationNotFoundError } from "@/services/conversations";

/** History, decisions, handoff and tickets of the open conversation. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/console/conversations/[id]">,
): Promise<Response> {
  const session = await getAnalystSession();
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: session.status });
  }
  const { id } = await ctx.params;
  try {
    return Response.json(await loadConversationDetail(id));
  } catch (error) {
    if (error instanceof ConversationNotFoundError) {
      return Response.json(
        { error: { code: "not_found", message: "Conversa não encontrada." } },
        { status: 404 },
      );
    }
    throw error;
  }
}
