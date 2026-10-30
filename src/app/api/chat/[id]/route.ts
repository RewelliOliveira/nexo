import { loadChatState } from "@/app/chat/_lib/load-chat";
import { getSessionEmployeeId } from "@/lib/session";
import { ConversationNotFoundError } from "@/services/conversations";

/** State of a conversation the chat refreshes after each reply. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/chat/[id]">,
): Promise<Response> {
  const employeeId = await getSessionEmployeeId();
  if (!employeeId) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Entre com seu e-mail corporativo." } },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
  try {
    return Response.json(await loadChatState(employeeId, id));
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
