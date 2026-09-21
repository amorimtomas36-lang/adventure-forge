import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Biome = {
  name: string;
  tile: string;
  accent: string;
  enemy: string;
  boss: string;
  bossHp: number;
  level: number;
  reward: number;
};

const BIOMES: Biome[] = [
  { name: "Vale Verde", tile: "#2f6b3f", accent: "#8fcf63", enemy: "Slime", boss: "Rei Slime", bossHp: 180, level: 1, reward: 180 },
  { name: "Deserto Rubro", tile: "#a15d35", accent: "#e2a14a", enemy: "Escorpião", boss: "Colosso Rubro", bossHp: 300, level: 4, reward: 320 },
  { name: "Picos Gelados", tile: "#477d91", accent: "#bde8f2", enemy: "Lobo de Gelo", boss: "Yeti Ancestral", bossHp: 450, level: 8, reward: 520 },
  { name: "Cratera Sombria", tile: "#4d304b", accent: "#d66b6b", enemy: "Demónio", boss: "Senhor da Cratera", bossHp: 720, level: 13, reward: 900 },
];

const W = 20;
const H = 11;
const TILE = 32;

function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const player = useRef({ x: 10, y: 6 });
  const [biome, setBiome] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [gold, setGold] = useState(100);
  const [hp, setHp] = useState(100);
  const [damage, setDamage] = useState(18);
  const [kills, setKills] = useState(0);
  const [quest, setQuest] = useState(0);
  const [bossHp, setBossHp] = useState(BIOMES[0].bossHp);
  const [message, setMessage] = useState("Explora o mapa e fala com os NPCs.");
  const [fullscreen, setFullscreen] = useState(false);
  const gameShellRef = useRef<HTMLElement>(null);
  const current = BIOMES[biome];
  const xpNeed = 100 + (level - 1) * 60;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"," "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    player.current = { x: 10, y: 6 };
    setBossHp(current.bossHp);
    setQuest(0);
    setMessage("Novo mapa descoberto. Explora com WASD ou as setas.");
  }, [biome]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W * TILE;
    canvas.height = H * TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let lastMove = 0;
    const draw = (time: number) => {
      const k = keys.current;
      if (time - lastMove > 115) {
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

      ctx.fillStyle = current.tile;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const n = (x * 17 + y * 31 + biome * 13) % 7;
        ctx.fillStyle = n < 3 ? current.accent : current.tile;
        ctx.globalAlpha = n < 3 ? 0.12 : 0.08;
        ctx.fillRect(x*TILE+2, y*TILE+2, TILE-4, TILE-4);
      }
      ctx.globalAlpha = 1;

      const obstacle = (x:number,y:number,type:number) => {
        ctx.fillStyle = type === 0 ? "#173b27" : "#3b3030";
        ctx.fillRect(x*TILE+7,y*TILE+10,18,17);
        ctx.fillStyle = type === 0 ? "#4f9a50" : "#776b61";
        ctx.fillRect(x*TILE+4,y*TILE+6,24,13);
        ctx.fillRect(x*TILE+10,y*TILE+2,12,10);
      };
      for (const [x,y,t] of [[2,2,0],[4,8,0],[16,2,0],[17,8,0],[7,2,1],[13,8,1]] as [number,number,number][]) obstacle(x,y,t);

      // old-school NPCs and enemy sprites
      const npc = (x:number,y:number,shirt:string) => {
        ctx.fillStyle = "#24202a"; ctx.fillRect(x*TILE+8,y*TILE+5,16,23);
        ctx.fillStyle = "#e8b38d"; ctx.fillRect(x*TILE+10,y*TILE+4,12,10);
        ctx.fillStyle = shirt; ctx.fillRect(x*TILE+8,y*TILE+14,16,11);
        ctx.fillStyle = "#111"; ctx.fillRect(x*TILE+11,y*TILE+9,3,3); ctx.fillRect(x*TILE+18,y*TILE+9,3,3);
      };
      npc(3,4,"#4ecf8e"); npc(16,6,"#d9a441");

      ctx.fillStyle = "#16131c";
      ctx.fillRect(14*TILE+5, 3*TILE+7, 22, 20);
      ctx.fillStyle = "#bd3d58";
      ctx.fillRect(14*TILE+2, 3*TILE+2, 28, 16);
      ctx.fillStyle = "#ef7890";
      ctx.fillRect(14*TILE+10, 3*TILE+6, 5, 5); ctx.fillRect(14*TILE+23, 3*TILE+6, 5, 5);

      const px = player.current.x*TILE, py = player.current.y*TILE;
      ctx.fillStyle = "#15121a"; ctx.fillRect(px+5,py+4,22,25);
      ctx.fillStyle = "#3f6de0"; ctx.fillRect(px+7,py+13,18,13);
      ctx.fillStyle = "#e8b38d"; ctx.fillRect(px+9,py+6,14,12);
      ctx.fillStyle = "#6b3e28"; ctx.fillRect(px+7,py+3,18,7);
      ctx.fillStyle = "#fff"; ctx.fillRect(px+13,py+10,3,3); ctx.fillRect(px+19,py+10,3,3);

      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0,0,canvas.width,27);
      ctx.fillStyle = "#fff"; ctx.font = "bold 13px monospace";
      ctx.fillText(current.name + "  •  WASD / SETAS", 9, 18);
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
    if (hp <= 0) return setMessage("Estás derrotado. Compra uma cura com a Lina.");
    setKills(k => k + 1);
    setQuest(q => Math.min(5, q + 1));
    setGold(g => g + 12 + current.level * 2);
    setHp(h => Math.max(0, h - Math.max(2, current.level + Math.floor(Math.random()*7))));
    gainXp(25 + current.level * 3);
    setMessage(current.enemy + " derrotado! +XP e ouro.");
  };

  const attackBoss = () => {
    if (hp <= 0) return setMessage("Estás derrotado. Cura-te primeiro.");
    if (bossHp <= 0) return setMessage("Este boss já foi derrotado.");
    const hit = damage + Math.floor(Math.random()*9);
    const retaliation = Math.max(3, current.level + Math.floor(Math.random()*10));
    const next = Math.max(0, bossHp - hit);
    setBossHp(next);
    setHp(h => Math.max(0, h - retaliation));
    if (next === 0) {
      setGold(g => g + current.reward);
      gainXp(90 + current.level * 15);
      setMessage("BOSS DERROTADO! Recompensa: " + current.reward + " ouro.");
    } else setMessage("Ataque: -" + hit + " HP do boss. Sofreste " + retaliation + " dano.");
  };

  const heal = () => {
    if (gold < 25) return setMessage("Precisas de 25 ouro.");
    setGold(g => g - 25); setHp(100); setMessage("Lina curou-te completamente.");
  };

  const buy = () => {
    if (gold < 150) return setMessage("A arma custa 150 ouro.");
    setGold(g => g - 150); setDamage(d => d + 15); setMessage("Brom vendeu uma espada. +15 dano!");
  };

  const talkAria = () => {
    if (quest >= 5) {
      setGold(g => g + 100); gainXp(60); setQuest(0);
      setMessage("Aria: missão concluída! +100 ouro e +60 XP.");
    } else setMessage("Aria: derrota 5 monstros neste bioma e volta aqui.");
  };

  const locked = (i:number) => level < BIOMES[i].level;

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) { await gameShellRef.current?.requestFullscreen?.(); setFullscreen(true); }
    else { await document.exitFullscreen?.(); setFullscreen(false); }
  };

  useEffect(() => { const onFs = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", onFs); return () => document.removeEventListener("fullscreenchange", onFs); }, []);

  const press = (key:string) => {
    keys.current.add(key);
    window.setTimeout(() => keys.current.delete(key), 150);
  };

  return (
    <main ref={gameShellRef} className={`min-h-screen bg-[#111018] p-2 text-white md:p-4 ${fullscreen ? "overflow-auto" : ""}`} style={{ fontFamily: "monospace" }}>
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b-4 border-[#302b3b] pb-3">
          <div><h1 className="text-2xl font-black tracking-tight md:text-3xl">ADVENTURE FORGE</h1><p className="text-xs text-[#a9a2b5]">2D PIXEL RPG • MISSÕES • ARMAS • BOSSES</p></div>
          <div className="flex flex-wrap gap-2 text-xs font-bold"><button onClick={toggleFullscreen} className="pixel-btn px-3">{fullscreen ? "SAIR DA TELA CHEIA" : "⛶ TELA CHEIA"}</button><span className="border-2 border-[#40394d] bg-[#1d1925] px-3 py-2">LV {level}</span><span className="border-2 border-[#40394d] bg-[#1d1925] px-3 py-2">HP {hp}/100</span><span className="border-2 border-[#40394d] bg-[#1d1925] px-3 py-2">G {gold}</span></div>
        </header>

        <div className="grid min-h-[calc(100vh-100px)] gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="border-4 border-[#40394d] bg-[#18151f] p-2 shadow-[8px_8px_0_#09080d]">
            <div className="overflow-auto bg-black">
              <canvas ref={canvasRef} className="mx-auto block h-auto max-w-full lg:w-full" style={{ imageRendering: "pixelated" }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button onClick={()=>press("arrowleft")} className="pixel-btn">◀</button>
              <button onClick={()=>press("arrowup")} className="pixel-btn">▲</button>
              <button onClick={()=>press("arrowright")} className="pixel-btn">▶</button>
              <button onClick={()=>press("arrowdown")} className="pixel-btn">▼</button>
              <button onClick={hunt} className="pixel-btn">ATACAR</button>
              <button onClick={attackBoss} className="pixel-btn danger">BOSS</button>
            </div>
            <style>{`.pixel-btn{border:3px solid #51495d;background:#292331;padding:10px;font-weight:900;font-size:12px;box-shadow:3px 3px 0 #0b0910}.pixel-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #0b0910}.pixel-btn:hover{background:#393142}.danger{background:#713445}`}</style>
          </section>

          <aside className="space-y-3">
            <Panel title="MISSÃO — ARIA">
              <p className="text-xs text-[#c5bfcc]">Derrota 5 inimigos em {current.name}.</p>
              <div className="mt-2 h-4 border-2 border-[#51495d] bg-[#100e14]"><div className="h-full bg-[#62c47a]" style={{width: `${quest*20}%`}} /></div>
              <p className="mt-1 text-xs">{quest}/5</p>
              <button onClick={talkAria} className="pixel-btn mt-2 w-full">FALAR COM ARIA</button>
            </Panel>
            <Panel title={"BOSS — " + current.boss}>
              <div className="flex justify-between text-xs"><span>HP</span><span>{bossHp}/{current.bossHp}</span></div>
              <div className="mt-2 h-4 border-2 border-[#51495d] bg-[#100e14]"><div className="h-full bg-[#c84c63]" style={{width:`${Math.max(0,bossHp/current.bossHp*100)}%`}} /></div>
              <button onClick={attackBoss} className="pixel-btn danger mt-2 w-full">ATACAR BOSS</button>
            </Panel>
            <Panel title="NPCs">
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <button onClick={talkAria} className="npc">ARIA<br/><b>MISSÃO</b></button>
                <button onClick={buy} className="npc">BROM<br/><b>ESPADA 150G</b></button>
                <button onClick={heal} className="npc">LINA<br/><b>CURA 25G</b></button>
              </div>
            </Panel>
          </aside>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Panel title="MAPA-MÚNDI">
            <div className="grid grid-cols-2 gap-2">
              {BIOMES.map((b,i)=><button key={b.name} disabled={locked(i)} onClick={()=>setBiome(i)} className={`border-2 p-2 text-left text-xs ${i===biome?"border-[#d9b35d] bg-[#302938]":"border-[#40394d] bg-[#1d1925]"} ${locked(i)?"opacity-40":""}`}><b>{b.name}</b><br/><span className="text-[#aaa2b1]">{locked(i)?"LOCK LV "+b.level:"BOSS: "+b.boss}</span></button>)}
            </div>
          </Panel>
          <Panel title="STATUS">
            <div className="grid grid-cols-4 gap-2 text-center text-[10px]"><Stat label="XP" value={xp+"/"+xpNeed}/><Stat label="DANO" value={String(damage)}/><Stat label="ABATES" value={String(kills)}/><Stat label="OURO" value={String(gold)}/></div>
            <div className="mt-2 border-2 border-[#40394d] bg-[#100e14] p-2 text-xs text-[#c5bfcc]">{message}</div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Panel({title,children}:{title:string;children:ReactNode}) {
  return <div className="border-4 border-[#40394d] bg-[#1a1721] p-3 shadow-[4px_4px_0_#09080d]"><h2 className="mb-2 border-b-2 border-[#40394d] pb-2 text-sm font-black">{title}</h2>{children}</div>;
}
function Stat({label,value}:{label:string;value:string}) {
  return <div className="border-2 border-[#40394d] bg-[#121017] p-2"><div className="text-[#88818f]">{label}</div><b>{value}</b></div>;
}
