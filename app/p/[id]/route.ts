import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const SERVER_URL =
	process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787";

/**
 * Pokeball scan endpoint. Resolves the claim entirely server-side (no CORS,
 * and the raw /p/<id> URL is never rendered) then redirects the trainer to
 * the game, handing the outcome over via a short-lived cookie.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const sessionId =
		(await cookies()).get("pubmon_session_id")?.value ?? null;

	let outcome: unknown;
	try {
		const res = await fetch(
			`${SERVER_URL}/parties/main/rpc/pokeball/${id}/claim`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionId }),
				cache: "no-store",
			},
		);
		outcome = res.ok ? await res.json() : { status: "error" };
	} catch {
		outcome = { status: "error" };
	}

	const response = NextResponse.redirect(new URL("/", request.url));
	// Consumed and cleared by GameShell on the next load.
	response.cookies.set("pubmon_ball_outcome", JSON.stringify(outcome), {
		path: "/",
		maxAge: 30,
		sameSite: "lax",
	});
	return response;
}
