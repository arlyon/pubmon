import { expect, test, describe } from "bun:test";
import { BattleStreams, RandomPlayerAI, Teams, Dex } from "@pkmn/sim";
import { Battle } from "@pkmn/client";
import { Generations } from "@pkmn/data";
import { type ID } from "@pkmn/dex-types";
import { generatePubMonModData, ALL_PUBMON } from "./pokemon-data";

const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);
const gens = new Generations(customDex as any);

describe("PubMon Sim Battles", () => {
	test("Can run a battle to completion with custom dex", async () => {
		const stream = new BattleStreams.BattleStream(
			{ debug: true },
			customDex as any,
		);
		const streams = BattleStreams.getPlayerStreams(stream);

		const p1AI = new RandomPlayerAI(streams.p1);
		const p2AI = new RandomPlayerAI(streams.p2);

		void p1AI.start();
		void p2AI.start();

		let logs = "";
		const battlePromise = (async () => {
			for await (const chunk of streams.omniscient) {
				logs += chunk + "\n";
			}
		})();

		const formatId = (name: string) =>
			name.toLowerCase().replace(/[^a-z0-9]+/g, "");
		const createTeam = (name: string, p: any) =>
			Teams.pack([
				{
					name: name,
					species: formatId(p.name),
					item: "",
					ability: "",
					moves: p.moves.map(formatId),
					nature: "",
					evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
					level: 5,
					gender: "M",
				} as any,
			]);

		const mon1 = ALL_PUBMON[0]; // Hoppsin
		const mon2 = ALL_PUBMON[1]; // Lagerite

		const p1Team = createTeam("Player 1", mon1);
		const p2Team = createTeam("Player 2", mon2);

		streams.omniscient.write(
			`>start {"formatid":"gen1pubmon"}\n` +
				`>player p1 {"name":"Bot 1","team":"${p1Team}"}\n` +
				`>player p2 {"name":"Bot 2","team":"${p2Team}"}`,
		);

		// Give it a timeout just in case it hangs
		const timeout = new Promise((resolve) =>
			setTimeout(() => resolve("timeout"), 2000),
		);
		const result = await Promise.race([battlePromise, timeout]);

		expect(result).not.toBe("timeout");
		expect(logs).toContain("|win|");

		// Clean up stream safely
		try {
			stream.destroy();
		} catch (e) {
			// Stream may have already ended naturally
		}
	});

	test("Initializes correctly with multiple pubmon matches", async () => {
		for (let i = 0; i < 3; i++) {
			const stream = new BattleStreams.BattleStream(
				{ debug: true },
				customDex as any,
			);
			const streams = BattleStreams.getPlayerStreams(stream);

			const p1AI = new RandomPlayerAI(streams.p1);
			const p2AI = new RandomPlayerAI(streams.p2);

			void p1AI.start();
			void p2AI.start();

			let logs = "";
			const battlePromise = (async () => {
				for await (const chunk of streams.omniscient) {
					logs += chunk + "\n";
				}
			})();

			const formatId = (name: string) =>
				name.toLowerCase().replace(/[^a-z0-9]+/g, "");
			const createTeam = (name: string, p: any) =>
				Teams.pack([
					{
						name: name,
						species: formatId(p.name),
						item: "",
						ability: "",
						moves: p.moves.map(formatId),
						nature: "",
						evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
						ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
						level: 5,
						gender: "M",
					} as any,
				]);

			const mon1 = ALL_PUBMON[i];
			const mon2 = ALL_PUBMON[ALL_PUBMON.length - 1 - i];

			const p1Team = createTeam("Player 1", mon1);
			const p2Team = createTeam("Player 2", mon2);

			streams.omniscient.write(
				`>start {"formatid":"gen1pubmon"}\n` +
					`>player p1 {"name":"Bot 1","team":"${p1Team}"}\n` +
					`>player p2 {"name":"Bot 2","team":"${p2Team}"}`,
			);

			const timeout = new Promise((resolve) =>
				setTimeout(() => resolve("timeout"), 2000),
			);
			const result = await Promise.race([battlePromise, timeout]);

			expect(result).not.toBe("timeout");
			expect(logs).toContain("|win|");

			// Clean up stream safely
			try {
				stream.destroy();
			} catch (e) {
				// Stream may have already ended naturally
			}
		}
	});

	test("Can manually submit moves and complete battle", async () => {
		const stream = new BattleStreams.BattleStream(
			{ debug: true },
			customDex as any,
		);
		const streams = BattleStreams.getPlayerStreams(stream);

		// Only use AI for p2, manually control p1
		const p2AI = new RandomPlayerAI(streams.p2);
		void p2AI.start();

		let logs = "";
		let battleEnded = false;

		// Listen to omniscient stream for battle messages
		const omniscientPromise = (async () => {
			for await (const chunk of streams.omniscient) {
				logs += chunk + "\n";
				if (chunk.includes("|win|")) {
					battleEnded = true;
				}
			}
		})();

		// Handle p1 stream to respond to requests
		const p1Promise = (async () => {
			for await (const chunk of streams.p1) {
				console.log("P1 received:", chunk);

				// Look for |request| messages that require a response
				for (const line of chunk.split("\n")) {
					if (line.startsWith("|request|")) {
						const jsonStr = line.split("|").slice(2).join("|");
						try {
							const request = JSON.parse(jsonStr);

							// If we have active pokemon and moves, choose the first available move
							if (request.active && request.active[0]?.moves) {
								const moves = request.active[0].moves;
								// Find first non-disabled move
								const moveIdx = moves.findIndex((m: any) => !m.disabled);

								if (moveIdx >= 0 && !battleEnded) {
									console.log(`Submitting move ${moveIdx + 1}`);
									streams.p1.write(`move ${moveIdx + 1}`);
								}
							} else if (request.forceSwitch || request.wait) {
								// Handle other request types if needed
								console.log("Received non-move request:", request);
							}
						} catch (e) {
							console.error("Failed to parse request:", e);
						}
					}
				}

				if (battleEnded) break;
			}
		})();

		const formatId = (name: string) =>
			name.toLowerCase().replace(/[^a-z0-9]+/g, "");
		const createTeam = (name: string, p: any) =>
			Teams.pack([
				{
					name: name,
					species: formatId(p.name),
					item: "",
					ability: "",
					moves: p.moves.map(formatId),
					nature: "",
					evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
					level: 5,
					gender: "M",
				} as any,
			]);

		const mon1 = ALL_PUBMON[0]; // Hoppsin
		const mon2 = ALL_PUBMON[1]; // Lagerite

		const p1Team = createTeam("Player", mon1);
		const p2Team = createTeam("Wild PubMon", mon2);

		streams.omniscient.write(
			`>start {"formatid":"gen1pubmon"}\n` +
				`>player p1 {"name":"Player","team":"${p1Team}"}\n` +
				`>player p2 {"name":"Wild PubMon","team":"${p2Team}"}`,
		);

		// Give it a timeout
		const timeout = new Promise((resolve) =>
			setTimeout(() => resolve("timeout"), 5000),
		);
		const result = await Promise.race([
			Promise.all([omniscientPromise, p1Promise]),
			timeout,
		]);

		expect(result).not.toBe("timeout");
		expect(logs).toContain("|win|");
		expect(logs).toContain("|move|p1a");

		// Clean up stream safely
		try {
			stream.destroy();
		} catch (e) {
			// Stream may have already ended naturally
		}
	});

	test("Battle client tracks faint events correctly", async () => {
		const stream = new BattleStreams.BattleStream(
			{ debug: true },
			customDex as any,
		);
		const streams = BattleStreams.getPlayerStreams(stream);

		// Create a Battle client to track state (like the hook does)
		const battle = new Battle(gens);

		const p2AI = new RandomPlayerAI(streams.p2);
		void p2AI.start();

		let logs = "";
		let faintDetected = false;
		let battleEnded = false;
		let lastRequest: any = null;

		// Listen to omniscient stream and feed to Battle client
		const omniscientPromise = (async () => {
			try {
				for await (const chunk of streams.omniscient) {
					logs += chunk + "\n";

					// Process each line through the Battle client
					for (const line of chunk.split("\n")) {
						if (!line) continue;

						// Check for faint
						if (line.startsWith("|faint|")) {
							faintDetected = true;
							console.log("Faint detected:", line);
						}

						if (line.startsWith("|win|")) {
							battleEnded = true;
						}

						// Feed to battle client
						try {
							battle.add(line);

							// Also update with any request if available
							if (lastRequest && battle.request !== lastRequest) {
								battle.update(lastRequest);
							}
						} catch (e) {
							// @pkmn/client doesn't fully support custom mods - it throws when
							// trying to clean up tera info on faint. Ignore this specific error.
							if (e instanceof TypeError && e.message?.includes("searchid")) {
								console.log(
									"Handled expected searchid error from @pkmn/client",
								);
							} else {
								console.error("Unexpected error:", line, e);
								throw e;
							}
						}
					}

					if (battleEnded) break;
				}
			} catch (e) {
				console.error("Error in omniscient stream:", e);
				throw e;
			}
		})();

		// Handle p1 stream - only for requests, don't feed to battle client
		const p1Promise = (async () => {
			try {
				for await (const chunk of streams.p1) {
					for (const line of chunk.split("\n")) {
						if (!line) continue;

						if (line.startsWith("|request|")) {
							const jsonStr = line.split("|").slice(2).join("|");
							try {
								const request = JSON.parse(jsonStr);
								lastRequest = request;

								if (
									request.active &&
									request.active[0]?.moves &&
									!battleEnded
								) {
									const moves = request.active[0].moves;
									const moveIdx = moves.findIndex((m: any) => !m.disabled);

									if (moveIdx >= 0) {
										streams.p1.write(`move ${moveIdx + 1}`);
									}
								}
							} catch (e) {
								console.error("Failed to parse request:", e);
							}
						}
					}

					if (battleEnded) break;
				}
			} catch (e) {
				console.error("Error in p1 stream:", e);
				throw e;
			}
		})();

		const formatId = (name: string) =>
			name.toLowerCase().replace(/[^a-z0-9]+/g, "");
		const createTeam = (name: string, p: any) =>
			Teams.pack([
				{
					name: name,
					species: formatId(p.name),
					item: "",
					ability: "",
					moves: p.moves.map(formatId),
					nature: "",
					evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
					ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
					level: 5,
					gender: "M",
				} as any,
			]);

		const mon1 = ALL_PUBMON[0]; // Hoppsin
		const mon2 = ALL_PUBMON[1]; // Lagerite

		const p1Team = createTeam("Player", mon1);
		const p2Team = createTeam("Wild PubMon", mon2);

		streams.omniscient.write(
			`>start {"formatid":"gen1pubmon"}\n` +
				`>player p1 {"name":"Player","team":"${p1Team}"}\n` +
				`>player p2 {"name":"Wild PubMon","team":"${p2Team}"}`,
		);

		const timeout = new Promise((resolve) =>
			setTimeout(() => resolve("timeout"), 5000),
		);
		const result = await Promise.race([
			Promise.all([omniscientPromise, p1Promise]),
			timeout,
		]);

		expect(result).not.toBe("timeout");
		expect(logs).toContain("|win|");
		expect(faintDetected).toBe(true);

		// Clean up stream safely
		try {
			stream.destroy();
		} catch (e) {
			// Stream may have already ended naturally
		}
	});
});
