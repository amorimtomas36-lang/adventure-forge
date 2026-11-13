import os, re, time
from pathlib import Path
from typing import Literal
import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

app=FastAPI(title="Nova AI")
SUPABASE_URL=os.getenv("SUPABASE_URL","").rstrip("/")
SUPABASE_KEY=os.getenv("SUPABASE_PUBLISHABLE_KEY","")
AI_KEY=os.getenv("AI_API_KEY","")
AI_BASE=os.getenv("AI_BASE_URL","https://api.openai.com/v1").rstrip("/")
AI_MODEL=os.getenv("AI_MODEL","")
CACHE={"at":0,"items":[]}

async def user_from_token(authorization):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401,"Inicia sessão para continuar.")
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(503,"Autenticação ainda não configurada no servidor.")
    async with httpx.AsyncClient(timeout=15) as c:
        r=await c.get(SUPABASE_URL+"/auth/v1/user",headers={"apikey":SUPABASE_KEY,"Authorization":authorization})
    if r.status_code!=200: raise HTTPException(401,"Sessão inválida ou expirada.")
    return r.json()

@app.get("/",response_class=HTMLResponse)
async def home():
    return HTML.replace("__SUPABASE_URL__",SUPABASE_URL).replace("__SUPABASE_KEY__",SUPABASE_KEY)

@app.get("/api/health")
async def health():
    return {"ok":True,"auth_configured":bool(SUPABASE_URL and SUPABASE_KEY),"ai_configured":bool(AI_KEY and AI_MODEL)}

class Chat(BaseModel):
    messages:list[dict]=Field(min_length=1,max_length=40)
    mode:Literal["chat","code","writing"]="chat"

@app.post("/api/chat")
async def chat(body:Chat,authorization:str|None=Header(default=None)):
    await user_from_token(authorization)
    if not AI_KEY or not AI_MODEL: raise HTTPException(503,"Motor de IA ainda não configurado.")
    system={"chat":"És a Nova AI, assistente útil, direto e rigoroso. Responde na língua do utilizador.",
            "code":"És a Nova AI, especialista em programação. Produz código seguro e funcional.",
            "writing":"És a Nova AI, especialista em escrita e documentos."}[body.mode]
    msgs=[{"role":"system","content":system}]+body.messages
    async with httpx.AsyncClient(timeout=90) as c:
        r=await c.post(AI_BASE+"/chat/completions",headers={"Authorization":"Bearer "+AI_KEY},json={"model":AI_MODEL,"messages":msgs})
    if r.status_code>=400: raise HTTPException(502,"O fornecedor de IA recusou o pedido. Confirma a chave/modelo.")
    return {"reply":r.json()["choices"][0]["message"]["content"],"model":AI_MODEL}

def parse_catalog(md):
    out=[]; category="Geral"; in_index=False
    for raw in md.splitlines():
        line=raw.strip()
        if line=="## Index": in_index=True; continue
        if in_index and line=="## License": break
        if not in_index: continue
        h=re.match(r"^###\s+(.+)",line)
        if h: category=h.group(1).strip(); continue
        if not line.startswith("|"): continue
        cells=[x.strip() for x in line.strip("|").split("|")]
        if len(cells)<5 or cells[0].startswith("---") or cells[0].lower()=="api": continue
        m=re.match(r"^\[([^\]]+)\]\((https?://[^)]+)\)$",cells[0])
        if m: out.append({"name":m.group(1),"url":m.group(2),"description":cells[1],"auth":cells[2],"https":cells[3],"cors":cells[4],"category":category})
    return out

@app.get("/api/catalog")
async def catalog(authorization:str|None=Header(default=None),q:str=Query(default="",max_length=100),offset:int=0):
    await user_from_token(authorization)
    if time.time()-CACHE["at"]>43200 or not CACHE["items"]:
        async with httpx.AsyncClient(timeout=30) as c:
            r=await c.get("https://raw.githubusercontent.com/public-apis/public-apis/master/README.md")
            r.raise_for_status()
        CACHE["items"]=parse_catalog(r.text); CACHE["at"]=time.time()
    items=CACHE["items"]; needle=q.casefold().strip()
    if needle: items=[x for x in items if needle in (x["name"]+" "+x["description"]+" "+x["category"]).casefold()]
    return {"total":len(items),"items":items[max(0,offset):max(0,offset)+50],"source":"https://github.com/public-apis/public-apis","note":"Diretório de APIs: nem todas são gratuitas ou dispensam chave. A listagem não executa serviços de terceiros."}

HTML = r"""<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10131b"><title>Nova AI</title><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><style>
*{box-sizing:border-box}body{margin:0;background:#10131b;color:#eef2fa;font:15px system-ui}button,input,textarea{font:inherit}button{cursor:pointer}.hidden{display:none!important}.auth{min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(420px,100%);background:#191f2c;border:1px solid #30394c;border-radius:18px;padding:26px}.card input{width:100%;padding:12px;margin:7px 0 14px;background:#0f141e;color:white;border:1px solid #39445a;border-radius:9px}.primary{background:#8b7cff;color:white;border:0;padding:12px;border-radius:9px;width:100%}.app{display:flex;height:100vh}.side{width:250px;background:#0b0f17;padding:16px;display:flex;flex-direction:column;gap:9px}.side button,.mode button{padding:10px;background:#1a2130;color:#ddd;border:1px solid #30394c;border-radius:9px}.hist{overflow:auto;flex:1;display:flex;flex-direction:column;gap:5px}.hist button{text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.main{flex:1;display:flex;flex-direction:column;min-width:0}.top{padding:16px;border-bottom:1px solid #30394c}.messages{flex:1;overflow:auto;padding:24px max(16px,9%)}.msg{max-width:800px;margin:0 auto 18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.who{color:#b9afff;font-weight:700}.composer{width:min(850px,calc(100% - 24px));margin:0 auto 12px;background:#1a2130;border:1px solid #39445a;border-radius:14px;padding:10px}.composer textarea{width:100%;background:transparent;color:white;border:0;outline:0;resize:vertical;padding:8px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row button{padding:8px 11px;border-radius:8px;border:1px solid #30394c;background:#151b27;color:#ddd}.catalog{position:fixed;inset:5%;background:#171e2b;border:1px solid #39445a;border-radius:16px;padding:18px;overflow:auto}.api{padding:12px;border:1px solid #39445a;border-radius:10px;margin:8px 0}.muted{color:#9ca8bb;font-size:12px}@media(max-width:700px){.side{width:150px;padding:9px}.messages{padding:16px 10px}.catalog{inset:2%}.top{padding:12px}}
</style></head><body>
<section id="auth" class="auth"><div class="card"><h1>✦ Nova AI</h1><p class="muted">A tua conta e o teu histórico privado.</p><form id="authForm"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" minlength="8" placeholder="Palavra-passe (mín. 8)" required><button id="authSubmit" class="primary">Entrar</button></form><p id="authMsg" class="muted"></p><button id="toggle" style="background:none;border:0;color:#b9afff">Criar conta nova</button></div></section>
<div id="app" class="app hidden"><aside class="side"><h2>✦ Nova AI</h2><button id="new">＋ Nova conversa</button><button id="showCatalog">▦ Catálogo de APIs</button><b class="muted">HISTÓRICO</b><div id="history" class="hist"></div><button id="logout">Terminar sessão</button></aside><main class="main"><div class="top row"><b id="heading">Nova conversa</b><span class="muted" id="status">Online</span></div><div id="messages" class="messages"><div class="msg"><h2>O que vamos criar hoje?</h2><p class="muted">Sites · Programação · Documentos · Ideias</p></div></div><div class="composer"><div class="row mode"><button data-mode="chat">Conversar</button><button data-mode="code">Programar</button><button data-mode="writing">Escrever</button></div><textarea id="prompt" rows="3" placeholder="Escreve a tua mensagem..."></textarea><div class="row"><span class="muted" style="flex:1">A IA pode cometer erros.</span><button id="send" class="primary" style="width:auto">Enviar ↑</button></div></div></main></div>
<div id="catalog" class="catalog hidden"><div class="row"><h2 style="flex:1">Catálogo de APIs</h2><button id="closeCatalog">Fechar ×</button></div><p class="muted" id="catalogCount">A carregar...</p><input id="searchApi" placeholder="Pesquisar APIs..." style="width:100%;padding:12px;background:#101620;color:white;border:1px solid #39445a;border-radius:9px"><div id="apiList"></div><button id="more">Carregar mais</button><p class="muted">Fonte: public-apis/public-apis. Algumas APIs exigem chave ou pagamento; o catálogo não fornece acesso universal.</p></div>
<script>
const URL="__SUPABASE_URL__",KEY="__SUPABASE_KEY__",ready=URL.startsWith("https://")&&KEY&&!URL.includes("__SUPABASE");
const db=ready?supabase.createClient(URL,KEY):null;let user=null,conversation=null,messages=[],mode="chat",signup=false,offset=0;
const $=s=>document.querySelector(s),auth=$("#auth"),app=$("#app");
function note(t){$("#authMsg").textContent=t}
function add(role,text){let d=document.createElement("div");d.className="msg";let b=document.createElement("b");b.className="who";b.textContent=role==="user"?"Tu":"Nova AI";let p=document.createElement("div");p.textContent=text;d.append(b,p);$("#messages").append(d);$("#messages").scrollTop=$("#messages").scrollHeight;return p}
async function enter(u){user=u;auth.classList.add("hidden");app.classList.remove("hidden");await loadHistory()}
async function loadHistory(){let {data,error}=await db.from("conversations").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(50);let box=$("#history");box.replaceChildren();if(error){box.textContent="Erro ao carregar histórico";return}for(let c of data||[]){let b=document.createElement("button");b.textContent=c.title;b.onclick=()=>openConversation(c.id);box.append(b)}}
async function openConversation(id){let {data,error}=await db.from("messages").select("role,content").eq("conversation_id",id).order("created_at");if(error)return alert("Não foi possível abrir.");conversation=id;messages=data||[];$("#messages").replaceChildren();messages.forEach(m=>add(m.role,m.content));}
$("#toggle").onclick=()=>{signup=!signup;$("#authSubmit").textContent=signup?"Criar conta":"Entrar";$("#toggle").textContent=signup?"Já tenho conta":"Criar conta nova";note("")};
$("#authForm").onsubmit=async e=>{e.preventDefault();if(!db)return note("A autenticação ainda não foi configurada pelo administrador.");let email=$("#email").value,password=$("#password").value;let r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});if(r.error)return note(r.error.message);if(r.data.session)enter(r.data.user);else note("Confirma o email e depois entra.")};
$("#logout").onclick=async()=>{await db.auth.signOut();location.reload()};
$("#new").onclick=()=>{conversation=null;messages=[];$("#messages").innerHTML='<div class="msg"><h2>O que vamos criar hoje?</h2></div>';$("#heading").textContent="Nova conversa"};
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll("[data-mode]").forEach(x=>x.style.borderColor=x===b?"#8b7cff":"#30394c")});
async function save(role,content){let {data:session}=await db.auth.getSession();if(!conversation){let r=await db.from("conversations").insert({user_id:user.id,title:content.slice(0,55)}).select("id").single();if(r.error)throw r.error;conversation=r.data.id}let r=await db.from("messages").insert({conversation_id:conversation,user_id:user.id,role,content});if(r.error)throw r.error;await db.from("conversations").update({updated_at:new Date().toISOString()}).eq("id",conversation);await loadHistory()}
async function send(){let text=$("#prompt").value.trim();if(!text)return;$("#prompt").value="";add("user",text);messages.push({role:"user",content:text});$("#send").disabled=true;try{await save("user",text);let {data:s}=await db.auth.getSession();let r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+s.session.access_token},body:JSON.stringify({messages,mode})});let j=await r.json();if(!r.ok)throw Error(j.detail||"Erro na IA");add("assistant",j.reply);messages.push({role:"assistant",content:j.reply});await save("assistant",j.reply)}catch(e){add("assistant","Erro: "+e.message)}finally{$("#send").disabled=false}}
$("#send").onclick=send;$("#prompt").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
async function loadCatalog(){let {data:s}=await db.auth.getSession();let q=$("#searchApi").value;let r=await fetch("/api/catalog?q="+encodeURIComponent(q)+"&offset="+offset,{headers:{Authorization:"Bearer "+s.session.access_token}});let j=await r.json();if(!r.ok){$("#apiList").textContent=j.detail;return}$("#catalogCount").textContent=j.total+" APIs encontradas";for(let a of j.items){let d=document.createElement("div");d.className="api";let link=document.createElement("a");link.href=a.url;link.target="_blank";link.rel="noopener";link.textContent=a.name;let p=document.createElement("p");p.textContent=a.description+" · Categoria: "+a.category+" · Auth: "+a.auth;d.append(link,p);$("#apiList").append(d)}}
$("#showCatalog").onclick=()=>{$("#catalog").classList.remove("hidden");offset=0;$("#apiList").replaceChildren();loadCatalog()};$("#closeCatalog").onclick=()=>$("#catalog").classList.add("hidden");$("#searchApi").oninput=()=>{offset=0;$("#apiList").replaceChildren();loadCatalog()};$("#more").onclick=()=>{offset+=50;loadCatalog()};
(async()=>{if(!ready){note("O administrador ainda precisa configurar o Supabase.");return}let {data}=await db.auth.getSession();if(data.session)enter(data.session.user)})();
</script></body></html>"""
