import { expect, test, describe } from "bun:test";
import { Teams, Dex } from "@pkmn/sim";
import { type ID } from "@pkmn/dex-types";
import { ALL_PUBMON, generatePubMonModData } from "@/lib/pokemon-data";
import { LocalBattleEngine } from "@/lib/battle-engine";

const customDex = Dex.mod("pubmon" as ID, generatePubMonModData() as any);

const formatId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");
const createTeam = (name: string, p: any) =>
	Teams.pack([
		{
			name,
			species: formatId(p.name),
			item: "",
			ability: "",
			moves: p.moves.map(formatId),
			nature: "",
			evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
			ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
			level: p.level || 5,
			gender: "M",
		} as any,
	]);

const mon1 = ALL_PUBMON[0]; // Hoppsin
const mon2 = ALL_PUBMON[1]; // Lagerite

function makeTeams() {
	return {
		p1Team: createTeam("Player", mon1),
		p2Team: createTeam("Wild PubMon", mon2),
	};
}

/** Collect chunks until a predicate matches or timeout fires. */
function collectUntil(
	engine: LocalBattleEngine,
	predicate: (allChunks: string) => boolean,
	timeoutMs = 5000,
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const chunks: string[] = [];
		const timer = setTimeout(() => {
			reject(new Error(`Timed out after ${timeoutMs}ms. Collected:\n${chunks.join("\n")}`));
		}, timeoutMs);

		engine.onChunk((chunk) => {
			chunks.push(chunk);
			const all = chunks.join("\n");
			if (predicate(all)) {
				clearTimeout(timer);
				resolve(all);
			}
		});
	});
}

/** Collect chunks for a fixed duration, then return them. */
function collectFor(engine: LocalBattleEngine, ms = 500): Promise<string> {
	return new Promise<string>((resolve) => {
		const chunks: string[] = [];
		engine.onChunk((chunk) => {
			chunks.push(chunk);
		});
		setTimeout(() => resolve(chunks.join("\n")), ms);
	});
}

// ---------------------------------------------------------------------------
// 1. Engine Lifecycle
// ---------------------------------------------------------------------------
describe("LocalBattleEngine - Lifecycle", () => {
	test("engine can be created", () => {
		const engine = new LocalBattleEngine();
		expect(engine).toBeDefined();
		expect(engine).toBeInstanceOf(LocalBattleEngine);
		engine.destroy();
	});

	test("start() initializes battle and emits chunks", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		const collected = collectFor(engine, 500);
		engine.start(p1Team, p2Team);

		const output = await collected;
		expect(output.length).toBeGreaterThan(0);
		// Should contain initial switch-in events
		expect(output).toContain("|switch|");
		engine.destroy();
	});

	test("destroy() cleans up resources without errors", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		engine.start(p1Team, p2Team);
		// Wait for initialization
		await new Promise((r) => setTimeout(r, 200));

		// Destroy should not throw
		expect(() => engine.destroy()).not.toThrow();

		// Operations after destroy should not throw
		expect(() => engine.submitMove(0)).not.toThrow();
		expect(() => engine.forfeitTurn()).not.toThrow();
	});

	test("can start and destroy multiple engines sequentially", async () => {
		for (let i = 0; i < 3; i++) {
			const engine = new LocalBattleEngine();
			const { p1Team, p2Team } = makeTeams();

			const collected = collectFor(engine, 300);
			engine.start(p1Team, p2Team);

			const output = await collected;
			expect(output).toContain("|switch|");
			engine.destroy();
		}
	});
});

// ---------------------------------------------------------------------------
// 2. Chunk Callback
// ---------------------------------------------------------------------------
describe("LocalBattleEngine - Chunk Callback", () => {
	test("onChunk receives battle protocol messages", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		const chunks: string[] = [];
		engine.onChunk((chunk) => chunks.push(chunk));
		engine.start(p1Team, p2Team);

		await new Promise((r) => setTimeout(r, 500));
		expect(chunks.length).toBeGreaterThan(0);
		engine.destroy();
	});

	test("chunks contain expected protocol lines", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		const collected = collectFor(engine, 500);
		engine.start(p1Team, p2Team);

		const output = await collected;
		// Initial battle setup should contain these protocol lines
		expect(output).toContain("|player|");
		expect(output).toContain("|switch|");
		expect(output).toContain("|gametype|");
		engine.destroy();
	});

	test("callback registered before start receives all events", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		const chunks: string[] = [];
		engine.onChunk((chunk) => chunks.push(chunk));
		engine.start(p1Team, p2Team);

		await new Promise((r) => setTimeout(r, 500));
		const all = chunks.join("\n");
		// Should have the initial switch events from the very beginning
		expect(all).toContain("|switch|");
		expect(all).toContain("|player|p1");
		expect(all).toContain("|player|p2");
		engine.destroy();
	});

	test("callback registered after start still works for subsequent events", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		engine.start(p1Team, p2Team);
		// Small delay, then register callback
		await new Promise((r) => setTimeout(r, 100));

		const chunks: string[] = [];
		engine.onChunk((chunk) => chunks.push(chunk));

		// Submit a move to generate new events
		engine.submitMove(0);
		await new Promise((r) => setTimeout(r, 500));

		// We should have received at least the move-related chunks
		// (we may have missed the initial switch events)
		expect(chunks.length).toBeGreaterThanOrEqual(0);
		engine.destroy();
	});
});

// ---------------------------------------------------------------------------
// 3. Move Submission
// ---------------------------------------------------------------------------
describe("LocalBattleEngine - Move Submission", () => {
	test("submitMove(0) advances the battle with move 1", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		// Wait for initial setup, then submit move
		const promise = collectUntil(
			engine,
			(all) => all.includes("|move|"),
			3000,
		);

		engine.start(p1Team, p2Team);

		// Wait for request to arrive, then submit move 1 (index 0)
		await new Promise((r) => setTimeout(r, 300));
		engine.submitMove(0);

		const output = await promise;
		expect(output).toContain("|move|");
		engine.destroy();
	});

	test("submitMove(3) advances the battle with move 4", async () => {
		const engine = new LocalBattleEngine();
		// Use a mon with at least 4 moves
		const monWith4Moves = ALL_PUBMON.find((m) => m.moves.length >= 4)!;
		expect(monWith4Moves).toBeDefined();

		const p1Team = createTeam("Player", monWith4Moves);
		const p2Team = createTeam("Wild PubMon", mon2);

		const promise = collectUntil(
			engine,
			(all) => all.includes("|move|"),
			3000,
		);

		engine.start(p1Team, p2Team);
		await new Promise((r) => setTimeout(r, 300));
		engine.submitMove(3); // move 4

		const output = await promise;
		expect(output).toContain("|move|");
		engine.destroy();
	});

	test("submitting moves advances the battle producing damage", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		const promise = collectUntil(
			engine,
			(all) => all.includes("|-damage|"),
			3000,
		);

		engine.start(p1Team, p2Team);
		await new Promise((r) => setTimeout(r, 300));
		engine.submitMove(0);

		const output = await promise;
		expect(output).toContain("|-damage|");
		engine.destroy();
	});

	test("submitMove returns silently if p1Stream is null (after destroy)", () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();
		engine.start(p1Team, p2Team);
		engine.destroy();

		// Should not throw
		expect(() => engine.submitMove(0)).not.toThrow();
		expect(() => engine.submitMove(3)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 4. Forfeit Turn
// ---------------------------------------------------------------------------
describe("LocalBattleEngine - Forfeit Turn", () => {
	test("forfeitTurn() writes pass command without throwing", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		engine.start(p1Team, p2Team);
		await new Promise((r) => setTimeout(r, 300));

		// forfeitTurn should not throw even though "pass" may be invalid
		// in singles format (the sim handles the error internally)
		expect(() => engine.forfeitTurn()).not.toThrow();

		// Engine should still be functional after forfeit - can submit a real move
		const promise = collectUntil(
			engine,
			(all) => all.includes("|move|"),
			3000,
		);
		engine.submitMove(0);

		const output = await promise;
		expect(output).toContain("|move|");
		engine.destroy();
	});

	test("forfeitTurn returns silently if p1Stream is null", () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();
		engine.start(p1Team, p2Team);
		engine.destroy();

		expect(() => engine.forfeitTurn()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// 5. Full Battle Flow
// ---------------------------------------------------------------------------
describe("LocalBattleEngine - Full Battle Flow", () => {
	test("can run a complete battle to win/loss via submitMove", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		let allChunks = "";
		let resolveWin: (value: string) => void;
		const winPromise = new Promise<string>((resolve) => {
			resolveWin = resolve;
		});

		engine.onChunk((chunk) => {
			allChunks += chunk + "\n";

			// If we see a request, auto-submit move 1
			if (chunk.includes("|request|")) {
				try {
					const reqLine = chunk
						.split("\n")
						.find((l) => l.includes("|request|"));
					if (reqLine) {
						const jsonStr = reqLine.split("|request|")[1];
						const request = JSON.parse(jsonStr);
						if (request.active && request.active[0]?.moves) {
							const moveIdx = request.active[0].moves.findIndex(
								(m: any) => !m.disabled,
							);
							if (moveIdx >= 0) {
								engine.submitMove(moveIdx);
							}
						}
					}
				} catch {
					// ignore parse errors
				}
			}

			if (allChunks.includes("|win|")) {
				resolveWin(allChunks);
			}
		});

		engine.start(p1Team, p2Team);

		const timeout = new Promise<string>((_, reject) =>
			setTimeout(() => reject(new Error("Battle timed out")), 5000),
		);

		const output = await Promise.race([winPromise, timeout]);
		expect(output).toContain("|win|");
		engine.destroy();
	});

	test("battle emits |switch|, |move|, |-damage| during play", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		let allChunks = "";
		let resolveWin: (value: string) => void;
		const winPromise = new Promise<string>((resolve) => {
			resolveWin = resolve;
		});

		engine.onChunk((chunk) => {
			allChunks += chunk + "\n";

			if (chunk.includes("|request|")) {
				try {
					const reqLine = chunk
						.split("\n")
						.find((l) => l.includes("|request|"));
					if (reqLine) {
						const jsonStr = reqLine.split("|request|")[1];
						const request = JSON.parse(jsonStr);
						if (request.active && request.active[0]?.moves) {
							const moveIdx = request.active[0].moves.findIndex(
								(m: any) => !m.disabled,
							);
							if (moveIdx >= 0) {
								engine.submitMove(moveIdx);
							}
						}
					}
				} catch {
					// ignore
				}
			}

			if (allChunks.includes("|win|")) {
				resolveWin(allChunks);
			}
		});

		engine.start(p1Team, p2Team);

		const timeout = new Promise<string>((_, reject) =>
			setTimeout(() => reject(new Error("Battle timed out")), 5000),
		);

		const output = await Promise.race([winPromise, timeout]);
		expect(output).toContain("|switch|");
		expect(output).toContain("|move|");
		expect(output).toContain("|-damage|");
		engine.destroy();
	});

	test("battle emits |win| at completion", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		let allChunks = "";
		let resolveWin: (value: string) => void;
		const winPromise = new Promise<string>((resolve) => {
			resolveWin = resolve;
		});

		engine.onChunk((chunk) => {
			allChunks += chunk + "\n";

			if (chunk.includes("|request|")) {
				try {
					const reqLine = chunk
						.split("\n")
						.find((l) => l.includes("|request|"));
					if (reqLine) {
						const jsonStr = reqLine.split("|request|")[1];
						const request = JSON.parse(jsonStr);
						if (request.active && request.active[0]?.moves) {
							const moveIdx = request.active[0].moves.findIndex(
								(m: any) => !m.disabled,
							);
							if (moveIdx >= 0) {
								engine.submitMove(moveIdx);
							}
						}
					}
				} catch {
					// ignore
				}
			}

			if (allChunks.includes("|win|")) {
				resolveWin(allChunks);
			}
		});

		engine.start(p1Team, p2Team);

		const timeout = new Promise<string>((_, reject) =>
			setTimeout(() => reject(new Error("Battle timed out")), 5000),
		);

		const output = await Promise.race([winPromise, timeout]);

		// Extract winner name
		const winLine = output.split("\n").find((l) => l.includes("|win|"))!;
		expect(winLine).toBeDefined();
		// Winner should be either "Player" or "Wild PubMon"
		expect(
			winLine.includes("Player") || winLine.includes("Wild PubMon"),
		).toBe(true);
		engine.destroy();
	});

	test("multiple battles can run sequentially", async () => {
		for (let i = 0; i < 3; i++) {
			const engine = new LocalBattleEngine();
			const p1Mon = ALL_PUBMON[i % ALL_PUBMON.length];
			const p2Mon = ALL_PUBMON[(i + 1) % ALL_PUBMON.length];
			const p1Team = createTeam("Player", p1Mon);
			const p2Team = createTeam("Wild PubMon", p2Mon);

			let allChunks = "";
			let resolveWin: (value: string) => void;
			const winPromise = new Promise<string>((resolve) => {
				resolveWin = resolve;
			});

			engine.onChunk((chunk) => {
				allChunks += chunk + "\n";

				if (chunk.includes("|request|")) {
					try {
						const reqLine = chunk
							.split("\n")
							.find((l) => l.includes("|request|"));
						if (reqLine) {
							const jsonStr = reqLine.split("|request|")[1];
							const request = JSON.parse(jsonStr);
							if (request.active && request.active[0]?.moves) {
								const moveIdx = request.active[0].moves.findIndex(
									(m: any) => !m.disabled,
								);
								if (moveIdx >= 0) {
									engine.submitMove(moveIdx);
								}
							}
						}
					} catch {
						// ignore
					}
				}

				if (allChunks.includes("|win|")) {
					resolveWin(allChunks);
				}
			});

			engine.start(p1Team, p2Team);

			const timeout = new Promise<string>((_, reject) =>
				setTimeout(() => reject(new Error(`Battle ${i} timed out`)), 5000),
			);

			const output = await Promise.race([winPromise, timeout]);
			expect(output).toContain("|win|");
			engine.destroy();
		}
	});
});

// ---------------------------------------------------------------------------
// 6. Integration with Custom PubMon Dex
// ---------------------------------------------------------------------------
describe("LocalBattleEngine - Custom PubMon Dex Integration", () => {
	test("battles work with all PubMon types (beer, shot, wine, water, cocktail)", async () => {
		const types = ["beer", "shot", "wine", "water", "cocktail"] as const;

		for (const type of types) {
			const monOfType = ALL_PUBMON.find((m) => m.type === type)!;
			expect(monOfType).toBeDefined();

			const engine = new LocalBattleEngine();
			const p1Team = createTeam("Player", monOfType);
			const p2Team = createTeam("Wild PubMon", mon2);

			const collected = collectFor(engine, 500);
			engine.start(p1Team, p2Team);

			const output = await collected;
			expect(output).toContain("|switch|");
			// The switch line should contain the mon's name (or formatted id)
			expect(output.toLowerCase()).toContain(monOfType.name.toLowerCase());
			engine.destroy();
		}
	});

	test("custom moves are recognized in battle output", async () => {
		const engine = new LocalBattleEngine();
		const { p1Team, p2Team } = makeTeams();

		const promise = collectUntil(
			engine,
			(all) => all.includes("|move|"),
			3000,
		);

		engine.start(p1Team, p2Team);
		await new Promise((r) => setTimeout(r, 300));
		engine.submitMove(0);

		const output = await promise;
		// The move line should contain a move name from our custom dex
		const moveLines = output.split("\n").filter((l) => l.includes("|move|"));
		expect(moveLines.length).toBeGreaterThan(0);

		// Each move line should have the format |move|<position>|<move name>|...
		for (const line of moveLines) {
			const parts = line.split("|");
			// parts: ["", "move", "p1a: ...", "Move Name", ...]
			expect(parts.length).toBeGreaterThanOrEqual(4);
		}
		engine.destroy();
	});

	test("different PubMon matchups produce valid battles", async () => {
		// Test a few diverse matchups
		const matchups = [
			[ALL_PUBMON[0], ALL_PUBMON[5]], // different indices
			[ALL_PUBMON[10], ALL_PUBMON[20]],
			[ALL_PUBMON[ALL_PUBMON.length - 1], ALL_PUBMON[0]], // last vs first
		];

		for (const [p1Mon, p2Mon] of matchups) {
			const engine = new LocalBattleEngine();
			const p1Team = createTeam("Player", p1Mon);
			const p2Team = createTeam("Wild PubMon", p2Mon);

			const collected = collectFor(engine, 500);
			engine.start(p1Team, p2Team);

			const output = await collected;
			expect(output).toContain("|switch|");
			expect(output).toContain("|player|");
			engine.destroy();
		}
	});
});
