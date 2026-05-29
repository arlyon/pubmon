/**
 * Bun preload — provides stubs for cloudflare:workers and @cloudflare/workers-types
 * so partyserver can be imported outside the Workers runtime.
 */
import { plugin } from "bun";

plugin({
	name: "cloudflare-workers-mock",
	setup(build) {
		build.module("cloudflare:workers", () => ({
			exports: {
				DurableObject: class DurableObject {
					ctx: any;
					env: any;
					constructor(ctx: any, env: any) {
						this.ctx = ctx;
						this.env = env;
					}
				},
				env: {},
			},
			loader: "object",
		}));
	},
});
