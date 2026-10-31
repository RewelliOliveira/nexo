import { getAnalystSession } from "@/app/console/_lib/analyst-session";
import { getConsoleService } from "@/services/conversations";

/** Signal that the analyst is writing; the employee's chat shows the dots. */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/console/conversations/[id]/typing">,
): Promise<Response> {
  const session = await getAnalystSession();
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: session.status });
  }
  const { id } = await ctx.params;
  await getConsoleService().markTyping(id, session.analyst);
  return new Response(null, { status: 204 });
}
