import { getServerByName } from "partyserver";
import { MainEventServer } from "./servers/MainEventServer";
import { BattleServer } from "./servers/BattleServer";
import { DurableObjectNamespace,
ExportedHandler } from "@cloudflare/workers-types";

/**
 * Router Entry Point for PubMon Server
 *
 * Routes WebSocket connections to appropriate Durable Objects:
 * - /parties/main/global -> MainEventServer (global event room)
 * - /parties/battle/:id -> BattleServer (isolated battle rooms)
 */

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // Route to Main Event Server
    if (url.pathname.startsWith("/parties/main")) {
      const roomName = "global";

      // 2. Use the helper to get the stub with correct headers
      const stub = await getServerByName(env.MAIN_EVENT_SERVER, roomName);

      // 3. Fetch from the stub
      return stub.fetch(request);
    }

    // Route to Battle Server
    if (url.pathname.startsWith("/parties/battle")) {
      const battleId = url.pathname.split("/").pop();
      if (!battleId) {
        return new Response("Invalid battle ID", { status: 400 });
      }

      const id = env.BATTLE_SERVER.idFromName(battleId);
      const stub = env.BATTLE_SERVER.get(id);
      return stub.fetch(request);
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<{ MAIN_EVENT_SERVER: DurableObjectNamespace; BATTLE_SERVER: DurableObjectNamespace }>;

// Export Durable Object classes
export { MainEventServer, BattleServer };
