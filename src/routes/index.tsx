import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Biome = {
  name: string; emoji: string; bg: string; enemy: string; boss: string;
  bossHp: number; reward: number; level: number;
};

const biomes: Biome[] = [
  { name: "Vale Verde", emoji: "🌲", bg: "#244d35", enemy: "Slime", boss: "Rei Slime", bossHp: 160, reward: 180, level: 1 },
  { name: "Deserto Rubro", emoji: "🏜️", bg: "#8b4a28", enemy: "Escorpião", boss: "Colosso Rubro", bossHp: 280, reward: 320, level: 4 },
  { name: "Picos Gelados", emoji: "❄️", bg: "#315d78", enemy: "Lobo de Gelo", boss: "Yeti Ancestral", bossHp: 430, reward: 520, level: 8 },
  { name: "Cratera Sombria", emoji: "🌋", bg: "#4b253d", enemy: "Demónio", boss: "Senhor da Cratera", bossHp: 700, reward: 900, level: 13 },
];

function Index() {
  const [biome, setBiome] = useState(0);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [gold, setGold] = useState(100);
  const [hp, setHp] = useState(100);
  const [bossHp, setBossHp] = useState(biomes[0].bossHp);
  const [quest, setQuest] = useState(0);
  const [kills, setKills] = useState(0);
  const [damage, setDamage] = useState(18);
  const [message, setMessage] = useState("Fala com a Aria para começar uma missão.");
  const current = biomes[biome];
  const xpNeed = 100 + (level - 1) * 60;

  useEffect(() => {
    setBossHp(current.bossHp);
    setQuest(0);
    setMessage("Novo bioma descoberto! Derrota inimigos e enfrenta o boss.");
  }, [biome]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        setMessage("Explorando...");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const gainXp = (amount: number) => {
    let next = xp + amount;
    let lvl = level;
    while (next >= 100 + (lvl - 1) * 60) {
      next -= 100 + (lvl - 1) * 60;
      lvl++;
      setDamage(d => d + 7);
      setHp(100);
      setMessage("✨ Subiste de nível! O teu dano aumentou.");
    }
    setXp(next);
    setLevel(lvl);
  };

  const attack = () => {
    if (hp <= 0) return setMessage("Estás derrotado. Usa o botão Curar.");
    const dealt = damage + Math.floor(Math.random() * 9);
    const retaliation = Math.max(3, Math.floor(Math.random() * 12) + current.level);
    const nextBoss = Math.max(0, bossHp - dealt);
    setBossHp(nextBoss);
    setHp(h => Math.max(0, h - retaliation));
    if (nextBoss === 0) {
      setGold(g => g + current.reward);
      gainXp(80 + current.level * 15);
      setMessage("🏆 Boss derrotado! Recompensa recebida.");
    } else {
      setMessage(`⚔️ Causaste ${dealt} de dano e recebeste ${retaliation}.`);
    }
  };

  const hunt = () => {
    if (hp <= 0) return setMessage("Estás derrotado. Usa Curar.");
    const dealt = damage + Math.floor(Math.random() * 10);
    const retaliation = Math.max(2, Math.floor(Math.random() * 7) + current.level);
    setHp(h => Math.max(0, h - retaliation));
    setKills(k => k + 1);
    setQuest(q => Math.min(5, q + 1));
    setGold(g => g + 12 + current.level * 2);
    gainXp(25 + current.level * 3);
    setMessage(`👾 ${current.enemy} derrotado! +XP e ouro.`);
  };

  const heal = () => {
    if (gold < 25) return setMessage("Precisas de 25 de ouro para curar.");
    setGold(g => g - 25);
    setHp(100);
    setMessage("❤️ Recuperaste toda a vida.");
  };

  const buy = () => {
    if (gold < 150) return setMessage("Precisas de 150 de ouro.");
    setGold(g => g - 150);
    setDamage(d => d + 15);
    setMessage("🗡️ Compraste uma arma melhor! +15 dano.");
  };

  const locked = (i: number) => level < biomes[i].level;

  const stats = useMemo(() => [
    ["Nível", level], ["XP", `${xp}/${xpNeed}`], ["Ouro", `🪙 ${gold}`], ["Abates", kills],
  ], [level, xp, xpNeed, gold, kills]);

  return (
    <main className="min-h-screen text-white" style={{ background: "linear-gradient(135deg,#101522,#18243a)" }}>
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-3xl font-black">⚔️ Adventure Forge</h1><p className="text-white/65">RPG 2D • explora • faz missões • derrota bosses</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-bold">❤️ {hp}/100 &nbsp; 🪙 {gold}</div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-2xl">
            <div className="relative h-[420px] overflow-hidden" style={{ background: current.bg }}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle,white 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
              <div className="absolute left-5 top-5 rounded-xl bg-black/35 px-3 py-2 font-bold">{current.emoji} {current.name}</div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl drop-shadow-xl">🧙</div>
              <div className="absolute left-8 bottom-12 text-5xl">🏠</div>
              <div className="absolute right-10 top-20 text-5xl">🧑‍🌾</div>
              <div className="absolute right-14 bottom-14 text-6xl">👾</div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-sm text-white/75">WASD / setas para explorar</div>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-black/25 p-3">
              {[
                ["↑","move"],["⚔️","hunt"],["👹","boss"]
              ].map(([icon, type]) => (
                <button key={type} onClick={type==="hunt"?hunt:type==="boss"?attack:()=>setMessage("🚶 Moveste-te pelo mapa.")} className="rounded-xl bg-white/10 p-3 font-bold transition hover:bg-white/20 active:scale-95">{icon} {type==="move"?"Explorar":type==="hunt"?"Caçar":"Atacar Boss"}</button>
              ))}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <h2 className="mb-3 text-xl font-black">📜 Missão da Aria</h2>
              <p className="text-sm text-white/75">Derrota 5 inimigos em {current.name}.</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-emerald-400" style={{width:`${quest*20}%`}} /></div>
              <p className="mt-1 text-xs text-white/60">{quest}/5 inimigos</p>
              <button onClick={()=>{setQuest(0);setMessage("📜 Missão reiniciada pela Aria.");}} className="mt-3 w-full rounded-xl bg-emerald-500/80 px-3 py-2 font-bold hover:bg-emerald-500">Falar com Aria</button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <h2 className="mb-3 text-xl font-black">👹 Boss</h2>
              <div className="flex justify-between text-sm"><span>{current.boss}</span><span>{bossHp}/{current.bossHp}</span></div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-red-500" style={{width:`${bossHp/current.bossHp*100}%`}} /></div>
              <button onClick={attack} className="mt-3 w-full rounded-xl bg-red-500 px-3 py-2 font-black hover:bg-red-600">⚔️ Lutar</button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <h2 className="mb-3 text-xl font-black">🧑‍🏫 NPCs</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <button onClick={()=>setMessage("Aria: 'Derrota 5 inimigos e volta aqui!'")} className="rounded-xl bg-white/10 p-3">🧝<br/>Aria</button>
                <button onClick={buy} className="rounded-xl bg-white/10 p-3">🧑‍🔧<br/>Brom<br/><span className="text-yellow-300">150 🪙</span></button>
                <button onClick={heal} className="rounded-xl bg-white/10 p-3">🧑‍🏫<br/>Lina<br/><span className="text-pink-300">25 🪙</span></button>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <h2 className="mb-3 text-xl font-black">🗺️ Biomas</h2>
            <div className="grid grid-cols-2 gap-2">
              {biomes.map((b,i)=>(
                <button key={b.name} disabled={locked(i)} onClick={()=>setBiome(i)} className={`rounded-xl p-3 text-left ${i===biome?"bg-white/25":"bg-black/20"} ${locked(i)?"opacity-40":"hover:bg-white/20"}`}>
                  <b>{b.emoji} {b.name}</b><br/><span className="text-xs text-white/60">{locked(i)?`🔒 Nível ${b.level}`:`Boss: ${b.boss}`}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <h2 className="mb-3 text-xl font-black">📊 Personagem</h2>
            <div className="grid grid-cols-2 gap-2">{stats.map(([a,b])=><div key={a} className="rounded-xl bg-black/20 p-3"><span className="text-xs text-white/55">{a}</span><div className="font-black">{b}</div></div>)}</div>
            <div className="mt-3 rounded-xl bg-black/20 p-3"><span className="text-xs text-white/55">Dano</span><div className="font-black">⚔️ {damage}</div></div>
          </div>
        </section>
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-center font-bold text-white/80">{message}</div>
      </div>
    </main>
  );
}
