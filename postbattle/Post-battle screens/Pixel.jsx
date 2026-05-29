// Pixel.jsx — primitive components for PubMon UI kit
// Load AFTER React + Babel.

const PixelBox = ({ children, variant = "default", className = "", style = {}, as: As = "div", ...rest }) => {
  const v = {
    default: { background: "#f8f8f8", borderColor: "#282828", color: "#282828",
      boxShadow: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8" },
    blue:    { background: "#4878d0", borderColor: "#305098", color: "#f8f8f8",
      boxShadow: "inset 2px 2px 0 rgba(72,120,208,0.6), inset -2px -2px 0 rgba(48,80,152,0.8)" },
    red:     { background: "#d03838", borderColor: "#a82828", color: "#f8f8f8",
      boxShadow: "inset 2px 2px 0 rgba(208,56,56,0.6), inset -2px -2px 0 rgba(168,40,40,0.8)" },
    flat:    { background: "#f8f8f8", borderColor: "#282828", color: "#282828",
      boxShadow: "none" },
  }[variant];
  return (
    <As
      className={`pixel-box ${className}`}
      style={{ borderStyle: "solid", borderWidth: 3, padding: 8, borderRadius: 0, ...v, ...style }}
      {...rest}
    >{children}</As>
  );
};

const PixelButton = ({ children, variant = "default", onClick, disabled, style = {}, className = "" }) => {
  const palettes = {
    default: { background: "#d8e0e8", color: "#282828", borderColor: "#282828" },
    primary: { background: "#4878d0", color: "#f8f8f8", borderColor: "#305098" },
    danger:  { background: "#d03838", color: "#f8f8f8", borderColor: "#a82828" },
    yellow:  { background: "#f8d030", color: "#282828", borderColor: "#a88820" },
  };
  const p = palettes[variant];
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      className={className}
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 10,
        padding: "10px 14px",
        border: `3px solid ${p.borderColor}`,
        background: p.background,
        color: p.color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        borderRadius: 0,
        transform: !disabled && hover && !press ? "translateY(-1px)" : "translateY(0)",
        boxShadow: !disabled && hover && !press ? "1px 1px 0 0 rgba(0,0,0,0.5), 2px 2px 0 0 rgba(0,0,0,0.2)" : "2px 2px 0 0 rgba(0,0,0,0.2)",
        transition: "transform 60ms steps(1), box-shadow 60ms steps(1), filter 60ms steps(1)",
        filter: hover && !disabled ? "brightness(1.05)" : "none",
        ...style,
      }}
    >{children}</button>
  );
};

const PixelMenu = ({ items, selected, onSelect, variant = "default" }) => (
  <PixelBox variant={variant} style={{ padding: "8px 4px" }}>
    {items.map((it, i) => {
      const sel = i === selected;
      return (
        <div
          key={i}
          onClick={() => onSelect && onSelect(i)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 10,
            color: variant === "default" ? "#282828" : "#f8f8f8",
            padding: "6px 8px 6px 22px",
            position: "relative",
            cursor: "pointer",
            lineHeight: 1.4,
          }}
        >
          {sel && <span style={{ position: "absolute", left: 6, animation: "cursor-blink 0.8s step-end infinite" }}>▶</span>}
          {it}
        </div>
      );
    })}
  </PixelBox>
);

const PixelDialog = ({ children, showContinue = true }) => (
  <div style={{
    background: "#f8f8f8",
    border: "3px solid #282828",
    boxShadow: "inset 2px 2px 0 #d8e0e8, inset -2px -2px 0 #a8b0b8",
    padding: "14px 16px",
    position: "relative",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 11,
    color: "#282828",
    lineHeight: 1.7,
    minHeight: 60,
  }}>
    {children}
    {showContinue && (
      <span style={{ position: "absolute", right: 10, bottom: 6, fontSize: 11, animation: "cursor-blink 0.8s step-end infinite" }}>▼</span>
    )}
  </div>
);

const HPBar = ({ current, max, label = "HP", showNumbers = true }) => {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 50 ? "#50c848" : pct > 20 ? "#f8b020" : "#f04038";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {label && <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: "#282828" }}>{label}</span>}
        <div style={{ flex: 1, height: 8, background: "#d8e0e8", border: "2px solid #282828" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.4s linear" }} />
        </div>
      </div>
      {showNumbers && (
        <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: "#282828", textAlign: "right" }}>{current}/{max}</span>
      )}
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const map = {
    beer:     { label: "BEER",  bg: "#c28b4a", fg: "#fff" },
    shot:     { label: "SHOT",  bg: "#e43b44", fg: "#fff" },
    wine:     { label: "WINE",  bg: "#f4a4c0", fg: "#282828" },
    water:    { label: "WATER", bg: "#63c6e1", fg: "#282828" },
    cocktail: { label: "CKTL",  bg: "#63c74d", fg: "#282828" },
  };
  const i = map[type];
  return (
    <span style={{
      fontFamily: "'Press Start 2P',monospace", fontSize: 8,
      padding: "3px 6px", border: "2px solid #000", background: i.bg, color: i.fg,
      lineHeight: 1, display: "inline-block",
    }}>{i.label}</span>
  );
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    brn: { bg: "#e43b44", fg: "#fff", label: "BRN" },
    psn: { bg: "#a86dd9", fg: "#fff", label: "PSN" },
    par: { bg: "#ffd500", fg: "#1a1c2c", label: "PAR" },
    slp: { bg: "#6e7a8a", fg: "#fff", label: "SLP" },
    frz: { bg: "#00c2ff", fg: "#1a1c2c", label: "FRZ" },
  };
  const i = map[status.toLowerCase()];
  if (!i) return null;
  return (
    <span style={{
      fontFamily: "'Press Start 2P',monospace", fontSize: 8,
      padding: "3px 6px", border: "2px solid #000", background: i.bg, color: i.fg, lineHeight: 1,
    }}>{i.label}</span>
  );
};

Object.assign(window, { PixelBox, PixelButton, PixelMenu, PixelDialog, HPBar, TypeBadge, StatusBadge });
