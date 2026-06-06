"use client";

/* ============================================================
   PubMon Admin Console — phase-aware operator dashboard.
   Recreated from the Claude Design handoff ("PubMon Admin Console.html"),
   wired to the live MainEventServer/BattleServer instead of mock data.
   Visual layer: ./admin-console.css (copied verbatim from the design).
   ============================================================ */

import { PartySocket } from "partysocket";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { GYMS } from "@/lib/gym-data";
import { getPubMonSprite } from "@/lib/pokemon-data";
import { CUSTOM_TRAINER_SPRITES, getTrainerSpritePath } from "@/lib/trainer-sprites";
import "./admin-console.css";

// ─── Wire-format types (subset the UI binds to) ──────────────────────────────

type Phase = "collection" | "tournament" | "hall-of-fame";
type MatchStatus = "pending" | "in_progress" | "completed" | "forfeited";

interface PartyMon {
	id?: number;
	name?: string;
	sprite?: string;
	level?: number;
	hp?: number;
	maxHp?: number;
	type?: string;
}
interface BattleLogEntry {
	outcome: "win" | "caught" | "run" | "lose";
	pokemon?: PartyMon;
	startTime?: number;
	endTime?: number;
}
interface PlayerState {
	sessionId: string;
	info: { name: string; sprite: string };
	party: PartyMon[];
	activeIndex: number;
	badges: number[];
	battleLog: BattleLogEntry[];
	tournamentOptIn: boolean;
	ribbons: string[];
	lastActivity: number;
	activeBattleId?: string;
}
interface TournamentMatch {
	matchId: string;
	player1SessionId: string;
	player2SessionId: string | null;
	battleId?: string;
	winnerId?: string;
	status: MatchStatus;
	adminOverride?: boolean;
}
interface Bracket {
	round: number;
	matches: TournamentMatch[];
	champion?: string;
	championName?: string;
}
interface Snapshot {
	phase: Phase;
	currentGymId: number;
	players: Record<string, PlayerState>;
	tournamentBracket?: Bracket;
	hallOfFame?: Record<string, string[]>;
}
interface BattleState {
	player1: { name: string; activePubmon: PartyMon; partyCount: number };
	player2: { name: string; activePubmon: PartyMon; partyCount: number };
	currentTurn: "player1" | "player2";
	turnCount: number;
	startedAt: number;
	lastMoveAt: number;
	serverNow: number;
	recvAt: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Canonical gym list (id, name, badge sprite) lives in lib/gym-data.ts so the
// admin console paces the crawl against the real pubs rather than a fixed count.
function gymById(id: number) {
	return GYMS[id - 1] ?? GYMS[0];
}

const RIBBONS = [
	{ name: "champion", label: "Champion", color: "#e8c170", path: "/sprites/ribbons/champion-ribbon.png" },
	{ name: "effort", label: "Effort", color: "#d23a43", path: "/sprites/ribbons/effort-ribbon.png" },
	{ name: "expert-battler", label: "Expert Battler", color: "#3f6fcf", path: "/sprites/ribbons/expert-battler-ribbon.png" },
	{ name: "legend", label: "Legend", color: "#8a5cd0", path: "/sprites/ribbons/legend-ribbon.png" },
	{ name: "best-friends", label: "Best Friends", color: "#cf6e98", path: "/sprites/ribbons/best-friends-ribbon.png" },
	{ name: "artist", label: "Artist", color: "#2497bd", path: "/sprites/ribbons/artist-ribbon.png" },
	{ name: "careless", label: "Careless", color: "#b07d3e", path: "/sprites/ribbons/careless-ribbon.png" },
	{ name: "relax", label: "Relax", color: "#3f9b39", path: "/sprites/ribbons/relax-ribbon.png" },
	{ name: "smile", label: "Smile", color: "#d4860a", path: "/sprites/ribbons/smile-ribbon.png" },
	{ name: "snooze", label: "Snooze", color: "#6e7a8a", path: "/sprites/ribbons/snooze-ribbon.png" },
];
const RIBBON_BY_PATH: Record<string, (typeof RIBBONS)[number]> = {};
RIBBONS.forEach((r) => (RIBBON_BY_PATH[r.path] = r));

const IDLE_AMBER = 60_000;
const IDLE_RED = 120_000;

// ─── Small helpers ───────────────────────────────────────────────────────────

function fmtClock(ms: number | null | undefined): string {
	if (ms == null || ms < 0) ms = 0;
	const s = Math.floor(ms / 1000);
	return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function shade(hex: string, amt: number): string {
	const n = parseInt(hex.slice(1), 16);
	let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
	r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function levelOf(p?: PlayerState): number {
	if (!p?.party?.length) return 1;
	return Math.max(...p.party.map((m) => m.level ?? 1));
}
function spriteFor(p?: PlayerState): string | null {
	const lead = p?.party?.[p?.activeIndex ?? 0] ?? p?.party?.[0];
	if (!lead) return null;
	if (lead.sprite) return lead.sprite;
	if (lead.name) return getPubMonSprite(lead.name);
	return null;
}
function winsOf(p?: PlayerState): number {
	return (p?.battleLog ?? []).filter((b) => b.outcome === "win").length;
}
function countOutcome(p: PlayerState | undefined, outcome: BattleLogEntry["outcome"]): number {
	return (p?.battleLog ?? []).filter((b) => b.outcome === outcome).length;
}
function winRateOf(p?: PlayerState): number | null {
	const w = countOutcome(p, "win");
	const total = w + countOutcome(p, "lose");
	return total ? Math.round((w / total) * 100) : null;
}
function uniqueMons(p: PlayerState | undefined, outcome?: BattleLogEntry["outcome"]): number {
	const s = new Set<string>();
	for (const e of p?.battleLog ?? []) {
		if (outcome && e.outcome !== outcome) continue;
		if (e.pokemon?.name) s.add(e.pokemon.name);
	}
	return s.size;
}
function seenOf(p?: PlayerState): number {
	return uniqueMons(p);
}
function caughtOf(p?: PlayerState): number {
	return uniqueMons(p, "caught");
}

// Player-list sort options. Selecting one sorts descending and surfaces the
// matching stat on each row.
type SortKey = "default" | "seen" | "caught" | "wins" | "winrate" | "badges";
const SORTS: { key: SortKey; label: string }[] = [
	{ key: "default", label: "Default order" },
	{ key: "seen", label: "Pokémon seen" },
	{ key: "caught", label: "Pokémon caught" },
	{ key: "wins", label: "Battles won" },
	{ key: "winrate", label: "Win rate" },
	{ key: "badges", label: "Badge count" },
];
const SORT_STATS: Record<Exclude<SortKey, "default">, { value: (p: PlayerState) => number; display: (p: PlayerState) => string }> = {
	seen: { value: seenOf, display: (p) => `${seenOf(p)} seen` },
	caught: { value: caughtOf, display: (p) => `${caughtOf(p)} caught` },
	wins: { value: winsOf, display: (p) => `${winsOf(p)} won` },
	winrate: { value: (p) => winRateOf(p) ?? -1, display: (p) => { const r = winRateOf(p); return r == null ? "no battles" : `${r}% WR`; } },
	badges: { value: (p) => p.badges.length, display: (p) => `${p.badges.length} badges` },
};

// Premade usernames = names with dedicated trainer portraits (lib/trainer-sprites).
const PREMADE_NAMES = Array.from(CUSTOM_TRAINER_SPRITES).sort();

const OUTCOME_META: Record<BattleLogEntry["outcome"], { label: string; color: string }> = {
	win: { label: "Won", color: "var(--blue)" },
	caught: { label: "Caught", color: "var(--amber)" },
	run: { label: "Ran", color: "var(--ink-3)" },
	lose: { label: "Lost", color: "#d23a43" },
};

// ─── Icons (clean line set; ported from the design) ──────────────────────────

function Icon({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties }) {
	const s: CSSProperties = { width: size, height: size, display: "block", ...style };
	const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
	switch (name) {
		case "search": return <svg viewBox="0 0 16 16" style={s}><circle cx="7" cy="7" r="4.2" {...P} /><line x1="10.2" y1="10.2" x2="14" y2="14" {...P} /></svg>;
		case "eye": return <svg viewBox="0 0 16 16" style={s}><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" {...P} /><circle cx="8" cy="8" r="1.9" {...P} /></svg>;
		case "eye-off": return <svg viewBox="0 0 16 16" style={s}><path d="M6.2 3.7A6.9 6.9 0 0 1 8 3.5C12.4 3.5 15 8 15 8a12 12 0 0 1-2.2 2.6M3.2 4.6A12 12 0 0 0 1 8s2.6 4.5 7 4.5a6.7 6.7 0 0 0 2.6-.5" {...P} /><line x1="2" y1="2" x2="14" y2="14" {...P} /></svg>;
		case "copy": return <svg viewBox="0 0 16 16" style={s}><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" {...P} /><path d="M3.5 10.5h-1V3a1 1 0 0 1 1-1H10v1" {...P} /></svg>;
		case "refresh": return <svg viewBox="0 0 16 16" style={s}><path d="M13.5 7a5.5 5.5 0 1 0-.6 3.4" {...P} /><path d="M13.7 3v3.2h-3.2" {...P} /></svg>;
		case "check": return <svg viewBox="0 0 16 16" style={s}><path d="M3 8.5 6.5 12 13 4.5" {...P} /></svg>;
		case "x": return <svg viewBox="0 0 16 16" style={s}><line x1="4" y1="4" x2="12" y2="12" {...P} /><line x1="12" y1="4" x2="4" y2="12" {...P} /></svg>;
		case "chevron": return <svg viewBox="0 0 16 16" style={s}><path d="M6 4l4 4-4 4" {...P} /></svg>;
		case "chevron-d": return <svg viewBox="0 0 16 16" style={s}><path d="M4 6l4 4 4-4" {...P} /></svg>;
		case "plus": return <svg viewBox="0 0 16 16" style={s}><line x1="8" y1="3" x2="8" y2="13" {...P} /><line x1="3" y1="8" x2="13" y2="8" {...P} /></svg>;
		case "clock": return <svg viewBox="0 0 16 16" style={s}><circle cx="8" cy="8" r="6" {...P} /><path d="M8 4.6V8l2.4 1.6" {...P} /></svg>;
		case "zzz": return <svg viewBox="0 0 16 16" style={s}><path d="M3 4h4L3 9h4" {...P} /><path d="M8.5 8h3.5l-3.5 4h3.5" {...P} /></svg>;
		case "swords": return <svg viewBox="0 0 16 16" style={s}><path d="M2 2.5l6.5 6.5M3.7 9.2 2 11l1 1 1.8-1.7M2 2.5l2.2.2.2 2.1" {...P} /><path d="M14 2.5 7.5 9M12.3 9.2 14 11l-1 1-1.8-1.7M14 2.5l-2.2.2-.2 2.1" {...P} /></svg>;
		case "trophy": return <svg viewBox="0 0 16 16" style={s}><path d="M4.5 2.5h7v3a3.5 3.5 0 0 1-7 0v-3Z" {...P} /><path d="M4.5 3.3H2.7v1A2 2 0 0 0 4.6 6.3M11.5 3.3h1.8v1a2 2 0 0 1-1.9 2M6.5 9.3l-.4 2.2h3.8l-.4-2.2M5 13.5h6" {...P} /></svg>;
		case "warn": return <svg viewBox="0 0 16 16" style={s}><path d="M8 2.2 14.5 13.5h-13L8 2.2Z" {...P} /><line x1="8" y1="6.5" x2="8" y2="9.5" {...P} /><circle cx="8" cy="11.4" r=".6" fill="currentColor" stroke="none" /></svg>;
		case "people": return <svg viewBox="0 0 16 16" style={s}><circle cx="6" cy="5.5" r="2.2" {...P} /><path d="M2.2 13c0-2.4 1.7-3.7 3.8-3.7S9.8 10.6 9.8 13" {...P} /><path d="M10.5 4.2a2 2 0 0 1 .3 3.7M11.2 9.6c1.6.3 2.8 1.4 2.8 3.4" {...P} /></svg>;
		default: return null;
	}
}

// ─── Primitives ──────────────────────────────────────────────────────────────

function Avatar({ player, className = "" }: { player?: PlayerState | null; className?: string }) {
	const src = spriteFor(player ?? undefined);
	if (!player || !src) {
		return <div className={"avatar tbd " + className}><span style={{ color: "var(--ink-4)", fontWeight: 700 }}>?</span></div>;
	}
	return <div className={"avatar " + className}><img className="sprite" src={src} alt={player.info.name} /></div>;
}

function Ribbon({ ribbon, size = 16 }: { ribbon?: (typeof RIBBONS)[number]; size?: number }) {
	if (!ribbon) return null;
	const c = ribbon.color, dark = shade(c, -28);
	return (
		<svg className="rosette" viewBox="0 0 16 16" style={{ width: size, height: size }}>
			<path d="M5 9 L3 15 L6 13.5 L7.5 16 L8.5 10" fill={dark} />
			<path d="M11 9 L13 15 L10 13.5 L8.5 16 L7.5 10" fill={c} />
			<circle cx="8" cy="6" r="5" fill={c} stroke={dark} strokeWidth="1.3" />
			<circle cx="8" cy="6" r="2.2" fill="#fff" opacity="0.85" />
		</svg>
	);
}

function HpBar({ hp, maxHp, flip }: { hp: number; maxHp: number; flip?: boolean }) {
	const pct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
	const cls = pct > 50 ? "hp-hi" : pct > 20 ? "hp-mid" : "hp-lo";
	return (
		<div className="hpbar" style={flip ? { flexDirection: "row-reverse" } : undefined}>
			<div className={"fill " + cls} style={{ width: pct + "%" }} />
		</div>
	);
}

function StatusBadge({ status, bye }: { status: MatchStatus; bye?: boolean }) {
	const map: Record<MatchStatus, { g: string; t: string }> = {
		pending: { g: "○", t: "Pending" },
		in_progress: { g: "●", t: "Live" },
		completed: { g: "✓", t: "Completed" },
		forfeited: { g: "—", t: "Void" },
	};
	if (bye) return <span className="sbadge bye"><span className="g">⤓</span>Bye</span>;
	const i = map[status] || map.pending;
	return <span className={"sbadge " + status}><span className="g">{i.g}</span>{i.t}</span>;
}

function Btn({ children, variant = "", size = "", className = "", icon, ...rest }: {
	children?: ReactNode; variant?: string; size?: string; className?: string; icon?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button className={["btn", variant, size, className].filter(Boolean).join(" ")} {...rest}>
			{icon && <span className="ic"><Icon name={icon} size={size === "sm" ? 13 : 14} /></span>}
			{children}
		</button>
	);
}

function Modal({ accent = "blue", iconName, title, children, actions, onClose }: {
	accent?: string; iconName?: string; title?: string; children?: ReactNode; actions?: ReactNode; onClose?: () => void;
}) {
	useEffect(() => {
		const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
		window.addEventListener("keydown", h);
		return () => window.removeEventListener("keydown", h);
	}, [onClose]);
	return (
		<div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
			<div className="modal" role="dialog" aria-modal="true">
				<div className={"modal-accent " + accent} />
				<div className="modal-body">
					{iconName && <div className={"modal-icon " + accent}><Icon name={iconName} size={20} /></div>}
					{title && <h3>{title}</h3>}
					{children}
				</div>
				<div className="modal-actions">{actions}</div>
			</div>
		</div>
	);
}

// ─── Confirm dialog plumbing ─────────────────────────────────────────────────

interface ConfirmCfg {
	accent: string; iconName: string; title: string; body: ReactNode;
	note?: { kind: "gold" | "green"; text: string } | null;
	confirmLabel: string; confirmVariant: string; onConfirm: () => void;
}
function ConfirmModal({ cfg, onClose }: { cfg: ConfirmCfg; onClose: () => void }) {
	return (
		<Modal accent={cfg.accent} iconName={cfg.iconName} title={cfg.title} onClose={onClose}
			actions={<>
				<Btn variant="ghost" onClick={onClose}>Cancel</Btn>
				<Btn variant={cfg.confirmVariant} onClick={() => { cfg.onConfirm(); onClose(); }}>{cfg.confirmLabel}</Btn>
			</>}>
			<p>{cfg.body}</p>
			{cfg.note && (
				<div className={"note " + cfg.note.kind}>
					<Icon name={cfg.note.kind === "gold" ? "warn" : "check"} size={15} style={{ flex: "none", marginTop: 1 }} />
					<span>{cfg.note.text}</span>
				</div>
			)}
		</Modal>
	);
}

// ─── Battle-timer derivation ─────────────────────────────────────────────────

function deriveTimer(b: BattleState | undefined, nowMs: number) {
	if (!b) return null;
	const offset = b.recvAt - b.serverNow;
	const eff = nowMs - offset;
	const total = eff - b.startedAt;
	const idle = eff - b.lastMoveAt;
	let level: "ok" | "amber" | "red" = "ok";
	if (idle > IDLE_RED) level = "red";
	else if (idle > IDLE_AMBER) level = "amber";
	return { total, idle, level, turnCount: b.turnCount };
}

// ─── Bracket helpers ─────────────────────────────────────────────────────────

function wouldAutoCrown(bracket: Bracket | undefined, players: Record<string, PlayerState>, matchId: string): string | null {
	if (!bracket) return null;
	const others = bracket.matches.filter((m) => m.matchId !== matchId);
	const resolved = (m: TournamentMatch) =>
		m.status === "completed" || m.status === "forfeited" || m.player2SessionId === null;
	if (!others.every(resolved)) return null;
	const winners = others.map((m) => m.winnerId).filter(Boolean) as string[];
	if (winners.length === 1) return players[winners[0]]?.info.name ?? winners[0];
	return null;
}

function playerBracketState(bracket: Bracket | undefined, phase: Phase, id: string): string | null {
	if (phase !== "tournament" || !bracket?.matches.length) return null;
	if (bracket.champion === id) return "champion";
	let inBracket = false, lost = false;
	bracket.matches.forEach((m) => {
		if (m.player1SessionId === id || m.player2SessionId === id) {
			inBracket = true;
			if ((m.status === "completed" || m.status === "forfeited") && m.winnerId && m.winnerId !== id) lost = true;
		}
	});
	if (!inBracket) return "out";
	if (lost) return "eliminated";
	return "active";
}

function playerActivity(p: PlayerState, nowMs: number) {
	const d = nowMs - p.lastActivity;
	if (d > 180_000) return { t: "Offline", cls: "off" };
	if (d > 60_000) return { t: "Idle", cls: "idle" };
	return { t: "Online", cls: "live" };
}

// ─── Socket / state hook ─────────────────────────────────────────────────────

const HOST = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8787";

function useAdminConsole() {
	const [secret, setSecret] = useState("");
	const [connected, setConnected] = useState(false);
	const [authError, setAuthError] = useState(false);
	const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
	const [bracket, setBracket] = useState<Bracket | null>(null);
	const socketRef = useRef<PartySocket | null>(null);
	const secretRef = useRef(secret);
	secretRef.current = secret;
	const reqTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		try { const s = localStorage.getItem("pubmon_admin_secret"); if (s) setSecret(s); } catch {}
	}, []);

	const requestState = useCallback(() => {
		if (reqTimer.current) clearTimeout(reqTimer.current);
		reqTimer.current = setTimeout(() => {
			const sk = socketRef.current;
			if (sk && secretRef.current) sk.send(JSON.stringify({ type: "admin_request_state", adminSecret: secretRef.current }));
		}, 120);
	}, []);

	useEffect(() => {
		const ws = new PartySocket({ host: HOST, party: "main", room: "global" });
		socketRef.current = ws;
		ws.addEventListener("open", () => { setConnected(true); requestState(); });
		ws.addEventListener("close", () => setConnected(false));
		ws.addEventListener("message", (ev: MessageEvent) => {
			let msg: any;
			try { msg = JSON.parse(ev.data); } catch { return; }
			switch (msg.type) {
				case "gym_update":
				case "leaderboard_sync":
				case "match_start":
				case "match_complete":
					requestState();
					break;
				case "tournament_start":
				case "bracket_update":
					setBracket(msg.bracket);
					requestState();
					break;
				case "hall_of_fame_ready":
					requestState();
					break;
				case "admin_state":
					setSnapshot(msg.state);
					setBracket(msg.state?.tournamentBracket ?? null);
					setAuthError(false);
					break;
				case "error":
					if (typeof msg.message === "string" && /admin cred/i.test(msg.message)) setAuthError(true);
					break;
			}
		});
		return () => ws.close();
	}, [requestState]);

	// Periodically refresh the snapshot so time-based player status
	// (online/idle/offline) stays accurate between gameplay broadcasts.
	useEffect(() => {
		const i = setInterval(() => requestState(), 15_000);
		return () => clearInterval(i);
	}, [requestState]);

	const send = useCallback((payload: Record<string, unknown>) => {
		const sk = socketRef.current;
		if (sk) sk.send(JSON.stringify({ ...payload, adminSecret: secretRef.current }));
	}, []);

	const updateSecret = useCallback((v: string) => {
		setSecret(v);
		try { localStorage.setItem("pubmon_admin_secret", v); } catch {}
		setAuthError(false);
	}, []);

	return { secret, updateSecret, connected, authError, snapshot, bracket, send, requestState };
}

// ─── Battle spectate hook (live timers) ──────────────────────────────────────

function useBattleTimers(bracket: Bracket | null) {
	const [states, setStates] = useState<Record<string, BattleState>>({});
	const [openedAt, setOpenedAt] = useState<Record<string, number>>({});
	const socksRef = useRef<Record<string, PartySocket>>({});

	const liveIds = useMemo(() => {
		const ids: string[] = [];
		bracket?.matches.forEach((m) => { if (m.status === "in_progress" && m.battleId) ids.push(m.battleId); });
		return ids;
	}, [bracket]);

	useEffect(() => {
		const want = new Set(liveIds);
		// close stale
		for (const id of Object.keys(socksRef.current)) {
			if (!want.has(id)) {
				socksRef.current[id].close();
				delete socksRef.current[id];
				setStates((s) => { const n = { ...s }; delete n[id]; return n; });
			}
		}
		// open new (read-only spectate — never send battle_join)
		for (const id of liveIds) {
			if (socksRef.current[id]) continue;
			const ws = new PartySocket({ host: HOST, party: "battle", room: id });
			socksRef.current[id] = ws;
			setOpenedAt((o) => ({ ...o, [id]: Date.now() }));
			ws.addEventListener("message", (ev: MessageEvent) => {
				let msg: any;
				try { msg = JSON.parse(ev.data); } catch { return; }
				if (msg.type === "battle_state") {
					setStates((s) => ({ ...s, [id]: { ...msg, recvAt: Date.now() } }));
				}
			});
		}
	}, [liveIds]);

	useEffect(() => () => { Object.values(socksRef.current).forEach((s) => s.close()); }, []);

	return { states, openedAt };
}

// ─── Clock tick ──────────────────────────────────────────────────────────────

function useTick() {
	const [, setT] = useState(0);
	useEffect(() => { const i = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(i); }, []);
}

// ─── Command bar ─────────────────────────────────────────────────────────────

function PhaseChip({ phase, bracket }: { phase: Phase; bracket: Bracket | null }) {
	const meta: Record<Phase, { g: string; t: string }> = {
		collection: { g: "◔", t: "Collection" },
		tournament: { g: "⚔", t: "Tournament" },
		"hall-of-fame": { g: "♛", t: "Hall of Fame" },
	};
	const m = meta[phase];
	const round = phase === "tournament" && bracket?.matches.length ? `R${bracket.round}` : null;
	return <span className={"phase-chip " + phase}><span className="glyph">{m.g}</span>{m.t}{round && <span className="round">{round}</span>}</span>;
}

function SecretField({ secret, authError, onChange }: { secret: string; authError: boolean; onChange: (v: string) => void }) {
	const [show, setShow] = useState(false);
	return (
		<div className="cb-secret">
			<label>Secret</label>
			<div className={"secret-field" + (authError ? " err" : "")}>
				<input type={show ? "text" : "password"} value={secret} placeholder="••••••••" spellCheck={false}
					onChange={(e) => onChange(e.target.value)} />
				<button onClick={() => setShow((s) => !s)} title={show ? "Hide" : "Show"}><Icon name={show ? "eye-off" : "eye"} size={14} /></button>
			</div>
			{authError && <span className="secret-err-msg">Invalid admin credentials</span>}
		</div>
	);
}

function GymSelector({ currentGymId, pending, setPending, onSet }: {
	currentGymId: number; pending: number; setPending: (n: number) => void; onSet: () => void;
}) {
	const gym = gymById(pending);
	const dirty = pending !== currentGymId;
	return (
		<div className="cb-group">
			<span className="cb-label">Gym</span>
			<div className="gym-select">
				<span className="gicon"><img src={gym.badgeSprite} alt={gym.name} /></span>
				<select value={pending} onChange={(e) => setPending(parseInt(e.target.value, 10))}>
					{GYMS.map((g) => (
						<option key={g.id} value={g.id}>{String(g.id).padStart(2, "0")} · {g.name}</option>
					))}
				</select>
			</div>
			<Btn size="sm" variant={dirty ? "primary" : ""} disabled={!dirty} onClick={onSet}>Set Gym</Btn>
			{dirty && <span className="gym-pending">unsaved</span>}
		</div>
	);
}

// ─── Bracket views ───────────────────────────────────────────────────────────

function BattleTimer({ timer }: { timer: { total: number; idle: number; level: "ok" | "amber" | "red" } }) {
	const lvl = timer.level;
	return (
		<div className={"timer-row " + (lvl === "ok" ? "" : lvl)}>
			<div className="tmr">
				<span className="lbl"><Icon name="clock" size={13} style={{ display: "inline" }} /></span>
				<span className="lbl">Total</span><span className="val">{fmtClock(timer.total)}</span>
			</div>
			<div className={"tmr idle " + lvl}>
				<span className="lbl"><Icon name="zzz" size={13} style={{ display: "inline" }} /></span>
				<span className="lbl">Idle</span><span className="val">{fmtClock(timer.idle)}</span>
			</div>
			{lvl === "amber" && <span className="stall-flag amber"><Icon name="warn" size={12} />Stalling</span>}
			{lvl === "red" && <span className="stall-flag red"><Icon name="warn" size={12} />Unresponsive</span>}
		</div>
	);
}

function PlayerLine({ player, active, winner, result, flip, bye }: {
	player?: PlayerState | null; active?: PartyMon | null; winner?: boolean; result?: string | null; flip?: boolean; bye?: boolean;
}) {
	if (!player) {
		return (
			<div className="player-line">
				<Avatar player={null} className="sm" />
				<div className="pl-main"><div className="pl-name tbd">{bye ? "Bye" : "—"}</div></div>
			</div>
		);
	}
	return (
		<div className="player-line">
			<Avatar player={player} className="sm" />
			<div className="pl-main">
				<div className="pl-name">{player.info.name}{winner && <span className="crown" title="Winner"><Icon name="trophy" size={14} style={{ display: "inline" }} /></span>}</div>
				{active
					? <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
						<span className="pl-meta nowrap">{active.name} · L{active.level}</span>
						<div style={{ flex: 1 }}><HpBar hp={active.hp ?? 0} maxHp={active.maxHp ?? 1} flip={flip} /></div>
					</div>
					: <div className="pl-meta">{result || ("Lv" + levelOf(player))}</div>}
			</div>
			{result && <div className={"pl-result " + (winner ? "win" : "lose")}>{result}</div>}
		</div>
	);
}

function MatchCard({ m, idxLabel, players, bracket, phase, battle, openedAt, now, act, confirm }: {
	m: TournamentMatch; idxLabel: number; players: Record<string, PlayerState>; bracket: Bracket;
	phase: Phase; battle?: BattleState; openedAt?: number; now: number;
	act: (type: string, extra?: Record<string, unknown>) => void; confirm: (c: ConfirmCfg) => void;
}) {
	const p1 = players[m.player1SessionId] ?? null;
	const p2 = m.player2SessionId ? players[m.player2SessionId] ?? null : null;
	const live = m.status === "in_progress";
	const timer = battle ? deriveTimer(battle, now) : null;
	const lvl = timer ? timer.level : "ok";

	let cardCls = "match-card";
	if (m.player2SessionId === null && m.status === "completed") cardCls += " bye";
	else if (m.status === "pending") cardCls += " pending";
	else if (m.status === "completed") cardCls += m.winnerId ? " done" : " void";
	else if (m.status === "forfeited") cardCls += " void";
	else if (live) cardCls += " " + (lvl === "ok" ? "live" : lvl);

	const isBye = m.player2SessionId === null;
	const crownName = live ? wouldAutoCrown(bracket, players, m.matchId) : null;

	// map battle sides to match players by name (BattleServer assigns by join order)
	const activeFor = (p?: PlayerState | null): PartyMon | null => {
		if (!live || !battle || !p) return null;
		if (battle.player1?.name === p.info.name) return battle.player1.activePubmon;
		if (battle.player2?.name === p.info.name) return battle.player2.activePubmon;
		return null;
	};

	const doVoid = () => confirm({
		accent: crownName ? "gold" : "danger",
		iconName: crownName ? "trophy" : "warn",
		title: crownName ? "Void will crown a champion" : "Void this match?",
		body: crownName
			? <>Voiding <b>Match {idxLabel}</b> leaves one player standing. <b>This will end the tournament and crown {crownName}.</b></>
			: <>Resolve <b>Match {idxLabel}</b> with <b>no winner</b>. Both players are released and nobody advances.</>,
		note: crownName ? { kind: "gold", text: "Irreversible — the round will advance." } : null,
		confirmLabel: crownName ? `Void & crown ${crownName}` : "Void match",
		confirmVariant: crownName ? "gold" : "danger-solid",
		onConfirm: () => act("admin_resolve_match", { matchId: m.matchId, winnerId: null }),
	});

	const resolved = m.status === "completed" || m.status === "forfeited";
	const resultFor = (p: PlayerState | null) => {
		if (!resolved || !p) return null;
		if (m.winnerId === p.sessionId) return isBye ? "Bye" : "Won";
		return m.winnerId ? "Out" : "";
	};

	return (
		<div className={cardCls}>
			<div className="mc-head">
				<span className="mc-title">Match {idxLabel}</span>
				<span className="mc-id">{m.matchId}{m.battleId ? " · " + m.battleId : ""}</span>
				<span className="spring" />
				<StatusBadge status={m.status} bye={isBye && m.status === "completed"} />
			</div>

			{live && timer && <BattleTimer timer={timer} />}
			{live && !timer && (
				<div className="waiting-note">
					<Icon name="clock" size={14} style={{ color: "var(--amber)" }} />
					Waiting for players to join · {fmtClock(openedAt ? now - openedAt : 0)} elapsed
				</div>
			)}

			<div className="mc-players">
				<PlayerLine player={p1} active={activeFor(p1)} winner={resolved && m.winnerId === p1?.sessionId} result={resultFor(p1)} />
				{live && battle && <div className="vs-tag">VS</div>}
				<PlayerLine player={p2} bye={isBye} flip active={activeFor(p2)} winner={resolved && m.winnerId === p2?.sessionId} result={resultFor(p2)} />
			</div>

			{live && crownName && (
				<div className="void-warn">
					<span className="wic"><Icon name="warn" size={15} /></span>
					<span>Voiding now would leave one winner — <b>this ends the tournament and crowns {crownName}.</b></span>
				</div>
			)}

			{live && (
				<div className="mc-actions">
					<Btn size="sm" variant="win-l" disabled={!p1} onClick={() => p1 && act("admin_resolve_match", { matchId: m.matchId, winnerId: p1.sessionId })}>
						<Icon name="chevron" size={13} style={{ transform: "rotate(180deg)" }} />{(p1 ? p1.info.name : "P1") + " wins"}
					</Btn>
					<Btn size="sm" variant="win-r" disabled={!p2} onClick={() => p2 && act("admin_resolve_match", { matchId: m.matchId, winnerId: p2.sessionId })}>
						{(p2 ? p2.info.name : "P2") + " wins"}<Icon name="chevron" size={13} />
					</Btn>
					<span className="spring" />
					<Btn size="sm" variant={crownName ? "gold" : "danger"} icon={crownName ? "trophy" : "x"} onClick={doVoid}>Void</Btn>
				</div>
			)}

			{resolved && !isBye && m.adminOverride && (
				<div className="mc-actions"><span className="spring" /><span className="muted" style={{ fontSize: "var(--fs-xs)" }}>Admin-resolved</span></div>
			)}
		</div>
	);
}

function LiveBracket({ snapshot, bracket, battles, openedAt, now, act, confirm }: {
	snapshot: Snapshot; bracket: Bracket; battles: Record<string, BattleState>; openedAt: Record<string, number>;
	now: number; act: (type: string, extra?: Record<string, unknown>) => void; confirm: (c: ConfirmCfg) => void;
}) {
	const matches = bracket.matches;
	const liveCount = matches.filter((m) => m.status === "in_progress").length;
	const doneCount = matches.filter((m) => m.status === "completed" || m.status === "forfeited").length;
	return (
		<div>
			<div className="sec-head">
				<h2>Live Bracket</h2>
				<span className="rule" />
				{bracket.champion && <span className="tag-champ" style={{ fontSize: 11, padding: "3px 10px" }}>♛ Champion — {bracket.championName ?? snapshot.players[bracket.champion]?.info.name}</span>}
			</div>
			<div className="round-block">
				<div className="round-bar current" style={{ cursor: "default" }}>
					<span className="rname">Round {bracket.round}</span>
					{liveCount > 0 && <span className="badge-live">{liveCount} live</span>}
					<span className="rmeta">{doneCount}/{matches.length} resolved</span>
					<span className="rrule" />
				</div>
				<div className="match-grid">
					{matches.map((m, i) => (
						<MatchCard key={m.matchId} m={m} idxLabel={i + 1} players={snapshot.players} bracket={bracket}
							phase={snapshot.phase} battle={m.battleId ? battles[m.battleId] : undefined}
							openedAt={m.battleId ? openedAt[m.battleId] : undefined} now={now} act={act} confirm={confirm} />
					))}
				</div>
			</div>
		</div>
	);
}

// ─── Player directory ────────────────────────────────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
	return (
		<div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
			<div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: accent ?? "var(--ink)" }}>{value}</div>
			<div style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)", fontWeight: 700, marginTop: 2 }}>{label}</div>
		</div>
	);
}

function BattleLogList({ log }: { log: BattleLogEntry[] }) {
	if (!log.length) return <div className="muted" style={{ fontSize: "var(--fs-xs)" }}>No battles logged yet.</div>;
	const rows = [...log].reverse();
	return (
		<div className="scroll-y" style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220 }}>
			{rows.map((e, i) => {
				const meta = OUTCOME_META[e.outcome];
				const dur = e.startTime != null && e.endTime != null ? Math.max(0, e.endTime - e.startTime) : null;
				return (
					<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6 }}>
						<span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color, flex: "none" }} />
						<span style={{ fontWeight: 600, fontSize: "var(--fs-xs)", color: meta.color, minWidth: 44 }}>{meta.label}</span>
						<span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--fs-xs)" }}>
							{e.pokemon?.name ?? "—"}{e.pokemon?.level ? ` · L${e.pokemon.level}` : ""}
						</span>
						{dur != null && <span className="muted" style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--mono)" }}>{fmtClock(dur)}</span>}
					</div>
				);
			})}
		</div>
	);
}

function PlayerDetail({ p, snapshot, bracket, now, act, onClose }: {
	p: PlayerState; snapshot: Snapshot; bracket: Bracket | null; now: number;
	act: (type: string, extra?: Record<string, unknown>) => void; onClose: () => void;
}) {
	const [ribbon, setRibbon] = useState(RIBBONS[0].path);
	const [showLog, setShowLog] = useState(false);
	const held = p.ribbons.map((path) => RIBBON_BY_PATH[path]).filter(Boolean);
	const inTournament = snapshot.phase === "tournament" && !!bracket?.matches.length;
	const bstate = playerBracketState(bracket ?? undefined, snapshot.phase, p.sessionId);
	const canReadd = inTournament && bstate !== "active" && bstate !== "champion";
	const wins = winsOf(p);
	const wr = winRateOf(p);
	return (
		<div className="pdetail scroll-y">
			<div className="pd-head">
				<Avatar player={p} />
				<div>
					<div className="pd-name">{p.info.name}</div>
					<div className="pd-sub">{p.sessionId.slice(0, 12)} · Lv{levelOf(p)} · {wins}/{p.battleLog.length} wins</div>
				</div>
				<span className="pd-close"><Btn size="sm" variant="ghost" icon="x" onClick={onClose} /></span>
			</div>

			<div className="pd-field">
				<div className="l">Stats</div>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
					<StatTile label="Win rate" value={wr == null ? "—" : wr + "%"} accent={wr == null ? undefined : wr >= 50 ? "var(--blue)" : "#d23a43"} />
					<StatTile label="Wins" value={wins} />
					<StatTile label="Losses" value={countOutcome(p, "lose")} />
					<StatTile label="Caught" value={countOutcome(p, "caught")} />
					<StatTile label="Ran" value={countOutcome(p, "run")} />
					<StatTile label="Badges" value={p.badges.length} />
				</div>
			</div>

			<div className="pd-field">
				<div className="l" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<span>Battle Log</span>
					<Btn size="sm" variant="ghost" icon={showLog ? "chevron-d" : "chevron"} onClick={() => setShowLog((s) => !s)}>{showLog ? "Hide" : "Show"} ({p.battleLog.length})</Btn>
				</div>
				{showLog && <BattleLogList log={p.battleLog} />}
			</div>

			{held.length > 0 && (
				<div className="pd-field">
					<div className="l">Ribbons</div>
					<div className="ribbon-chips">
						{held.map((r) => <span key={r!.name} className="ribbon-chip"><Ribbon ribbon={r!} size={15} />{r!.label}</span>)}
					</div>
				</div>
			)}

			<div className="pd-field">
				<div className="l">Assign ribbon</div>
				<div className="pd-ribbon-row">
					<select className="select" value={ribbon} onChange={(e) => setRibbon(e.target.value)}>
						{RIBBONS.map((r) => <option key={r.name} value={r.path}>{r.label}</option>)}
					</select>
					<Btn size="sm" variant="gold" icon="plus" onClick={() => act("admin_assign_ribbon", { sessionId: p.sessionId, ribbonPath: ribbon })}>Give</Btn>
				</div>
			</div>

			{inTournament && (
				<div className="pd-field">
					<div className="l">Recovery</div>
					<Btn size="sm" className="block" icon="plus" disabled={!canReadd}
						title={canReadd ? "Add a bye match for this player into the current bracket" : "Player is still active in the bracket"}
						onClick={() => act("admin_readd_player", { sessionId: p.sessionId })}>
						Re-add to bracket{bstate === "eliminated" ? " (eliminated)" : ""}
					</Btn>
				</div>
			)}
		</div>
	);
}

function PlayerDirectory({ snapshot, bracket, now, selected, setSelected, act }: {
	snapshot: Snapshot | null; bracket: Bracket | null; now: number;
	selected: string | null; setSelected: (id: string | null) => void;
	act: (type: string, extra?: Record<string, unknown>) => void;
}) {
	const [q, setQ] = useState("");
	const [showNames, setShowNames] = useState(false);
	const [sortKey, setSortKey] = useState<SortKey>("default");
	const players = snapshot?.players ?? {};
	const order = Object.keys(players);
	const filtered = order.map((id) => players[id]).filter((p) => p.info.name.toLowerCase().includes(q.toLowerCase()));
	const sorted = sortKey === "default" ? filtered : [...filtered].sort((a, b) => SORT_STATS[sortKey].value(b) - SORT_STATS[sortKey].value(a));
	const sel = selected ? players[selected] : null;
	const taken = new Set(order.map((id) => players[id].info.name.trim().toLowerCase()));

	return (
		<aside className="rail">
			<div className="rail-head">
				<div className="title"><Icon name="people" size={14} /> Players <span className="count">{order.length}</span>
					<Btn size="sm" variant="ghost" icon="people" style={{ marginLeft: "auto" }} onClick={() => setShowNames((s) => !s)}>Premade names</Btn>
				</div>
				<div className="search"><span className="ic"><Icon name="search" size={14} /></span>
					<input placeholder="Filter players…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
				<div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
					<span className="muted" style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 700, flex: "none" }}>Sort</span>
					<select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
						{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
					</select>
				</div>
			</div>
			{showNames && (
				<div className="pd-field" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", margin: 0 }}>
					<div className="l">Premade Usernames <span className="count">{PREMADE_NAMES.length}</span></div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
						{PREMADE_NAMES.map((nm) => {
							const used = taken.has(nm);
							return (
								<div key={nm} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 6, opacity: used ? 0.5 : 1 }}>
									<img src={getTrainerSpritePath(nm)} alt="" style={{ width: 18, height: 18, imageRendering: "pixelated", flex: "none" }} />
									<span style={{ textTransform: "capitalize", fontSize: "var(--fs-xs)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</span>
									{used && <span className="muted" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".5px" }}>taken</span>}
								</div>
							);
						})}
					</div>
				</div>
			)}
			<div className="plist scroll-y">
				{sorted.map((p) => {
					const a = playerActivity(p, now);
					const bstate = playerBracketState(bracket ?? undefined, snapshot!.phase, p.sessionId);
					return (
						<div key={p.sessionId} className={"prow" + (selected === p.sessionId ? " sel" : "")}
							onClick={() => setSelected(selected === p.sessionId ? null : p.sessionId)}>
							<Avatar player={p} className="sm" />
							<div className="pinfo">
								<div className="nm">{p.info.name}
									{p.tournamentOptIn ? <span className="optin" title="Opted in"><Icon name="check" size={12} style={{ display: "inline" }} /></span> : <span className="optout" title="Not opted in"><Icon name="x" size={12} style={{ display: "inline" }} /></span>}
									{bstate === "champion" && <span className="tag-champ">♛ champ</span>}
									{bstate === "eliminated" && <span className="tag-elim">out</span>}
								</div>
								<div className="mt">
									<span className="lvl">Lv{levelOf(p)}</span><span>·</span><span>{p.badges.length} badges</span>
									{p.ribbons.length > 0 && <><span>·</span><span className="flex gap6" style={{ gap: 3 }}><Ribbon ribbon={RIBBON_BY_PATH[p.ribbons[0]]} size={12} />{p.ribbons.length}</span></>}
								</div>
							</div>
							{sortKey !== "default" && (
								<span style={{ flex: "none", fontSize: "var(--fs-xs)", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--ink-2)", background: "var(--panel-3)", borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>
									{SORT_STATS[sortKey].display(p)}
								</span>
							)}
							<span className="pstate"><span className={"dot " + a.cls} />{a.t}</span>
						</div>
					);
				})}
				{sorted.length === 0 && <div className="empty-state"><div className="big">No players</div>{q ? `No name matches "${q}".` : "Enter the admin secret to load players."}</div>}
			</div>
			{sel && <PlayerDetail p={sel} snapshot={snapshot!} bracket={bracket} now={now} act={act} onClose={() => setSelected(null)} />}
		</aside>
	);
}

// ─── Collection workspace ────────────────────────────────────────────────────

function CollectionWorkspace({ snapshot, pending, setPending, act }: {
	snapshot: Snapshot; pending: number; setPending: (n: number) => void; act: (type: string, extra?: Record<string, unknown>) => void;
}) {
	const order = Object.keys(snapshot.players);
	const optedIn = order.filter((id) => snapshot.players[id].tournamentOptIn);
	const withParty = order.filter((id) => snapshot.players[id].party.length > 0);
	const eligible = order.filter((id) => snapshot.players[id].tournamentOptIn && snapshot.players[id].party.length > 0);
	const gym = gymById(pending);
	const dirty = pending !== snapshot.currentGymId;
	const pct = order.length ? Math.round((optedIn.length / order.length) * 100) : 0;

	return (
		<div className="collection-wrap">
			<div className="sec-head"><h2>Crawl Pacing</h2><span className="rule" /></div>
			<div className="big-card">
				<div className="gym-hero">
					<div className="gym-badge"><img className="sprite" src={gym.badgeSprite} alt={gym.name} /></div>
					<div className="ginfo" style={{ flex: 1 }}>
						<div className="gk">Current Gym</div>
						<div className="gv">{String(gym.id).padStart(2, "0")} · {gym.name}</div>
						<div className="gd">Pace the crowd from pub to pub. Set the gym to move everyone's crawl forward.</div>
					</div>
					{dirty && <Btn variant="primary" icon="check" onClick={() => act("admin_set_gym", { gymId: pending })}>Set Gym {String(pending).padStart(2, "0")}</Btn>}
				</div>
				<div className="gym-steps">
					{GYMS.map((g) => {
						const cls = g.id === pending ? "cur" : g.id < snapshot.currentGymId ? "done" : "";
						return <button key={g.id} className={"gym-step " + cls} onClick={() => setPending(g.id)}>{g.id}</button>;
					})}
				</div>
			</div>

			<div className="big-card">
				<div className="optin-stat">
					<div className="stat-big"><div className="n">{optedIn.length}<span className="of">/{order.length}</span></div><div className="k">Opted In</div></div>
					<div className="stat-big"><div className="n">{eligible.length}</div><div className="k">Tournament-Ready</div></div>
					<div className="readybar">
						<div className="track"><div className="fill" style={{ width: pct + "%" }} /></div>
						<div className="cap">{eligible.length} of {order.length} satisfy opt-in <b>and</b> a non-empty party · {withParty.length} have a party</div>
					</div>
				</div>
			</div>

			<div className="big-card">
				<div className="sec-head" style={{ marginBottom: 10 }}><h2>Roster</h2><span className="rule" /></div>
				<div className="eligible-grid">
					{order.map((id) => {
						const p = snapshot.players[id];
						const ok = p.tournamentOptIn && p.party.length > 0;
						const why = !p.tournamentOptIn ? "not opted in" : p.party.length === 0 ? "no party" : "ready";
						return (
							<div key={id} className={"elig-card" + (ok ? "" : " no")}>
								<Avatar player={p} className="sm" />
								<div style={{ minWidth: 0 }}>
									<div className="nm">{p.info.name}</div>
									<div className="why">{ok ? <span className="ok">✓ {why}</span> : why}</div>
								</div>
							</div>
						);
					})}
					{order.length === 0 && <div className="empty-state"><div className="big">No players</div>Enter the admin secret to load the roster.</div>}
				</div>
			</div>
		</div>
	);
}

// ─── Hall of Fame workspace ──────────────────────────────────────────────────

function HallOfFameWorkspace({ snapshot, bracket }: { snapshot: Snapshot; bracket: Bracket | null }) {
	const champId = bracket?.champion;
	const champ = champId ? snapshot.players[champId] : null;
	const hof = snapshot.hallOfFame ?? {};
	const ids = Object.keys(hof).sort((a, b) => {
		if (a === champId) return -1; if (b === champId) return 1;
		return hof[b].length - hof[a].length;
	});
	return (
		<div className="hof-wrap">
			<div className="sec-head"><h2>Final Standings</h2><span className="rule" /></div>
			{champ ? (
				<div className="champ-banner">
					<div className="rays" />
					<div className="champ-av"><Avatar player={champ} /></div>
					<div style={{ position: "relative" }}>
						<div className="ck">♛ League Champion</div>
						<div className="cn">{champ.info.name}</div>
						<div className="cs cs2">Lv{levelOf(champ)} · {winsOf(champ)} career wins · {champ.badges.length} badges · earned the Champion ribbon</div>
					</div>
				</div>
			) : (
				<div className="champ-banner">
					<div className="rays" />
					<div style={{ position: "relative" }}>
						<div className="ck">Event closed</div>
						<div className="cn" style={{ fontSize: 26 }}>No champion crowned</div>
						<div className="cs cs2">The tournament ended without a final winner. Ribbons below reflect what was awarded.</div>
					</div>
				</div>
			)}
			<div className="hof-grid">
				{ids.map((id, i) => {
					const p = snapshot.players[id];
					const ribs = hof[id].map((path) => RIBBON_BY_PATH[path]).filter(Boolean);
					return (
						<div key={id} className="hof-card">
							<div className="hh"><Avatar player={p} className="sm" /><div className="nm">{p?.info.name}</div><span className="placing">{id === champId ? "1st" : "#" + (i + 1)}</span></div>
							<div className="hof-ribbons">
								{ribs.length ? ribs.map((r) => <span key={r!.name} className="ribbon-chip"><Ribbon ribbon={r!} size={14} />{r!.label}</span>) : <span className="hof-empty">No ribbons</span>}
							</div>
						</div>
					);
				})}
				{ids.length === 0 && <div className="empty-state"><div className="big">No ribbons awarded</div>Assign ribbons from the player directory.</div>}
			</div>
		</div>
	);
}

// ─── Raw state footer ────────────────────────────────────────────────────────

function highlightJSON(obj: unknown): string {
	let json = JSON.stringify(obj, null, 2) ?? "";
	json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
		let cls = "n";
		if (/^"/.test(match)) cls = /:$/.test(match) ? "k" : "s";
		else if (/true|false|null/.test(match)) cls = "b";
		return '<span class="' + cls + '">' + match + "</span>";
	});
	return json;
}

// ─── Global battle feed ──────────────────────────────────────────────────────

interface FeedRow {
	player: PlayerState;
	entry: BattleLogEntry;
}
function buildBattleFeed(snapshot: Snapshot | null): FeedRow[] {
	if (!snapshot) return [];
	const rows: FeedRow[] = [];
	for (const id of Object.keys(snapshot.players)) {
		const p = snapshot.players[id];
		for (const entry of p.battleLog) rows.push({ player: p, entry });
	}
	// Newest first. Entries without a timestamp sink to the bottom.
	rows.sort((a, b) => (b.entry.startTime ?? 0) - (a.entry.startTime ?? 0));
	return rows;
}
function fmtTimeOfDay(ms?: number): string {
	if (ms == null) return "—";
	return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function BattleFeed({ snapshot }: { snapshot: Snapshot | null }) {
	const [open, setOpen] = useState(false);
	const rows = useMemo(() => buildBattleFeed(snapshot), [snapshot]);
	return (
		<footer className="footer">
			<div className={"footer-bar" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
				<span className="twist"><Icon name="chevron" size={11} /></span>
				<span className="ft">Battle feed</span>
				<span className="fmeta">all players · {rows.length} battles · newest first</span>
				<span className="spring" />
				<span className="muted" style={{ fontSize: "var(--fs-xs)" }}>{open ? "Hide" : "Show"}</span>
			</div>
			{open && (
				<div className="raw-body scroll-y" style={{ background: "var(--panel-2)", maxHeight: 320 }}>
					{rows.length === 0 ? (
						<div className="muted" style={{ fontSize: "var(--fs-xs)" }}>No battles logged yet.</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
							{rows.map(({ player, entry }, i) => {
								const meta = OUTCOME_META[entry.outcome];
								const dur = entry.startTime != null && entry.endTime != null ? Math.max(0, entry.endTime - entry.startTime) : null;
								return (
									<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6 }}>
										<span className="muted" style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--mono)", minWidth: 64, flex: "none" }}>{fmtTimeOfDay(entry.startTime)}</span>
										<Avatar player={player} className="sm" />
										<span style={{ fontWeight: 600, fontSize: "var(--fs-xs)", minWidth: 90, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.info.name}</span>
										<span style={{ width: 8, height: 8, borderRadius: 99, background: meta.color, flex: "none" }} />
										<span style={{ fontWeight: 600, fontSize: "var(--fs-xs)", color: meta.color, minWidth: 44, flex: "none" }}>{meta.label}</span>
										<span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "var(--fs-xs)" }}>
											{entry.pokemon?.name ?? "—"}{entry.pokemon?.level ? ` · L${entry.pokemon.level}` : ""}
										</span>
										{dur != null && <span className="muted" style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--mono)", flex: "none" }}>{fmtClock(dur)}</span>}
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</footer>
	);
}

function RawState({ snapshot, onRefresh }: { snapshot: Snapshot | null; onRefresh: () => void }) {
	const [open, setOpen] = useState(false);
	const html = useMemo(() => (snapshot ? highlightJSON(snapshot) : ""), [snapshot]);
	const playerCount = snapshot ? Object.keys(snapshot.players).length : 0;
	const matchCount = snapshot?.tournamentBracket?.matches.length ?? 0;
	const copy = (e: React.MouseEvent) => { e.stopPropagation(); try { navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)); } catch {} };
	return (
		<footer className="footer">
			<div className={"footer-bar" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
				<span className="twist"><Icon name="chevron" size={11} /></span>
				<span className="ft">Raw game state</span>
				<span className="fmeta">debug · {playerCount} players · {matchCount} matches</span>
				<span className="spring" />
				<Btn size="sm" variant="ghost" icon="refresh" onClick={(e) => { e.stopPropagation(); onRefresh(); setOpen(true); }}>Refresh</Btn>
				<Btn size="sm" variant="ghost" icon="copy" onClick={copy}>Copy JSON</Btn>
			</div>
			{open && <div className="raw-body scroll-y"><pre dangerouslySetInnerHTML={{ __html: html }} /></div>}
		</footer>
	);
}

// ─── Primary actions (per phase) ─────────────────────────────────────────────

function PrimaryActions({ snapshot, bracket, act, confirm }: {
	snapshot: Snapshot; bracket: Bracket | null;
	act: (type: string, extra?: Record<string, unknown>) => void; confirm: (c: ConfirmCfg) => void;
}) {
	if (snapshot.phase === "collection") {
		const elig = Object.values(snapshot.players).filter((p) => p.tournamentOptIn && p.party.length > 0).length;
		const ok = elig >= 2;
		return (
			<Btn variant="primary" size="lg" icon="swords" disabled={!ok}
				title={ok ? "Seed the bracket from eligible players" : "Need ≥2 players who have opted in AND have a party"}
				onClick={() => act("admin_start_tournament")}>Start Tournament</Btn>
		);
	}
	if (snapshot.phase === "tournament") {
		return (
			<div className="cb-group">
				<Btn variant="danger" icon="refresh" onClick={() => confirm({
					accent: "danger", iconName: "refresh", title: "Reset tournament?",
					body: <>This clears the entire bracket and ends every live battle, returning the event to <b>Collection</b>.</>,
					note: { kind: "green", text: "Opt-ins are preserved — you can Start again immediately." },
					confirmLabel: "Reset Tournament", confirmVariant: "danger-solid",
					onConfirm: () => act("admin_reset_tournament"),
				})}>Reset Tournament</Btn>
				<Btn variant="gold" icon="trophy" onClick={() => confirm({
					accent: "gold", iconName: "trophy", title: "End tournament → Hall of Fame?",
					body: bracket?.champion
						? <>Lock the bracket, compute auto-ribbons, and move to <b>Hall of Fame</b>.</>
						: <>No champion has been crowned yet. Ending now moves to <b>Hall of Fame</b> with current standings.</>,
					note: bracket?.champion ? { kind: "green", text: `Champion: ${bracket.championName}` } : null,
					confirmLabel: "End → Hall of Fame", confirmVariant: "gold",
					onConfirm: () => act("admin_trigger_hall_of_fame"),
				})}>End → Hall of Fame</Btn>
			</div>
		);
	}
	return (
		<Btn variant="primary" icon="refresh" onClick={() => confirm({
			accent: "blue", iconName: "refresh", title: "Reset to Collection?",
			body: <>Start a fresh event. The bracket and Hall of Fame are cleared and the crawl returns to <b>Collection</b>.</>,
			note: { kind: "green", text: "Player ribbons earned this event are kept on their cards." },
			confirmLabel: "Reset to Collection", confirmVariant: "primary",
			onConfirm: () => act("admin_reset_tournament"),
		})}>Reset to Collection</Btn>
	);
}

function Tally({ snapshot, bracket }: { snapshot: Snapshot; bracket: Bracket | null }) {
	const order = Object.keys(snapshot.players);
	if (snapshot.phase === "tournament" && bracket) {
		const inBracket = new Set<string>();
		bracket.matches.forEach((m) => { if (m.player1SessionId) inBracket.add(m.player1SessionId); if (m.player2SessionId) inBracket.add(m.player2SessionId); });
		return (
			<div className="tally">
				<span><span className="num">{order.length}</span> <span className="lab">players</span></span>
				<span className="div" />
				<span><span className="num">{inBracket.size}</span> <span className="lab">in tournament</span></span>
			</div>
		);
	}
	const optedIn = order.filter((id) => snapshot.players[id].tournamentOptIn).length;
	const elig = order.filter((id) => snapshot.players[id].tournamentOptIn && snapshot.players[id].party.length > 0).length;
	return (
		<div className="tally">
			<span><span className="num">{optedIn}</span> <span className="lab">of {order.length} opted in</span></span>
			<span className="div" />
			<span><span className="num">{elig}</span> <span className="lab">eligible</span></span>
		</div>
	);
}

// ─── Root ────────────────────────────────────────────────────────────────────

const EMPTY_SNAPSHOT: Snapshot = { phase: "collection", currentGymId: 1, players: {} };

export default function AdminPage() {
	const { secret, updateSecret, connected, authError, snapshot, bracket, send, requestState } = useAdminConsole();
	const { states: battles, openedAt } = useBattleTimers(bracket);
	useTick();

	const snap = snapshot ?? EMPTY_SNAPSHOT;
	const [pendingGym, setPendingGym] = useState<number | null>(null);
	const gymBase = snap.currentGymId;
	const pending = pendingGym ?? gymBase;

	const [selected, setSelected] = useState<string | null>(null);
	const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg | null>(null);
	const confirm = useCallback((c: ConfirmCfg) => setConfirmCfg(c), []);

	const act = useCallback((type: string, extra: Record<string, unknown> = {}) => {
		send({ type, ...extra });
		if (type === "admin_set_gym") setPendingGym(null);
	}, [send]);

	const now = Date.now();

	return (
		<div className="app" style={{ minHeight: "100vh", background: "var(--page)", color: "var(--ink)", fontFamily: "var(--font)" }}>
			<header className="commandbar">
				<div className="cb-top">
					<div className="cb-brand">
						<div className="cb-logo"><img src="/icon.svg" alt="" /></div>
						<div className="cb-wordmark">PUBMON<span className="sub">ADMIN CONSOLE</span></div>
					</div>
					<div className="cb-conn"><span className={"dot " + (connected ? "live" : "off")} />{connected ? "Connected" : "Reconnecting…"}</div>
					<SecretField secret={secret} authError={authError} onChange={updateSecret} />
					<PhaseChip phase={snap.phase} bracket={bracket} />
				</div>
				<div className="cb-controls">
					<GymSelector currentGymId={gymBase} pending={pending} setPending={setPendingGym} onSet={() => act("admin_set_gym", { gymId: pending })} />
					<span className="cb-sep" />
					<Tally snapshot={snap} bracket={bracket} />
					<span className="cb-spring" />
					<PrimaryActions snapshot={snap} bracket={bracket} act={act} confirm={confirm} />
				</div>
			</header>

			<div className="workspace">
				<main className="main scroll-y">
					{snap.phase === "tournament" && (
						bracket?.matches.length
							? <LiveBracket snapshot={snap} bracket={bracket} battles={battles} openedAt={openedAt} now={now} act={act} confirm={confirm} />
							: <div className="empty-state"><div className="big">No bracket</div>Start a tournament from Collection.</div>
					)}
					{snap.phase === "collection" && <CollectionWorkspace snapshot={snap} pending={pending} setPending={setPendingGym} act={act} />}
					{snap.phase === "hall-of-fame" && <HallOfFameWorkspace snapshot={snap} bracket={bracket} />}
				</main>
				<PlayerDirectory snapshot={snapshot} bracket={bracket} now={now} selected={selected} setSelected={setSelected} act={act} />
			</div>

			<BattleFeed snapshot={snapshot} />

			<RawState snapshot={snapshot} onRefresh={requestState} />

			{confirmCfg && <ConfirmModal cfg={confirmCfg} onClose={() => setConfirmCfg(null)} />}
		</div>
	);
}
