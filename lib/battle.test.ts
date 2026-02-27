import { expect, test, describe } from "bun:test";
import { BattleStreams, RandomPlayerAI, Teams, Dex } from "@pkmn/sim";
import { type ID } from "@pkmn/dex-types";
import { generatePubMonModData, ALL_PUBMON } from "./pokemon-data";

const customDex = Dex.mod('pubmon' as ID, generatePubMonModData() as any);

describe("PubMon Sim Battles", () => {
    test("Can run a battle to completion with custom dex", async () => {
        const stream = new BattleStreams.BattleStream({ debug: true }, customDex as any);
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

        const formatId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const createTeam = (name: string, p: any) => Teams.pack([{
            name: name,
            species: formatId(p.name),
            item: '',
            ability: '',
            moves: p.moves.map(formatId),
            nature: '',
            evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
            level: 5,
            gender: 'M'
        } as any]);

        const mon1 = ALL_PUBMON[0]; // Hoppsin
        const mon2 = ALL_PUBMON[1]; // Lagerite

        const p1Team = createTeam('Player 1', mon1);
        const p2Team = createTeam('Player 2', mon2);

        streams.omniscient.write(
            `>start {"formatid":"gen1pubmon"}\n` +
            `>player p1 {"name":"Bot 1","team":"${p1Team}"}\n` +
            `>player p2 {"name":"Bot 2","team":"${p2Team}"}`
        );

        // Give it a timeout just in case it hangs
        const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), 2000));
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
            const stream = new BattleStreams.BattleStream({ debug: true }, customDex as any);
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

            const formatId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const createTeam = (name: string, p: any) => Teams.pack([{
                name: name,
                species: formatId(p.name),
                item: '',
                ability: '',
                moves: p.moves.map(formatId),
                nature: '',
                evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
                ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
                level: 5,
                gender: 'M'
            } as any]);

            const mon1 = ALL_PUBMON[i];
            const mon2 = ALL_PUBMON[ALL_PUBMON.length - 1 - i];

            const p1Team = createTeam('Player 1', mon1);
            const p2Team = createTeam('Player 2', mon2);

            streams.omniscient.write(
                `>start {"formatid":"gen1pubmon"}\n` +
                `>player p1 {"name":"Bot 1","team":"${p1Team}"}\n` +
                `>player p2 {"name":"Bot 2","team":"${p2Team}"}`
            );

            const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), 2000));
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
});
