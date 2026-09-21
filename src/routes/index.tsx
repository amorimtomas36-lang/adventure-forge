import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Biome = {
  name: string;
  tile: string;
  accent: string;
  dark: string;
  enemy: string;
  boss: string;
  bossHp: number;
  level: number;
  reward: number;
};

const BIOMES: Biome[] = [
  { name: "Vale Verde", tile: "#315f3a", accent: "#78b957", dark: "#1b3927", enemy: "Slime", boss: "Rei Slime", bossHp: 180, level: 1, reward: 180 },
  { name: "Deserto Rubro", tile: "#9a5b37", accent: "#d89b4b", dark: "#613927", enemy: "Escorpião", boss: "Colosso Rubro", bossHp: 300, level: 4, reward: 320 },
  { name: "Picos Gelados", tile: "#47788a", accent: "#b9e4ee", dark: "#294a59", enemy: "Lobo de Gelo", boss: "Yeti Ancestral", bossHp: 450, level: 8, reward: 520 },
  { name: "Cratera Sombria", tile: "#4b304c", accent: "#c96570", dark: "#2b1c31", enemy: "Demónio", boss: "Senhor da Cratera", bossHp: 720, level: 13, reward: 900 },
];

const W = 30;
const H = 17;
const TILE = 32;

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const player = useRef({ x: 15, y: 9 });
  const [biome, setBiome] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [gold, setGold] = useState(100);
  const [hp, setHp] = useState(100);
  const [damage, setDamage] = useState(18);
  const [kills, setKills] = useState(0);
  const [quest, setQuest] = useState(0);
  const [bossHp, setBossHp] = useState(BIOMES[0].bossHp);
  const [message, setMessage] = useState("Explora o reino e fala com os NPCs.");
  const [fullscreen, setFullscreen] = useState(false);
  const gameShellRef = useRef<HTMLElement>(null);
  const current = BIOMES[biome];
  const xpNeed = 100 + (level - 1) * 60;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    player.current = { x: 15, y: 9 };
    setBossHp(current.bossHp);
    setQuest(0);
    setMessage("Novo território descoberto. Explora com WASD ou as setas.");
  }, [biome, current.bossHp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * TILE;
    canvas.height = H * TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const drawTree = (x: number, y: number) => {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "#30231c"; ctx.fillRect(px + 13, py + 18, 7, 11);
      ctx.fillStyle = current.dark; ctx.fillRect(px + 7, py + 10, 19, 15);
      ctx.fillStyle = current.accent; ctx.fillRect(px + 11, py + 5, 13, 13);
      ctx.fillStyle = "#b7dc72"; ctx.fillRect(px + 14, py + 3, 7, 7);
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(px + 6, py + 25, 22, 3);
    };

    const drawRock = (x: number, y: number) => {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "#2b2630"; ctx.fillRect(px + 6, py + 15, 21, 11);
      ctx.fillStyle = current.accent; ctx.fillRect(px + 9, py + 9, 17, 13);
      ctx.fillStyle = "#d7d0c4"; ctx.fillRect(px + 12, py + 10, 7, 4);
    };

    const drawNpc = (x: number, y: number, shirt: string, name: string, icon: string) => {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "#121019"; ctx.fillRect(px + 8, py + 9, 16, 20);
      ctx.fillStyle = "#e8b38d"; ctx.fillRect(px + 10, py + 5, 12, 12);
      ctx.fillStyle = "#33251e"; ctx.fillRect(px + 9, py + 3, 14, 7);
      ctx.fillStyle = shirt; ctx.fillRect(px + 8, py + 16, 16, 10);
      ctx.fillStyle = "#17131b"; ctx.fillRect(px + 11, py + 10, 3, 3); ctx.fillRect(px + 18, py + 10, 3, 3);
      ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = "#fff"; ctx.fillText(icon + " " + name, px + 16, py - 3);
      ctx.textAlign = "left";
    };

    const drawEnemy = (x: number, y: number) => {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "#17131b";
      ctx.fillRect(px + 5, py + 14, 23, 12);
      ctx.fillStyle = biome === 0 ? "#6dd17b" : biome === 1 ? "#d07b39" : biome === 2 ? "#9fe0ef" : "#b84c6a";
      ctx.fillRect(px + 8, py + 9, 18, 15);
      ctx.fillStyle = "#fff"; ctx.fillRect(px + 11, py + 12, 4, 4); ctx.fillRect(px + 19, py + 12, 4, 4);
      ctx.fillStyle = "#221827"; ctx.fillRect(px + 12, py + 13, 2, 2); ctx.fillRect(px + 20, py + 13, 2, 2);
    };

    const drawBoss = (x: number, y: number) => {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(px + 3, py + 29, 42, 4);
      ctx.fillStyle = "#19131e"; ctx.fillRect(px + 9, py + 12, 30, 30);
      ctx.fillStyle = current.accent; ctx.fillRect(px + 6, py + 6, 36, 28);
      ctx.fillStyle = current.dark; ctx.fillRect(px + 12, py + 13, 24, 19);
      ctx.fillStyle = "#f2d6a0"; ctx.fillRect(px + 15, py + 16, 5, 5); ctx.fillRect(px + 28, py + 16, 5, 5);
      ctx.fillStyle = "#151018"; ctx.fillRect(px + 16, py + 17, 3, 3); ctx.fillRect(px + 29, py + 17, 3, 3);
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
      ctx.fillText(current.boss, px + 24, py - 4); ctx.textAlign = "left";
    };

    let raf = 0;
    let lastMove = 0;
    const draw = (time: number) => {
      const k = keys.current;
      if (time - lastMove > 105) {
        let dx = 0, dy = 0;
        if (k.has("arrowleft") || k.has("a")) dx = -1;
        if (k.has("arrowright") || k.has("d")) dx = 1;
        if (k.has("arrowup") || k.has("w")) dy = -1;
        if (k.has("arrowdown") || k.has("s")) dy = 1;
        if (dx || dy) {
          player.current.x = Math.max(1, Math.min(W - 2, player.current.x + dx));
          player.current.y = Math.max(1, Math.min(H - 2, player.current.y + dy));
          lastMove = time;
        }
      }

      ctx.fillStyle = current.tile; ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const n = (x * 17 + y * 31 + biome * 13) % 9;
        ctx.globalAlpha = n < 3 ? 0.14 : 0.055;
        ctx.fillStyle = current.accent;
        ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(0,0,0,.08)";
        ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }

      // A readable old-school adventure path.
      ctx.fillStyle = "rgba(36,24,22,.18)";
      ctx.fillRect(0, 7 * TILE, canvas.width, 3 * TILE);
      ctx.fillRect(12 * TILE, 0, 5 * TILE, canvas.height);

      [[2,2],[5,12],[24,3],[27,13],[8,3],[22,11]].forEach(([x,y]) => drawTree(x,y));
      [[10,2],[19,4],[3,14],[25,7],[14,13]].forEach(([x,y]) => drawRock(x,y));

      drawNpc(4, 6, "#42c98b", "ARIA", "!");
      drawNpc(25, 6, "#d9a441", "BROM", "★");
      drawNpc(4, 11, "#5c8de8", "LINA", "+");
      drawEnemy(10, 8);
      drawEnemy(20, 12);
      drawBoss(24, 1);

      const px = player.current.x * TILE, py = player.current.y * TILE;
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(px + 3, py + 27, 27, 4);
      ctx.fillStyle = "#17131b"; ctx.fillRect(px + 6, py + 7, 20, 23);
      ctx.fillStyle = "#3f6de0"; ctx.fillRect(px + 8, py + 16, 16, 11);
      ctx.fillStyle = "#e8b38d"; ctx.fillRect(px + 9, py + 7, 14, 12);
      ctx.fillStyle = "#6b3e28"; ctx.fillRect(px + 7, py + 4, 18, 7);
      ctx.fillStyle = "#fff"; ctx.fillRect(px + 13, py + 11, 3, 3); ctx.fillRect(px + 19, py + 11, 3, 3);
      ctx.fillStyle = "#d9d0b8"; ctx.fillRect(px + 24, py + 18, 8, 3);

      // Cinematic HUD strip.
      ctx.fillStyle = "rgba(12,10,16,.78)"; ctx.fillRect(0, 0, canvas.width, 34);
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace";
      ctx.fillText(current.name.toUpperCase(), 12, 21);
      ctx.fillStyle = current.accent; ctx.fillText("◆", 145, 21);
      ctx.fillStyle = "#bcb4c4"; ctx.fillText("WASD / SETAS  •  EXPLORA", 162, 21);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [biome, current]);

  const gainXp = (amount: number) => {
    let next = xp + amount;
    let lvl = level;
    while (next >= 100 + (lvl - 1) * 60) {
      next -= 100 + (lvl - 1) * 60;
      lvl++;
    }
    if (lvl > level) {
      setDamage(d => d + (lvl - level) * 7);
      setHp(100);
      setMessage("SUBISTE DE NÍVEL! A tua força aumentou.");
    }
    setXp(next); setLevel(lvl);
  };

  const hunt = () => {
    if (hp <= 0) return setMessage("Estás derrotado. Cura-te primeiro.");
    setKills(k => k + 1);
    setQuest(q => Math.min(5, q + 1));
    setGold(g => g + 12 + current.level * 2);
    setHp(h => Math.max(0, h - Math.max(2, current.level + Math.floor(Math.random() * 7))));
    gainXp(25 + current.level * 3);
    setMessage(current.enemy + " derrotado! +XP e ouro.");
  };

  const attackBoss = () => {
    if (hp <= 0) return setMessage("Estás derrotado. Cura-te primeiro.");
    if (bossHp <= 0) return setMessage("Este boss já foi derrotado.");
    const hit = damage + Math.floor(Math.random() * 9);
    const retaliation = Math.max(3, current.level + Math.floor(Math.random() * 10));
    const next = Math.max(0, bossHp - hit);
    setBossHp(next);
    setHp(h => Math.max(0, h - retaliation));
    if (next === 0) {
      setGold(g => g + current.reward);
      gainXp(90 + current.level * 15);
      setMessage("BOSS DERROTADO! +" + current.reward + " ouro.");
    } else setMessage("Acertaste " + hit + " de dano. Sofreste " + retaliation + ".");
  };

  const heal = () => {
    if (gold < 25) return setMessage("Precisas de 25 ouro.");
    setGold(g => g - 25); setHp(100); setMessage("Lina curou-te completamente.");
  };

  const buy = () => {
    if (gold < 150) return setMessage("A espada custa 150 ouro.");
    setGold(g => g - 150); setDamage(d => d + 15); setMessage("Espada equipada! +15 dano.");
  };

  const talkAria = () => {
    if (quest >= 5) {
      setGold(g => g + 100); gainXp(60); setQuest(0);
      setMessage("Aria: missão concluída! +100 ouro e +60 XP.");
    } else setMessage("Aria: derrota 5 monstros neste bioma e volta aqui.");
  };

  const locked = (i: number) => level < BIOMES[i].level;

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await gameShellRef.current?.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch {
      setMessage("O navegador bloqueou a tela cheia. Tenta novamente.");
    }
  };

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const press = (key: string) => {
    keys.current.add(key);
    window.setTimeout(() => keys.current.delete(key), 150);
  };

  return (
    <main ref={gameShellRef} className={`min-h-screen bg-[#0b0a0f] p-2 text-white md:p-4 ${fullscreen ? "overflow-auto" : ""}`} style={{ fontFamily: "monospace" }}>
      <div className={`mx-auto w-full ${fullscreen ? "max-w-none" : "max-w-[1600px]"}`}>
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#302b3b] bg-[#121018] px-3 py-3 shadow-[0_5px_0_#07060a]">
          <div>
            <h1 className="text-2xl font-black tracking-[0.08em] md:text-3xl">ADVENTURE FORGE</h1>
            <p className="mt-1 text-[10px] font-bold tracking-[0.18em] text-[#91899d]">THE OLD KINGDOM • 2D PIXEL RPG</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button onClick={toggleFullscreen} className="pixel-btn px-4">{fullscreen ? "↙ SAIR" : "⛶ TELA CHEIA"}</button>
            <span className="hud-pill">LV {level}</span>
            <span className="hud-pill">❤ {hp}/100</span>
            <span className="hud-pill">◆ {gold}</span>
          </div>
        </header>

        <div className={`grid gap-3 ${fullscreen ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "lg:grid-cols-[minmax(0,1fr)_340px]"}`}>
          <section className="relative min-w-0 border-4 border-[#40394d] bg-[#15121b] p-2 shadow-[8px_8px_0_#050407]">
            <div className="relative overflow-hidden border-4 border-[#292430] bg-black">
              <canvas ref={canvasRef} className="mx-auto block h-auto w-full" style={{ imageRendering: "pixelated", aspectRatio: `${W}/${H}` }} />
              <div className="pointer-events-none absolute bottom-2 left-2 border-2 border-[#51495d] bg-[#0c0a10]/90 px-2 py-1 text-[9px] font-bold text-[#d7d0dd]">
                {current.name} • LV RECOMENDADO {current.level}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 md:max-w-[520px]">
              <button onClick={() => press("arrowleft")} className="pixel-btn">◀</button>
              <button onClick={() => press("arrowup")} className="pixel-btn">▲</button>
              <button onClick={() => press("arrowright")} className="pixel-btn">▶</button>
              <button onClick={() => press("arrowdown")} className="pixel-btn">▼</button>
              <button onClick={hunt} className="pixel-btn">⚔ ATACAR</button>
              <button onClick={attackBoss} className="pixel-btn danger">☠ BOSS</button>
            </div>
          </section>

          <aside className="space-y-3">
            <Panel title="QUEST LOG">
              <p className="text-xs text-[#c5bfcc]">Aria pede 5 inimigos derrotados em {current.name}.</p>
              <div className="mt-3 h-4 border-2 border-[#51495d] bg-[#0c0a10]"><div className="h-full bg-[#65c97d]" style={{ width: `${quest * 20}%` }} /></div>
              <div className="mt-1 flex justify-between text-[10px]"><span>PROGRESSO</span><b>{quest}/5</b></div>
              <button onClick={talkAria} className="pixel-btn mt-3 w-full">FALAR COM ARIA</button>
            </Panel>

            <Panel title={`BOSS • ${current.boss.toUpperCase()}`}>
              <div className="mb-2 flex justify-between text-[10px]"><span>HP DO BOSS</span><b>{bossHp}/{current.bossHp}</b></div>
              <div className="h-5 border-2 border-[#51495d] bg-[#0c0a10]"><div className="h-full bg-[#c94f67]" style={{ width: `${Math.max(0, bossHp / current.bossHp * 100)}%` }} /></div>
              <button onClick={attackBoss} className="pixel-btn danger mt-3 w-full">ATACAR BOSS</button>
            </Panel>

            <Panel title="NPCs & LOJA">
              <div className="grid grid-cols-3 gap-1 text-center text-[9px]">
                <button onClick={talkAria} className="npc">!<br/><b>ARIA</b><br/>MISSÃO</button>
                <button onClick={buy} className="npc">★<br/><b>BROM</b><br/>ESPADA 150G</button>
                <button onClick={heal} className="npc">+<br/><b>LINA</b><br/>CURA 25G</button>
              </div>
            </Panel>

            <Panel title="EQUIPAMENTO">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <Stat label="NÍVEL" value={String(level)} />
                <Stat label="DANO" value={String(damage)} />
                <Stat label="XP" value={xp + "/" + xpNeed} />
                <Stat label="ABATES" value={String(kills)} />
              </div>
              <div className="mt-2 border-2 border-[#40394d] bg-[#0c0a10] p-2 text-[10px] leading-relaxed text-[#bcb4c4]">{message}</div>
            </Panel>
          </aside>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_.8fr]">
          <Panel title="WORLD MAP">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {BIOMES.map((b, i) => (
                <button key={b.name} disabled={locked(i)} onClick={() => setBiome(i)} className={`border-2 p-3 text-left text-[10px] transition ${i === biome ? "border-[#d9b35d] bg-[#302938]" : "border-[#40394d] bg-[#17141d]"} ${locked(i) ? "opacity-40" : "hover:bg-[#27222f]"}`}>
                  <b className="text-xs">{i === biome ? "◆ " : ""}{b.name}</b>
                  <br/><span className="text-[#9e96a8]">{locked(i) ? "LOCK • LV " + b.level : "BOSS • " + b.boss}</span>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="JOURNAL">
            <p className="text-[10px] leading-relaxed text-[#aaa2b1]">Explora cada região, completa as missões, compra equipamento e derrota o boss para desbloquear o próximo território.</p>
            <div className="mt-2 flex items-center justify-between border-2 border-[#40394d] bg-[#0c0a10] p-2 text-[10px]"><span>PRÓXIMO LV</span><b>{Math.max(0, xpNeed - xp)} XP</b></div>
          </Panel>
        </div>
      </div>

      <style>{`
        .pixel-btn{border:3px solid #51495d;background:#292331;padding:10px;font-weight:900;font-size:11px;box-shadow:4px 4px 0 #07060a;transition:background .08s,transform .08s}
        .pixel-btn:hover{background:#3b3446}
        .pixel-btn:active{transform:translate(2px,2px);box-shadow:2px 2px 0 #07060a}
        .danger{background:#713445}
        .danger:hover{background:#8a3e53}
        .hud-pill{border:2px solid #40394d;background:#1b1722;padding:9px 11px}
        .npc{border:2px solid #40394d;background:#17141d;padding:8px;line-height:1.45}
        .npc:hover{background:#292431}
        :fullscreen{background:#0b0a0f;overflow:auto}
        :fullscreen canvas{max-height:calc(100vh - 230px)}
      `}</style>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-4 border-[#40394d] bg-[#18151f] p-3 shadow-[4px_4px_0_#07060a]"><h2 className="mb-2 border-b-2 border-[#40394d] pb-2 text-xs font-black tracking-[0.12em] text-[#ddd5e3]">{title}</h2>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border-2 border-[#40394d] bg-[#0f0d13] p-2"><div className="text-[#777080]">{label}</div><b>{value}</b></div>;
}
