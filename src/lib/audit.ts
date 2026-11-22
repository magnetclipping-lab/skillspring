import "server-only";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

/** Records an administrative action. Written with the service role; readable by admins only. */
export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  if (!hasAdminClient()) return;
  const { error } = await createAdminClient().rpc("log_audit", {
    p_actor: actorId,
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_metadata: metadata,
  });
  if (error) console.error("[audit] failed", action, error.message);
}
