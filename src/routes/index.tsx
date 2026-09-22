import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

export const Route = createFileRoute("/")({ component: Index });

type Finding = { type: string; value: string; severity: "ALTA" | "MÉDIA" };

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("Seleciona um APK, IPA, ZIP ou outro ficheiro.");
  const [dragging, setDragging] = useState(false);

  const sizeLabel = useMemo(() => {
    if (!file) return "—";
    return file.size < 1048576 ? (file.size / 1024).toFixed(1) + " KB" : (file.size / 1048576).toFixed(2) + " MB";
  }, [file]);

  const inspect = async (selected: File) => {
    setFile(selected); setFindings([]); setScanning(true); setMessage("A analisar o ficheiro localmente…");
    try {
      const buffer = await selected.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer)).slice(0, 8000000);
      const results: Finding[] = [];
      const patterns: [string, RegExp, "ALTA" | "MÉDIA"][] = [
        ["OpenAI/API key", /sk-[A-Za-z0-9_-]{20,}/g, "ALTA"],
        ["Google API key", /AIza[0-9A-Za-z_-]{30,}/g, "ALTA"],
        ["Generic secret", /(?:api[_-]?key|secret[_-]?key|access[_-]?token)[\s:=\"']{1,6}[A-Za-z0-9_\-./+=]{16,}/gi, "MÉDIA"],
        ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "ALTA"]
      ];
      for (const [type, regex, severity] of patterns) {
        for (const match of text.matchAll(regex)) {
          const raw = match[0];
          const value = raw.length > 38 ? raw.slice(0, 18) + "…" + raw.slice(-8) : raw;
          if (!results.some((item) => item.type === type && item.value === value)) results.push({ type, value, severity });
          if (results.length >= 20) break;
        }
      }
      setFindings(results);
      setMessage(results.length ? "Análise concluída: " + results.length + " possível(is) segredo(s)." : "Análise concluída: nenhum padrão comum encontrado.");
    } catch {
      setMessage("Não foi possível analisar este ficheiro no navegador.");
    } finally { setScanning(false); }
  };

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) void inspect(selected);
    event.target.value = "";
  };

  const reset = () => { setFile(null); setFindings([]); setMessage("Seleciona um APK, IPA, ZIP ou outro ficheiro."); };

  return (
    <main className="min-h-screen bg-[#08090d] px-3 py-5 text-white md:px-6" style={{ fontFamily: "monospace" }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 border-4 border-[#313746] bg-[#11141b] p-5 shadow-[8px_8px_0_#030407]">
          <p className="text-[10px] font-black tracking-[0.25em] text-[#75b9ff]">APP SECURITY LAB</p>
          <h1 className="mt-2 text-2xl font-black tracking-[0.08em] md:text-4xl">KEY & SECRET SCANNER</h1>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-[#a8afbf]">Verifica ficheiros de aplicações à procura de possíveis segredos embutidos. A análise acontece no navegador e não modifica a aplicação.</p>
        </header>

        <section className={"drop-zone " + (dragging ? "dragging" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const dropped = e.dataTransfer.files?.[0]; if (dropped) void inspect(dropped); }}>
          <input id="app-file" type="file" className="hidden" onChange={choose} />
          <div className="text-5xl">⌁</div>
          <h2 className="mt-3 text-lg font-black">ADICIONAR FICHEIRO</h2>
          <p className="mt-2 text-xs text-[#8f99ab]">Arrasta aqui ou escolhe um ficheiro do dispositivo.</p>
          <label htmlFor="app-file" className="pixel-btn mt-5 inline-block cursor-pointer">ESCOLHER FICHEIRO</label>
          <p className="mt-3 text-[9px] text-[#697284]">APK • IPA • ZIP • outros formatos</p>
          <p className="mt-2 text-[8px] font-bold tracking-[0.18em] text-[#4f596b]">BUILD 2026.09 • SCANNER LOCAL • ATUALIZADA</p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
          <section className="panel">
            <div className="panel-title">RESULTADO DA ANÁLISE</div>
            {file ? <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <Stat label="FICHEIRO" value={file.name} /><Stat label="TAMANHO" value={sizeLabel} /><Stat label="ESTADO" value={scanning ? "A ANALISAR…" : "CONCLUÍDO"} />
            </div> : <div className="empty">Nenhum ficheiro selecionado.</div>}
            {scanning ? <div className="empty"><div className="scan-line" />A procurar padrões de credenciais…</div> :
              findings.length ? <div className="space-y-2">{findings.map((finding, index) =>
                <div key={index} className="finding"><div><b>{finding.type}</b><p className="mt-1 break-all text-[10px] text-[#8f99ab]">{finding.value}</p></div><span className={finding.severity === "ALTA" ? "high" : "medium"}>{finding.severity}</span></div>
              )}</div> :
              <div className="empty">{file ? "✓ Nenhum padrão conhecido encontrado." : "Escolhe um ficheiro para ver os resultados."}</div>}
          </section>

          <aside className="space-y-4">
            <section className="panel">
              <div className="panel-title">SE ENCONTRAR UMA CHAVE</div>
              <ul className="space-y-3 text-[10px] leading-5 text-[#a8afbf]">
                <li>01 — Confirma que a aplicação é tua ou tens autorização para a auditar.</li>
                <li>02 — Revoga/roda a credencial no serviço que a emitiu.</li>
                <li>03 — Move segredos para um backend seguro quando possível.</li>
                <li>04 — Faz uma nova build sem credenciais embutidas.</li>
              </ul>
            </section>
            <section className="panel">
              <div className="panel-title">PRIVACIDADE</div>
              <p className="text-[10px] leading-5 text-[#a8afbf]">A análise usa a File API do navegador. Este site não remove login, licença ou autenticação e não cria versões modificadas de aplicações de terceiros.</p>
            </section>
            <button onClick={reset} disabled={!file} className="pixel-btn w-full disabled:cursor-not-allowed disabled:opacity-30">LIMPAR ANÁLISE</button>
          </aside>
        </div>
      </div>
      <style>{".drop-zone{border:4px dashed #394252;background:#10131a;padding:42px 20px;text-align:center}.drop-zone.dragging{border-color:#75b9ff;background:#151b25}.panel{border:4px solid #313746;background:#11141b;padding:16px;box-shadow:5px 5px 0 #030407}.panel-title{border-bottom:2px solid #313746;padding-bottom:9px;font-size:11px;font-weight:900;letter-spacing:.1em}.pixel-btn{border:3px solid #566174;background:#252b36;padding:11px 16px;font-size:11px;font-weight:900;box-shadow:4px 4px 0 #030407}.pixel-btn:hover{background:#343c4b}.pixel-btn:active{transform:translate(2px,2px);box-shadow:2px 2px 0 #030407}.empty{border:2px solid #252b36;background:#0b0d12;padding:22px;text-align:center;font-size:10px;color:#697284}.finding{display:flex;align-items:center;justify-content:space-between;gap:12px;border:2px solid #303746;background:#0b0d12;padding:12px;font-size:10px}.high,.medium{white-space:nowrap;border:2px solid;padding:4px 6px;font-size:9px;font-weight:900}.high{border-color:#9b4c5e;color:#ff8b9d}.medium{border-color:#967a45;color:#e8c477}.scan-line{height:4px;margin:0 auto 14px;max-width:280px;background:#75b9ff;animation:scan 1s infinite}@keyframes scan{0%,100%{opacity:.2;transform:scaleX(.35)}50%{opacity:1;transform:scaleX(1)}}"} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border-2 border-[#303746] bg-[#0b0d12] p-2"><div className="mb-1 text-[9px] text-[#697284]">{label}</div><b className="block truncate text-[10px]">{value}</b></div>;
}
