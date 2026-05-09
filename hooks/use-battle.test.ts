import { expect, test, describe } from "bun:test";

// =============================================================================
// Pure logic functions extracted from hooks/use-battle.ts for testing.
// These are exact copies of the functions defined inside useBattle().
// =============================================================================

function parseHpFromProtocol(
  hpString: string
): { hp: number; maxhp: number } | null {
  const match = hpString.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  return { hp: parseInt(match[1]), maxhp: parseInt(match[2]) };
}

function translateStatusMessage(line: string): string | null {
  const parts = line.split("|");

  const getPokemonName = (fullName: string): string => {
    return fullName.substring(4);
  };

  if (line.startsWith("|-status|")) {
    const pokemon = getPokemonName(parts[2]);
    const status = parts[3];
    if (
      status === "par" ||
      status === "slp" ||
      status === "psn" ||
      status === "tox"
    ) {
      return `${pokemon} is hung over!`;
    } else if (status === "brn" || status === "frz") {
      return `${pokemon} is completely hammered!`;
    }
  }

  if (line.startsWith("|cant|")) {
    const pokemon = getPokemonName(parts[2]);
    const reason = parts[3];
    if (reason === "par") return `${pokemon} is too hung over to move!`;
    else if (reason === "slp")
      return `${pokemon} is sleeping off the hangover!`;
    else if (reason === "frz")
      return `${pokemon} is hammered and frozen to the bar!`;
  }

  if (line.startsWith("|-damage|") && parts.length >= 4) {
    const pokemon = getPokemonName(parts[2]);
    const fromClause = parts.find((p) => p.startsWith("[from]"));
    if (fromClause) {
      if (fromClause.includes("psn") || fromClause.includes("tox"))
        return `${pokemon} is suffering from the hangover!`;
      else if (fromClause.includes("brn"))
        return `${pokemon} is hammered and burning up!`;
      else if (fromClause.includes("confusion"))
        return `${pokemon} is hammered and tripped over themselves!`;
    }
  }

  if (line.startsWith("|-curestatus|")) {
    const pokemon = getPokemonName(parts[2]);
    const status = parts[3];
    if (
      status === "par" ||
      status === "slp" ||
      status === "psn" ||
      status === "tox"
    ) {
      return `${pokemon} recovered from the hangover!`;
    } else if (status === "brn" || status === "frz") {
      return `${pokemon} sobered up!`;
    }
  }

  if (line.startsWith("|-start|") && line.includes("confusion")) {
    const pokemon = getPokemonName(parts[2]);
    return `${pokemon} is completely hammered!`;
  }

  if (line.startsWith("|-end|") && line.includes("confusion")) {
    const pokemon = getPokemonName(parts[2]);
    return `${pokemon} sobered up!`;
  }

  return null;
}

// =============================================================================
// Message queue simulation types (mirrors QueuedMessage from the hook)
// =============================================================================

interface QueuedMessage {
  text: string;
  playerHp?: number;
  enemyHp?: number;
  playerShake?: boolean;
  enemyShake?: boolean;
  playerAttacking?: boolean;
  enemyAttacking?: boolean;
  onDisplay?: () => void;
  delay?: number;
}

/**
 * Simulates the protocol line routing logic from handleEngineChunk.
 * Returns the queued messages that would be produced for a given protocol line.
 * Does NOT handle catch/run suppression of faint/win (that depends on mutable ref state).
 */
function routeProtocolLine(
  line: string,
  opts?: {
    p1Hp?: { hp: number; maxhp: number };
    p2Hp?: { hp: number; maxhp: number };
    onCatchSuccess?: () => void;
    onRunSuccess?: () => void;
  }
): QueuedMessage[] {
  const messages: QueuedMessage[] = [];
  const p1Hp = opts?.p1Hp ?? { hp: 0, maxhp: 0 };
  const p2Hp = opts?.p2Hp ?? { hp: 0, maxhp: 0 };

  // Catch success
  if (line.startsWith("|-activate|") && line.includes("shake3")) {
    messages.push({
      text: "Gotcha! The PubMon was caught!",
      onDisplay: opts?.onCatchSuccess,
    });
    return messages;
  }

  // Catch failure
  if (line.startsWith("|-activate|") && line.includes("shake1")) {
    messages.push({ text: "Oh no! The PubMon broke free!" });
    return messages;
  }

  // Skip sim messages
  if (line.startsWith("||message|") || line.startsWith("|message|")) {
    return messages;
  }

  // Status messages
  const translated = translateStatusMessage(line);
  if (translated) {
    messages.push({ text: translated });
  } else if (line.startsWith("|-damage|")) {
    const parts = line.split("|");
    const pkmn = parts[2].substring(4);
    const isPlayer = parts[2].startsWith("p1a");
    const isEnemy = parts[2].startsWith("p2a");

    messages.push({
      text: `${pkmn} took damage!`,
      playerHp: isPlayer ? p1Hp.hp : undefined,
      enemyHp: isEnemy ? p2Hp.hp : undefined,
      playerShake: isPlayer,
      enemyShake: isEnemy,
    });
  } else if (line.startsWith("|move|")) {
    const parts = line.split("|");
    const pkmn = parts[2].substring(4);
    const move = parts[3];
    const isPlayer = parts[2].startsWith("p1a");
    const isEnemy = parts[2].startsWith("p2a");
    const moveId = move.toLowerCase().replace(/[^a-z0-9]+/g, "");

    if (moveId === "catch") {
      return messages;
    }
    if (moveId === "run") {
      messages.push({
        text: "Got away safely!",
        onDisplay: opts?.onRunSuccess,
      });
      return messages;
    }

    messages.push({
      text: `${pkmn} used ${move}!`,
      playerAttacking: isPlayer,
      enemyAttacking: isEnemy,
    });
  } else if (line.startsWith("|-supereffective|")) {
    messages.push({ text: "It's super effective!" });
  } else if (line.startsWith("|-resisted|")) {
    messages.push({ text: "It's not very effective..." });
  } else if (line.startsWith("|faint|")) {
    const pkmn = line.split("|")[2].substring(4);
    messages.push({ text: `${pkmn} fainted!`, delay: 600 });
  } else if (line.startsWith("|win|")) {
    const winner = line.split("|")[2];
    if (winner === "Player") {
      messages.push({ text: "VICTORY!" });
    } else {
      messages.push({ text: "DEFEATED..." });
    }
  } else if (
    line.startsWith("|-boost|") ||
    line.startsWith("|-unboost|")
  ) {
    const parts = line.split("|");
    const pkmn = parts[2].substring(4);
    const stat = parts[3];
    const direction = line.startsWith("|-boost|") ? "rose" : "fell";
    messages.push({ text: `${pkmn}'s ${stat.toUpperCase()} ${direction}!` });
  }

  return messages;
}

// =============================================================================
// Tests
// =============================================================================

describe("parseHpFromProtocol", () => {
  test("parses standard HP string 20/20", () => {
    expect(parseHpFromProtocol("20/20")).toEqual({ hp: 20, maxhp: 20 });
  });

  test("parses partial HP string 15/100", () => {
    expect(parseHpFromProtocol("15/100")).toEqual({ hp: 15, maxhp: 100 });
  });

  test("parses zero HP 0/20", () => {
    expect(parseHpFromProtocol("0/20")).toEqual({ hp: 0, maxhp: 20 });
  });

  test("parses full HP 100/100", () => {
    expect(parseHpFromProtocol("100/100")).toEqual({ hp: 100, maxhp: 100 });
  });

  test("parses 0/0", () => {
    expect(parseHpFromProtocol("0/0")).toEqual({ hp: 0, maxhp: 0 });
  });

  test("parses large HP values 999/999", () => {
    expect(parseHpFromProtocol("999/999")).toEqual({ hp: 999, maxhp: 999 });
  });

  test("parses HP with status suffix like '20/20 par'", () => {
    const result = parseHpFromProtocol("20/20 par");
    expect(result).toEqual({ hp: 20, maxhp: 20 });
  });

  test("returns null for alphabetic string", () => {
    expect(parseHpFromProtocol("abc")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseHpFromProtocol("")).toBeNull();
  });

  test("returns null for number without slash", () => {
    expect(parseHpFromProtocol("20")).toBeNull();
  });

  test("returns null for '/20' (missing numerator)", () => {
    expect(parseHpFromProtocol("/20")).toBeNull();
  });

  test("returns null for '20/' (missing denominator)", () => {
    expect(parseHpFromProtocol("20/")).toBeNull();
  });

  test("returns null for arbitrary text", () => {
    expect(parseHpFromProtocol("no match here")).toBeNull();
  });

  test("parses HP embedded in longer string", () => {
    const result = parseHpFromProtocol("some prefix 42/100 suffix");
    expect(result).toEqual({ hp: 42, maxhp: 100 });
  });

  test("parses 0 faint string '0 fnt'", () => {
    // The protocol sometimes sends "0 fnt" on faint - no slash so should be null
    expect(parseHpFromProtocol("0 fnt")).toBeNull();
  });
});

describe("translateStatusMessage", () => {
  describe("|-status| messages (inflict status)", () => {
    test("par status produces hung over message", () => {
      expect(translateStatusMessage("|-status|p1a: Hoppsin|par")).toBe(
        " Hoppsin is hung over!"
      );
    });

    test("slp status produces hung over message", () => {
      expect(translateStatusMessage("|-status|p2a: Lagerite|slp")).toBe(
        " Lagerite is hung over!"
      );
    });

    test("psn status produces hung over message", () => {
      expect(translateStatusMessage("|-status|p1a: Cidra|psn")).toBe(
        " Cidra is hung over!"
      );
    });

    test("tox status produces hung over message", () => {
      expect(translateStatusMessage("|-status|p1a: Champain|tox")).toBe(
        " Champain is hung over!"
      );
    });

    test("brn status produces completely hammered message", () => {
      expect(translateStatusMessage("|-status|p1a: Tequilar|brn")).toBe(
        " Tequilar is completely hammered!"
      );
    });

    test("frz status produces completely hammered message", () => {
      expect(translateStatusMessage("|-status|p2a: Seltzerpent|frz")).toBe(
        " Seltzerpent is completely hammered!"
      );
    });
  });

  describe("|cant| messages (can't move)", () => {
    test("par cant produces too hung over message", () => {
      expect(translateStatusMessage("|cant|p1a: Hoppsin|par")).toBe(
        " Hoppsin is too hung over to move!"
      );
    });

    test("slp cant produces sleeping off message", () => {
      expect(translateStatusMessage("|cant|p1a: Stoutaur|slp")).toBe(
        " Stoutaur is sleeping off the hangover!"
      );
    });

    test("frz cant produces frozen to bar message", () => {
      expect(translateStatusMessage("|cant|p2a: Margaray|frz")).toBe(
        " Margaray is hammered and frozen to the bar!"
      );
    });
  });

  describe("|-damage| with [from] clause (residual damage)", () => {
    test("psn residual damage produces suffering message", () => {
      expect(
        translateStatusMessage("|-damage|p1a: Cidra|15/20|[from] psn")
      ).toBe(" Cidra is suffering from the hangover!");
    });

    test("tox residual damage produces suffering message", () => {
      expect(
        translateStatusMessage("|-damage|p2a: Whiscream|10/30|[from] tox")
      ).toBe(" Whiscream is suffering from the hangover!");
    });

    test("brn residual damage produces burning up message", () => {
      expect(
        translateStatusMessage("|-damage|p1a: Samburst|18/25|[from] brn")
      ).toBe(" Samburst is hammered and burning up!");
    });

    test("confusion self-hit produces tripped message", () => {
      expect(
        translateStatusMessage(
          "|-damage|p1a: Kitsake|12/20|[from] confusion"
        )
      ).toBe(" Kitsake is hammered and tripped over themselves!");
    });

    test("regular damage without [from] returns null (handled elsewhere)", () => {
      expect(
        translateStatusMessage("|-damage|p1a: Hoppsin|15/20")
      ).toBeNull();
    });
  });

  describe("|-curestatus| messages (cure status)", () => {
    test("par cure produces recovered message", () => {
      expect(translateStatusMessage("|-curestatus|p1a: Hoppsin|par")).toBe(
        " Hoppsin recovered from the hangover!"
      );
    });

    test("slp cure produces recovered message", () => {
      expect(translateStatusMessage("|-curestatus|p2a: Portoise|slp")).toBe(
        " Portoise recovered from the hangover!"
      );
    });

    test("psn cure produces recovered message", () => {
      expect(translateStatusMessage("|-curestatus|p1a: Ipape|psn")).toBe(
        " Ipape recovered from the hangover!"
      );
    });

    test("tox cure produces recovered message", () => {
      expect(translateStatusMessage("|-curestatus|p1a: Cognacat|tox")).toBe(
        " Cognacat recovered from the hangover!"
      );
    });

    test("brn cure produces sobered up message", () => {
      expect(translateStatusMessage("|-curestatus|p1a: Tequilar|brn")).toBe(
        " Tequilar sobered up!"
      );
    });

    test("frz cure produces sobered up message", () => {
      expect(
        translateStatusMessage("|-curestatus|p2a: Seltzerpent|frz")
      ).toBe(" Seltzerpent sobered up!");
    });
  });

  describe("|-start| and |-end| confusion", () => {
    test("confusion start produces completely hammered message", () => {
      expect(
        translateStatusMessage("|-start|p1a: Meadhorn|confusion")
      ).toBe(" Meadhorn is completely hammered!");
    });

    test("confusion end produces sobered up message", () => {
      expect(translateStatusMessage("|-end|p1a: Meadhorn|confusion")).toBe(
        " Meadhorn sobered up!"
      );
    });

    test("start without confusion returns null", () => {
      expect(
        translateStatusMessage("|-start|p1a: Meadhorn|Substitute")
      ).toBeNull();
    });

    test("end without confusion returns null", () => {
      expect(
        translateStatusMessage("|-end|p1a: Meadhorn|Substitute")
      ).toBeNull();
    });
  });

  describe("unknown lines", () => {
    test("empty string returns null", () => {
      expect(translateStatusMessage("")).toBeNull();
    });

    test("|move| line returns null", () => {
      expect(
        translateStatusMessage("|move|p1a: Hoppsin|Grain Slam")
      ).toBeNull();
    });

    test("|switch| line returns null", () => {
      expect(
        translateStatusMessage("|switch|p1a: Player|Hoppsin|20/20")
      ).toBeNull();
    });

    test("|-supereffective| returns null", () => {
      expect(translateStatusMessage("|-supereffective|p2a: Wild")).toBeNull();
    });

    test("arbitrary text returns null", () => {
      expect(translateStatusMessage("just some random text")).toBeNull();
    });
  });
});

describe("HP tracking from protocol messages", () => {
  test("|switch| sets player HP from actual values", () => {
    const line = "|switch|p1a: Player|Hoppsin|120/120";
    const parts = line.split("|");
    const hpPart = parts[4];
    const parsed = parseHpFromProtocol(hpPart);
    expect(parsed).toEqual({ hp: 120, maxhp: 120 });
  });

  test("|switch| sets enemy HP from percentage", () => {
    const line = "|switch|p2a: Wild PubMon|Lagerite|80/100";
    const parts = line.split("|");
    const hpPart = parts[4];
    const parsed = parseHpFromProtocol(hpPart);
    expect(parsed).toEqual({ hp: 80, maxhp: 100 });
  });

  test("|-damage| updates player HP", () => {
    const line = "|-damage|p1a: Player|15/20";
    const parts = line.split("|");
    const hpPart = parts[3];
    const parsed = parseHpFromProtocol(hpPart);
    expect(parsed).toEqual({ hp: 15, maxhp: 20 });
  });

  test("|-damage| updates enemy HP", () => {
    const line = "|-damage|p2a: Wild PubMon|50/100";
    const parts = line.split("|");
    const hpPart = parts[3];
    const parsed = parseHpFromProtocol(hpPart);
    expect(parsed).toEqual({ hp: 50, maxhp: 100 });
  });

  test("|-heal| restores player HP", () => {
    const line = "|-heal|p1a: Player|20/20";
    const parts = line.split("|");
    const hpPart = parts[3];
    const parsed = parseHpFromProtocol(hpPart);
    expect(parsed).toEqual({ hp: 20, maxhp: 20 });
  });

  test("|-heal| restores enemy HP", () => {
    const line = "|-heal|p2a: Wild PubMon|75/100";
    const parts = line.split("|");
    const hpPart = parts[3];
    const parsed = parseHpFromProtocol(hpPart);
    expect(parsed).toEqual({ hp: 75, maxhp: 100 });
  });

  test("|-damage| with faint (0 fnt) yields null from parseHpFromProtocol", () => {
    const parsed = parseHpFromProtocol("0 fnt");
    expect(parsed).toBeNull();
  });

  test("|-damage| with HP and status '15/20 par'", () => {
    const parsed = parseHpFromProtocol("15/20 par");
    expect(parsed).toEqual({ hp: 15, maxhp: 20 });
  });

  describe("percentage to actual HP conversion", () => {
    test("enemy with 100 maxhp is treated as percentage", () => {
      // When parsed.maxhp === 100, the hook converts using baseMaxhp
      const parsed = parseHpFromProtocol("80/100");
      expect(parsed).toEqual({ hp: 80, maxhp: 100 });
      // The hook would then convert: hp = Math.round((80/100) * baseMaxhp)
      const baseMaxhp = 150;
      const convertedHp = Math.round((parsed!.hp / 100) * baseMaxhp);
      expect(convertedHp).toBe(120);
    });

    test("enemy with non-100 maxhp is treated as actual values", () => {
      const parsed = parseHpFromProtocol("45/120");
      expect(parsed).toEqual({ hp: 45, maxhp: 120 });
      // maxhp !== 100, so no conversion needed
    });
  });
});

describe("Battle protocol message routing", () => {
  describe("|move| messages", () => {
    test("player move produces 'used' message with playerAttacking", () => {
      const msgs = routeProtocolLine("|move|p1a: Player|Grain Slam|p2a: Wild PubMon");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player used Grain Slam!");
      expect(msgs[0].playerAttacking).toBe(true);
      expect(msgs[0].enemyAttacking).toBeFalsy();
    });

    test("enemy move produces 'used' message with enemyAttacking", () => {
      const msgs = routeProtocolLine("|move|p2a: Wild PubMon|Tackle|p1a: Player");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Wild PubMon used Tackle!");
      expect(msgs[0].enemyAttacking).toBe(true);
      expect(msgs[0].playerAttacking).toBeFalsy();
    });

    test("Run move produces 'Got away safely!' message", () => {
      let runCalled = false;
      const msgs = routeProtocolLine("|move|p1a: Player|Run|p1a: Player", {
        onRunSuccess: () => {
          runCalled = true;
        },
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Got away safely!");
      // Verify callback is present
      expect(msgs[0].onDisplay).toBeDefined();
      msgs[0].onDisplay!();
      expect(runCalled).toBe(true);
    });

    test("Catch move produces no message (handled by shake events)", () => {
      const msgs = routeProtocolLine("|move|p1a: Player|Catch|p2a: Wild PubMon");
      expect(msgs).toHaveLength(0);
    });
  });

  describe("effectiveness messages", () => {
    test("|-supereffective| produces super effective message", () => {
      const msgs = routeProtocolLine("|-supereffective|p2a: Wild PubMon");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("It's super effective!");
    });

    test("|-resisted| produces not very effective message", () => {
      const msgs = routeProtocolLine("|-resisted|p2a: Wild PubMon");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("It's not very effective...");
    });
  });

  describe("|faint| messages", () => {
    test("player faint produces fainted message with delay", () => {
      const msgs = routeProtocolLine("|faint|p1a: Player");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player fainted!");
      expect(msgs[0].delay).toBe(600);
    });

    test("enemy faint produces fainted message with delay", () => {
      const msgs = routeProtocolLine("|faint|p2a: Wild PubMon");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Wild PubMon fainted!");
      expect(msgs[0].delay).toBe(600);
    });
  });

  describe("|win| messages", () => {
    test("Player win produces VICTORY message", () => {
      const msgs = routeProtocolLine("|win|Player");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("VICTORY!");
    });

    test("non-Player win produces DEFEATED message", () => {
      const msgs = routeProtocolLine("|win|Wild PubMon");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("DEFEATED...");
    });
  });

  describe("|-boost| and |-unboost| messages", () => {
    test("player ATK boost produces rose message", () => {
      const msgs = routeProtocolLine("|-boost|p1a: Player|atk|1");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player's ATK rose!");
    });

    test("enemy DEF unboost produces fell message", () => {
      const msgs = routeProtocolLine("|-unboost|p2a: Wild PubMon|def|1");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Wild PubMon's DEF fell!");
    });

    test("SPE boost is uppercased", () => {
      const msgs = routeProtocolLine("|-boost|p1a: Player|spe|2");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player's SPE rose!");
    });

    test("SPA unboost is uppercased", () => {
      const msgs = routeProtocolLine("|-unboost|p2a: Wild PubMon|spa|1");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Wild PubMon's SPA fell!");
    });
  });

  describe("catch events (|-activate| with shake)", () => {
    test("shake3 produces catch success message", () => {
      let catchCalled = false;
      const msgs = routeProtocolLine(
        "|-activate||shake3",
        { onCatchSuccess: () => { catchCalled = true; } }
      );
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Gotcha! The PubMon was caught!");
      msgs[0].onDisplay!();
      expect(catchCalled).toBe(true);
    });

    test("shake1 produces catch failure message", () => {
      const msgs = routeProtocolLine("|-activate||shake1");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Oh no! The PubMon broke free!");
    });
  });

  describe("|-damage| messages (regular, no [from])", () => {
    test("player damage includes playerShake and playerHp", () => {
      const msgs = routeProtocolLine("|-damage|p1a: Player|15/20", {
        p1Hp: { hp: 15, maxhp: 20 },
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player took damage!");
      expect(msgs[0].playerShake).toBe(true);
      expect(msgs[0].enemyShake).toBe(false);
      expect(msgs[0].playerHp).toBe(15);
      expect(msgs[0].enemyHp).toBeUndefined();
    });

    test("enemy damage includes enemyShake and enemyHp", () => {
      const msgs = routeProtocolLine("|-damage|p2a: Wild PubMon|50/100", {
        p2Hp: { hp: 50, maxhp: 100 },
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Wild PubMon took damage!");
      expect(msgs[0].enemyShake).toBe(true);
      expect(msgs[0].playerShake).toBe(false);
      expect(msgs[0].enemyHp).toBe(50);
      expect(msgs[0].playerHp).toBeUndefined();
    });
  });

  describe("|-damage| with [from] (status residual damage)", () => {
    test("psn residual routes to translateStatusMessage, not 'took damage'", () => {
      const msgs = routeProtocolLine("|-damage|p1a: Player|15/20|[from] psn");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player is suffering from the hangover!");
    });

    test("brn residual routes to translateStatusMessage", () => {
      const msgs = routeProtocolLine("|-damage|p1a: Player|10/20|[from] brn");
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(" Player is hammered and burning up!");
    });

    test("confusion self-hit routes to translateStatusMessage", () => {
      const msgs = routeProtocolLine(
        "|-damage|p1a: Player|12/20|[from] confusion"
      );
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe(
        " Player is hammered and tripped over themselves!"
      );
    });
  });

  describe("skipped messages", () => {
    test("|message| lines are skipped", () => {
      const msgs = routeProtocolLine("|message|Some sim message");
      expect(msgs).toHaveLength(0);
    });

    test("||message| lines are skipped", () => {
      const msgs = routeProtocolLine("||message|Some sim message");
      expect(msgs).toHaveLength(0);
    });
  });
});

describe("Message queue behavior", () => {
  test("single message in queue", () => {
    const queue: QueuedMessage[] = [{ text: "Hello!" }];
    const msg = queue.shift()!;
    expect(msg.text).toBe("Hello!");
    expect(queue).toHaveLength(0);
  });

  test("multiple messages process in order", () => {
    const queue: QueuedMessage[] = [
      { text: "First" },
      { text: "Second" },
      { text: "Third" },
    ];

    expect(queue.shift()!.text).toBe("First");
    expect(queue.shift()!.text).toBe("Second");
    expect(queue.shift()!.text).toBe("Third");
    expect(queue).toHaveLength(0);
  });

  test("empty queue produces no messages", () => {
    const queue: QueuedMessage[] = [];
    expect(queue.length).toBe(0);
    expect(queue.shift()).toBeUndefined();
  });

  test("processing lock prevents concurrent processing", () => {
    let processing = false;
    const queue: QueuedMessage[] = [{ text: "A" }, { text: "B" }];

    const process = (): boolean => {
      if (processing) return false;
      processing = true;
      queue.shift();
      // In the real hook, processing is set to false via continueMessage
      return true;
    };

    expect(process()).toBe(true); // First call succeeds
    expect(process()).toBe(false); // Second call is blocked
    processing = false; // Simulate continueMessage
    expect(process()).toBe(true); // Now it works again
  });

  test("message with HP updates carries HP values", () => {
    const msg: QueuedMessage = {
      text: "Player took damage!",
      playerHp: 15,
    };
    expect(msg.playerHp).toBe(15);
    expect(msg.enemyHp).toBeUndefined();
  });

  test("message with enemy HP carries enemy HP value", () => {
    const msg: QueuedMessage = {
      text: "Wild PubMon took damage!",
      enemyHp: 50,
    };
    expect(msg.enemyHp).toBe(50);
    expect(msg.playerHp).toBeUndefined();
  });

  test("message with animation flags", () => {
    const msg: QueuedMessage = {
      text: "Player used Grain Slam!",
      playerAttacking: true,
    };
    expect(msg.playerAttacking).toBe(true);
    expect(msg.enemyAttacking).toBeUndefined();
  });

  test("message with shake and flash flags for enemy", () => {
    const msg: QueuedMessage = {
      text: "Wild PubMon took damage!",
      enemyShake: true,
    };
    expect(msg.enemyShake).toBe(true);
    expect(msg.playerShake).toBeUndefined();
  });

  test("message with delay", () => {
    const msg: QueuedMessage = {
      text: "Player fainted!",
      delay: 600,
    };
    expect(msg.delay).toBe(600);
  });

  test("message with onDisplay callback", () => {
    let called = false;
    const msg: QueuedMessage = {
      text: "VICTORY!",
      onDisplay: () => {
        called = true;
      },
    };
    msg.onDisplay!();
    expect(called).toBe(true);
  });

  test("mixed queue with varied message types preserves order and data", () => {
    const queue: QueuedMessage[] = [
      { text: "Player used Grain Slam!", playerAttacking: true },
      { text: "It's super effective!" },
      { text: "Wild PubMon took damage!", enemyShake: true, enemyHp: 30 },
      { text: "Wild PubMon fainted!", delay: 600 },
      { text: "VICTORY!" },
    ];

    const first = queue.shift()!;
    expect(first.text).toBe("Player used Grain Slam!");
    expect(first.playerAttacking).toBe(true);

    const second = queue.shift()!;
    expect(second.text).toBe("It's super effective!");

    const third = queue.shift()!;
    expect(third.enemyShake).toBe(true);
    expect(third.enemyHp).toBe(30);

    const fourth = queue.shift()!;
    expect(fourth.delay).toBe(600);

    const fifth = queue.shift()!;
    expect(fifth.text).toBe("VICTORY!");
  });
});

/**
 * Stateful protocol processor that mirrors handleEngineChunk's suppression logic.
 * Tracks lastMoveUsed to suppress |faint|/|win| after catch or run,
 * and resets it on shake1 (catch failure) so battle events are NOT suppressed.
 */
function processProtocolLines(
  lines: string[],
  opts?: {
    onCatchSuccess?: () => void;
    onRunSuccess?: () => void;
  }
): QueuedMessage[] {
  const messages: QueuedMessage[] = [];
  let lastMoveUsed: string | null = null;

  for (const line of lines) {
    if (!line) continue;

    // Catch success: shake3 — don't update lastMoveUsed (stays "catch"), suppress faint/win
    if (line.startsWith("|-activate|") && line.includes("shake3")) {
      messages.push({
        text: "Gotcha! The PubMon was caught!",
        onDisplay: opts?.onCatchSuccess,
      });
      continue;
    }

    // Catch failure: shake1 — reset lastMoveUsed so faint/win are NOT suppressed
    if (line.startsWith("|-activate|") && line.includes("shake1")) {
      lastMoveUsed = null;
      messages.push({ text: "Oh no! The PubMon broke free!" });
      continue;
    }

    // Skip sim-generated messages
    if (line.startsWith("||message|") || line.startsWith("|message|")) {
      continue;
    }

    // Suppress faint/win/tie when caused by catch or run
    if (
      (line.startsWith("|win|") ||
        line.startsWith("|tie") ||
        line.startsWith("|faint|")) &&
      (lastMoveUsed === "catch" || lastMoveUsed === "run")
    ) {
      continue;
    }

    // Track last move used by the player (p1)
    if (line.startsWith("|move|p1a")) {
      const parts = line.split("|");
      const move = parts[3];
      if (move) {
        lastMoveUsed = move.toLowerCase().replace(/[^a-z0-9]+/g, "");
      }
    }

    messages.push(...routeProtocolLine(line, opts));
  }

  return messages;
}

describe("Capture and escape sequences (stateful suppression)", () => {
  describe("catch success", () => {
    test("catch move produces no message (handled by shake event)", () => {
      const msgs = processProtocolLines([
        "|move|p1a: Player|Catch|p2a: Wild PubMon",
      ]);
      expect(msgs).toHaveLength(0);
    });

    test("shake3 produces 'Gotcha!' message with onCatchSuccess callback", () => {
      let caught = false;
      const msgs = processProtocolLines(["|-activate||shake3"], {
        onCatchSuccess: () => { caught = true; },
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Gotcha! The PubMon was caught!");
      msgs[0].onDisplay!();
      expect(caught).toBe(true);
    });

    test("full catch success sequence: faint and win are suppressed", () => {
      let caught = false;
      const lines = [
        "|move|p1a: Player|Catch|p2a: Wild PubMon",
        "|-activate||shake3",
        "|faint|p2a: Wild PubMon",
        "|win|Player",
      ];
      const msgs = processProtocolLines(lines, {
        onCatchSuccess: () => { caught = true; },
      });
      // Only the "Gotcha!" message should appear — faint and win are suppressed
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Gotcha! The PubMon was caught!");
      msgs[0].onDisplay!();
      expect(caught).toBe(true);
    });

    test("catch success: |tie| is also suppressed", () => {
      const lines = [
        "|move|p1a: Player|Catch|p2a: Wild PubMon",
        "|-activate||shake3",
        "|tie",
      ];
      const msgs = processProtocolLines(lines);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Gotcha! The PubMon was caught!");
    });
  });

  describe("catch failure", () => {
    test("shake1 produces 'broke free' message", () => {
      const msgs = processProtocolLines(["|-activate||shake1"]);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Oh no! The PubMon broke free!");
    });

    test("after shake1, faint and win are NOT suppressed (battle continues)", () => {
      const lines = [
        "|move|p1a: Player|Catch|p2a: Wild PubMon",
        "|-activate||shake1",
        "|faint|p2a: Wild PubMon",
        "|win|Player",
      ];
      const msgs = processProtocolLines(lines);
      // shake1 resets suppression — all three events should produce messages
      expect(msgs).toHaveLength(3);
      expect(msgs[0].text).toBe("Oh no! The PubMon broke free!");
      expect(msgs[1].text).toBe(" Wild PubMon fainted!");
      expect(msgs[2].text).toBe("VICTORY!");
    });

    test("after shake1, a subsequent move can succeed normally", () => {
      const lines = [
        "|move|p1a: Player|Catch|p2a: Wild PubMon",
        "|-activate||shake1",
        "|move|p2a: Wild PubMon|Tackle|p1a: Player",
        "|-damage|p1a: Player|15/20",
      ];
      const msgs = processProtocolLines(lines, {
        p1Hp: { hp: 15, maxhp: 20 },
      } as any);
      expect(msgs).toHaveLength(3);
      expect(msgs[0].text).toBe("Oh no! The PubMon broke free!");
      expect(msgs[1].text).toBe(" Wild PubMon used Tackle!");
      expect(msgs[2].text).toBe(" Player took damage!");
    });
  });

  describe("escape / run", () => {
    test("run move produces 'Got away safely!' with onRunSuccess callback", () => {
      let ran = false;
      const msgs = processProtocolLines(
        ["|move|p1a: Player|Run|p1a: Player"],
        { onRunSuccess: () => { ran = true; } }
      );
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Got away safely!");
      msgs[0].onDisplay!();
      expect(ran).toBe(true);
    });

    test("full run sequence: faint and win are suppressed", () => {
      let ran = false;
      const lines = [
        "|move|p1a: Player|Run|p1a: Player",
        "|faint|p2a: Wild PubMon",
        "|win|Player",
      ];
      const msgs = processProtocolLines(lines, {
        onRunSuccess: () => { ran = true; },
      });
      // Only "Got away safely!" should appear — faint and win are suppressed
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Got away safely!");
      msgs[0].onDisplay!();
      expect(ran).toBe(true);
    });

    test("run sequence: |tie| is also suppressed", () => {
      const lines = ["|move|p1a: Player|Run|p1a: Player", "|tie"];
      const msgs = processProtocolLines(lines, {
        onRunSuccess: () => {},
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].text).toBe("Got away safely!");
    });

    test("run does not suppress enemy moves that occur before run", () => {
      const lines = [
        "|move|p2a: Wild PubMon|Tackle|p1a: Player",
        "|-damage|p1a: Player|15/20",
        "|move|p1a: Player|Run|p1a: Player",
        "|faint|p2a: Wild PubMon",
        "|win|Player",
      ];
      const msgs = processProtocolLines(lines, {
        onRunSuccess: () => {},
      });
      // Enemy turn messages appear; run message appears; faint/win suppressed
      expect(msgs).toHaveLength(3);
      expect(msgs[0].text).toBe(" Wild PubMon used Tackle!");
      expect(msgs[1].text).toBe(" Player took damage!");
      expect(msgs[2].text).toBe("Got away safely!");
    });
  });
});

describe("Multi-line protocol chunk routing", () => {
  test("a full turn produces correct sequence of messages", () => {
    const lines = [
      "|move|p1a: Player|Grain Slam|p2a: Wild PubMon",
      "|-supereffective|p2a: Wild PubMon",
      "|-damage|p2a: Wild PubMon|50/100",
      "|move|p2a: Wild PubMon|Tackle|p1a: Player",
      "|-damage|p1a: Player|15/20",
    ];

    const allMsgs: QueuedMessage[] = [];
    for (const line of lines) {
      allMsgs.push(
        ...routeProtocolLine(line, {
          p1Hp: { hp: 15, maxhp: 20 },
          p2Hp: { hp: 50, maxhp: 100 },
        })
      );
    }

    expect(allMsgs).toHaveLength(5);
    expect(allMsgs[0].text).toBe(" Player used Grain Slam!");
    expect(allMsgs[0].playerAttacking).toBe(true);
    expect(allMsgs[1].text).toBe("It's super effective!");
    expect(allMsgs[2].text).toBe(" Wild PubMon took damage!");
    expect(allMsgs[2].enemyShake).toBe(true);
    expect(allMsgs[3].text).toBe(" Wild PubMon used Tackle!");
    expect(allMsgs[3].enemyAttacking).toBe(true);
    expect(allMsgs[4].text).toBe(" Player took damage!");
    expect(allMsgs[4].playerShake).toBe(true);
  });

  test("a faint + win sequence produces correct messages", () => {
    const lines = [
      "|faint|p2a: Wild PubMon",
      "|win|Player",
    ];

    const allMsgs: QueuedMessage[] = [];
    for (const line of lines) {
      allMsgs.push(...routeProtocolLine(line));
    }

    expect(allMsgs).toHaveLength(2);
    expect(allMsgs[0].text).toBe(" Wild PubMon fainted!");
    expect(allMsgs[0].delay).toBe(600);
    expect(allMsgs[1].text).toBe("VICTORY!");
  });
});
