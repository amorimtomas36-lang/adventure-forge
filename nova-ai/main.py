import os, re, time, asyncio
from pathlib import Path
from typing import Literal
import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

app=FastAPI(title="Nova AI")
SUPABASE_URL=os.getenv("SUPABASE_URL","").rstrip("/")
SUPABASE_KEY=os.getenv("SUPABASE_PUBLISHABLE_KEY","")
CACHE={"at":0,"items":[]}
MODEL_CACHE={}
FREELLMAPI_URL=os.getenv("FREELLMAPI_URL","").rstrip("/")
FREELLMAPI_ADMIN_EMAIL=os.getenv("FREELLMAPI_ADMIN_EMAIL","").strip()
FREELLMAPI_ADMIN_PASSWORD=os.getenv("FREELLMAPI_ADMIN_PASSWORD","")
FREELLMAPI_API_KEY=os.getenv("FREELLMAPI_API_KEY","").strip()
FREELLMAPI_KEY_CACHE={"key":"","at":0}
FREELLMAPI_MODELS_CACHE={"at":0,"items":[]}
FREELLMAPI_LOCK=asyncio.Lock()
FREEAI_RATE={"global":[],"users":{}}

async def freellmapi_api_key():
    if not FREELLMAPI_URL:
        raise HTTPException(503,"O router gratuito ainda não está configurado.")
    if FREELLMAPI_API_KEY:
        return FREELLMAPI_API_KEY
    if not FREELLMAPI_ADMIN_EMAIL or not FREELLMAPI_ADMIN_PASSWORD:
        raise HTTPException(503,"As credenciais internas do router ainda não estão configuradas.")
    now=time.monotonic()
    cached=FREELLMAPI_KEY_CACHE
    if cached["key"] and now-cached["at"]<600:
        return cached["key"]
    async with FREELLMAPI_LOCK:
        now=time.monotonic()
        cached=FREELLMAPI_KEY_CACHE
        if cached["key"] and now-cached["at"]<600:
            return cached["key"]
        try:
            async with httpx.AsyncClient(timeout=20) as c:
                login=await c.post(FREELLMAPI_URL+"/api/auth/login",json={
                    "email":FREELLMAPI_ADMIN_EMAIL,
                    "password":FREELLMAPI_ADMIN_PASSWORD
                })
                if login.status_code!=200:
                    raise HTTPException(503,"O router gratuito não conseguiu autenticar-se.")
                token=login.json().get("token")
                if not token:
                    raise HTTPException(503,"O router gratuito não devolveu uma sessão válida.")
                key_response=await c.get(FREELLMAPI_URL+"/api/settings/api-key",
                    headers={"Authorization":"Bearer "+token})
                if key_response.status_code!=200:
                    raise HTTPException(503,"Não foi possível obter a chave interna do router.")
                api_key=key_response.json().get("apiKey","")
                if not api_key:
                    raise HTTPException(503,"O router não disponibilizou uma chave de API.")
                FREELLMAPI_KEY_CACHE.update({"key":api_key,"at":time.monotonic()})
                return api_key
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(503,"O router gratuito está temporariamente indisponível.")

def enforce_freeai_rate(user_id):
    now=time.time()
    window=3600
    global_events=[t for t in FREEAI_RATE["global"] if now-t<window]
    user_events=[t for t in FREEAI_RATE["users"].get(user_id,[]) if now-t<window]
    if len(global_events)>=150:
        FREEAI_RATE["global"]=global_events
        raise HTTPException(429,"A quota gratuita partilhada atingiu o limite temporário. Tenta novamente mais tarde.")
    if len(user_events)>=20:
        FREEAI_RATE["global"]=global_events
        FREEAI_RATE["users"][user_id]=user_events
        raise HTTPException(429,"A tua quota de utilização gratuita nesta hora foi atingida. Tenta novamente mais tarde.")
    global_events.append(now)
    user_events.append(now)
    FREEAI_RATE["global"]=global_events
    FREEAI_RATE["users"][user_id]=user_events
    if len(FREEAI_RATE["users"])>5000:
        FREEAI_RATE["users"]={k:v for k,v in FREEAI_RATE["users"].items() if v and now-v[-1]<window}

async def freellmapi_models():
    now=time.monotonic()
    if FREELLMAPI_MODELS_CACHE["items"] and now-FREELLMAPI_MODELS_CACHE["at"]<90:
        return FREELLMAPI_MODELS_CACHE["items"]
    api_key=await freellmapi_api_key()
    try:
        async with httpx.AsyncClient(timeout=25) as c:
            r=await c.get(FREELLMAPI_URL+"/v1/models",params={"available":"true"},
                headers={"Authorization":"Bearer "+api_key})
        if r.status_code>=400:
            raise HTTPException(502,"O catálogo de modelos gratuitos está temporariamente indisponível.")
        data=r.json()
        items=[{"id":"auto","name":"Automático · escolhe o melhor modelo grátis","free":True}]
        for model in data.get("data",[]):
            if not isinstance(model,dict): continue
            model_id=model.get("id")
            if not model_id or model_id=="auto": continue
            items.append({"id":str(model_id),"name":str(model.get("name") or model_id),"free":True})
        FREELLMAPI_MODELS_CACHE.update({"at":time.monotonic(),"items":items})
        return items
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(502,"Não foi possível carregar o catálogo gratuito.")


def provider_configs():
    cf_account=os.getenv("CLOUDFLARE_ACCOUNT_ID","").strip()
    cf_token=os.getenv("CLOUDFLARE_API_TOKEN","").strip()
    return {
        "openai":{"label":"OpenAI · GPT","base":os.getenv("OPENAI_BASE_URL",os.getenv("AI_BASE_URL","https://api.openai.com/v1")).rstrip("/"),"key":os.getenv("OPENAI_API_KEY",os.getenv("AI_API_KEY","")).strip(),"kind":"openai"},
        "gemini":{"label":"Google · Gemini","base":"https://generativelanguage.googleapis.com/v1beta/openai","key":os.getenv("GEMINI_API_KEY","").strip(),"kind":"openai"},
        "groq":{"label":"Groq","base":"https://api.groq.com/openai/v1","key":os.getenv("GROQ_API_KEY","").strip(),"kind":"openai"},
        "openrouter":{"label":"OpenRouter · vários modelos","base":"https://openrouter.ai/api/v1","key":os.getenv("OPENROUTER_API_KEY","").strip(),"kind":"openai"},
        "mistral":{"label":"Mistral AI","base":"https://api.mistral.ai/v1","key":os.getenv("MISTRAL_API_KEY","").strip(),"kind":"openai"},
        "cloudflare":{"label":"Cloudflare Workers AI","base":f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/v1" if cf_account else "","key":cf_token,"kind":"cloudflare","account":cf_account},
        "kilo":{"label":"Kilo Gateway · modelos grátis sem chave","base":"https://api.kilo.ai/api/gateway","key":"","kind":"anonymous","anonymous":True},
    }

def provider_is_configured(cfg):
    if cfg.get("anonymous"): return True
    return bool(cfg.get("key") and (cfg.get("kind")!="cloudflare" or cfg.get("account")))


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
    configured=[k for k,v in provider_configs().items() if provider_is_configured(v)]
    freellmapi_configured=bool(FREELLMAPI_URL and (FREELLMAPI_API_KEY or (FREELLMAPI_ADMIN_EMAIL and FREELLMAPI_ADMIN_PASSWORD)))
    if freellmapi_configured: configured.insert(0,"freellmapi")
    return {"ok":True,"auth_configured":bool(SUPABASE_URL and SUPABASE_KEY),"ai_configured":bool(configured),"providers_configured":configured,"freellmapi_configured":freellmapi_configured}

@app.get("/api/providers")
async def providers(authorization:str|None=Header(default=None)):
    await user_from_token(authorization)
    rows=[{"id":k,"label":v["label"],"configured":provider_is_configured(v)} for k,v in provider_configs().items()]
    freellmapi_configured=bool(FREELLMAPI_URL and (FREELLMAPI_API_KEY or (FREELLMAPI_ADMIN_EMAIL and FREELLMAPI_ADMIN_PASSWORD)))
    if freellmapi_configured:
        rows.insert(0,{"id":"freellmapi","label":"FreeLLMAPI · modelos grátis","configured":True})
    return {"providers":rows}

@app.get("/api/models")
async def models(provider:str=Query(min_length=1,max_length=32),q:str=Query(default="",max_length=100),authorization:str|None=Header(default=None)):
    await user_from_token(authorization)
    if provider=="freellmapi":
        items=await freellmapi_models()
        needle=q.casefold().strip()
        if needle: items=[x for x in items if needle in (x["id"]+" "+x["name"]).casefold()]
        return {"provider":"freellmapi","total":len(items),"items":items[:200]}
    configs=provider_configs()
    cfg=configs.get(provider)
    if not cfg: raise HTTPException(400,"Fornecedor desconhecido.")
    if not provider_is_configured(cfg):
        raise HTTPException(503,"Este fornecedor ainda não tem chave configurada no servidor.")
    cache_key=provider
    cached=MODEL_CACHE.get(cache_key)
    if not cached or time.time()-cached["at"]>300:
        headers={"Authorization":"Bearer "+cfg["key"]} if cfg.get("key") else {}
        url=cfg["base"]+"/models"
        params={}
        if provider=="cloudflare":
            url=f"https://api.cloudflare.com/client/v4/accounts/{cfg['account']}/ai/models/search"
            params={"task":"text-generation","hide_experimental":"true","per_page":100}
        try:
            async with httpx.AsyncClient(timeout=25) as c:
                r=await c.get(url,headers=headers,params=params)
            if r.status_code>=400: raise HTTPException(502,"Não foi possível obter os modelos deste fornecedor.")
            payload=r.json()
            rows=payload.get("data") or payload.get("result") or []
            items=[]
            for item in rows:
                if not isinstance(item,dict): continue
                model_id=item.get("id") or item.get("name") or item.get("model")
                if not model_id: continue
                model_id=str(model_id)
                if provider=="openai" and not model_id.lower().startswith(("gpt-","chat-","o1","o3","o4")): continue
                if provider=="gemini" and not model_id.lower().startswith("gemini"): continue
                if provider=="mistral" and item.get("capabilities",{}).get("completion_chat") is False: continue
                if provider=="openrouter" and "text" not in item.get("architecture",{}).get("output_modalities",["text"]): continue
                if provider=="groq" and any(x in model_id.lower() for x in ("whisper","tts","guard","embed")): continue
                pricing=item.get("pricing") or {}
                try:
                    free=(float(pricing.get("prompt",1))==0 and float(pricing.get("completion",1))==0)
                except (TypeError,ValueError):
                    free=False
                free=free or model_id.endswith(":free")
                if provider=="kilo" and not free and model_id not in ("openrouter/free","kilo-auto/free"): continue
                items.append({"id":model_id,"name":item.get("name") or item.get("display_name") or model_id,"free":free})
            if provider=="openrouter":
                items.insert(0,{"id":"openrouter/free","name":"Automático · apenas modelos gratuitos","free":True})
            if provider=="kilo":
                items.insert(0,{"id":"kilo-auto/free","name":"Kilo Auto Free · escolhe automaticamente","free":True})
                if not any(x["id"]=="openrouter/free" for x in items):
                    items.insert(1,{"id":"openrouter/free","name":"OpenRouter Free · encaminhamento automático","free":True})
            items.sort(key=lambda x:(not x["free"],x["name"].casefold()))
            MODEL_CACHE[cache_key]={"at":time.time(),"items":items[:500]}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(502,"Falha ao consultar o catálogo de modelos.")
    needle=q.casefold().strip()
    items=MODEL_CACHE[cache_key]["items"]
    if needle: items=[x for x in items if needle in (x["id"]+" "+x["name"]).casefold()]
    return {"provider":provider,"total":len(items),"items":items[:200]}

class Chat(BaseModel):
    messages:list[dict]=Field(min_length=1,max_length=40)
    mode:Literal["chat","code","writing"]="chat"
    provider:str=Field(default="openai",min_length=1,max_length=32)
    model:str=Field(min_length=1,max_length=200)

@app.post("/api/chat")
async def chat(body:Chat,authorization:str|None=Header(default=None)):
    current_user=await user_from_token(authorization)
    if body.provider=="freellmapi":
        enforce_freeai_rate(str(current_user.get("id") or "unknown"))
        api_key=await freellmapi_api_key()
        system={"chat":"És a Nova AI, assistente útil, direto e rigoroso. Responde na língua do utilizador.",
                "code":"És a Nova AI, especialista em programação. Produz código seguro e funcional.",
                "writing":"És a Nova AI, especialista em escrita e documentos."}[body.mode]
        msgs=[{"role":"system","content":system}]+body.messages
        try:
            async with httpx.AsyncClient(timeout=150) as c:
                r=await c.post(FREELLMAPI_URL+"/v1/chat/completions",
                    headers={"Authorization":"Bearer "+api_key,"Content-Type":"application/json"},
                    json={"model":body.model or "auto","messages":msgs})
        except Exception:
            raise HTTPException(502,"O router gratuito não respondeu a tempo.")
        if r.status_code==429:
            raise HTTPException(429,"O fornecedor gratuito está ocupado ou atingiu o limite. Tenta novamente mais tarde.")
        if r.status_code>=400:
            raise HTTPException(502,"Nenhum modelo gratuito conseguiu responder neste momento.")
        try:
            data=r.json()
            reply=data["choices"][0]["message"]["content"]
            if isinstance(reply,list):
                reply="".join(str(part.get("text","")) for part in reply if isinstance(part,dict))
            if not isinstance(reply,str) or not reply.strip(): raise ValueError("empty reply")
        except (KeyError,IndexError,TypeError,ValueError):
            raise HTTPException(502,"O fornecedor devolveu uma resposta num formato inesperado.")
        routed=r.headers.get("x-routed-via","modelo gratuito")
        return {"reply":reply,"provider":"FreeLLMAPI · "+routed,"model":body.model or "auto"}
    cfg=provider_configs().get(body.provider)
    if not cfg: raise HTTPException(400,"Fornecedor desconhecido.")
    if not provider_is_configured(cfg): raise HTTPException(503,"Adiciona a chave deste fornecedor nas variáveis privadas do Render.")
    system={"chat":"És a Nova AI, assistente útil, direto e rigoroso. Responde na língua do utilizador.",
            "code":"És a Nova AI, especialista em programação. Produz código seguro e funcional.",
            "writing":"És a Nova AI, especialista em escrita e documentos."}[body.mode]
    msgs=[{"role":"system","content":system}]+body.messages
    if body.provider=="kilo":
        if not (body.model.endswith(":free") or body.model in ("kilo-auto/free","openrouter/free")):
            raise HTTPException(400,"O Kilo sem chave só permite modelos gratuitos.")
        headers={"Content-Type":"application/json"}
    else:
        headers={"Authorization":"Bearer "+cfg["key"],"Content-Type":"application/json"}
    async with httpx.AsyncClient(timeout=90) as c:
        r=await c.post(cfg["base"]+"/chat/completions",headers=headers,json={"model":body.model,"messages":msgs})
    if r.status_code>=400: raise HTTPException(502,"O fornecedor recusou o pedido. Confirma se o modelo está disponível e se a chave tem acesso.")
    data=r.json()
    try: reply=data["choices"][0]["message"]["content"]
    except (KeyError,IndexError,TypeError): raise HTTPException(502,"O fornecedor devolveu uma resposta num formato inesperado.")
    return {"reply":reply,"provider":body.provider,"model":body.model}

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
*{box-sizing:border-box}body{margin:0;background:#10131b;color:#eef2fa;font:15px system-ui}button,input,textarea,select{font:inherit}button{cursor:pointer}select,.model-search{background:#101620;color:#eef2fa;border:1px solid #39445a;border-radius:8px;padding:8px;max-width:190px}.model-search{width:130px}.hidden{display:none!important}.auth{min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(420px,100%);background:#191f2c;border:1px solid #30394c;border-radius:18px;padding:26px}.card input{width:100%;padding:12px;margin:7px 0 14px;background:#0f141e;color:white;border:1px solid #39445a;border-radius:9px}.primary{background:#8b7cff;color:white;border:0;padding:12px;border-radius:9px;width:100%}.social-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.social{padding:11px;background:#101620;color:#eef2fa;border:1px solid #39445a;border-radius:9px}.social.google{grid-column:1/-1;background:#f4f5f7;color:#202124;border-color:#f4f5f7;font-weight:650}.auth-divider{display:flex;align-items:center;gap:10px;color:#9ca8bb;font-size:12px;margin:14px 0}.auth-divider:before,.auth-divider:after{content:"";height:1px;background:#30394c;flex:1}.app{display:flex;height:100vh}.side{width:250px;background:#0b0f17;padding:16px;display:flex;flex-direction:column;gap:9px}.side button,.mode button{padding:10px;background:#1a2130;color:#ddd;border:1px solid #30394c;border-radius:9px}.hist{overflow:auto;flex:1;display:flex;flex-direction:column;gap:5px}.hist button{text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.main{flex:1;display:flex;flex-direction:column;min-width:0}.top{padding:16px;border-bottom:1px solid #30394c}.messages{flex:1;overflow:auto;padding:24px max(16px,9%)}.msg{max-width:800px;margin:0 auto 18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.who{color:#b9afff;font-weight:700}.composer{width:min(850px,calc(100% - 24px));margin:0 auto 12px;background:#1a2130;border:1px solid #39445a;border-radius:14px;padding:10px}.composer textarea{width:100%;background:transparent;color:white;border:0;outline:0;resize:vertical;padding:8px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.row button{padding:8px 11px;border-radius:8px;border:1px solid #30394c;background:#151b27;color:#ddd}.catalog{position:fixed;inset:5%;background:#171e2b;border:1px solid #39445a;border-radius:16px;padding:18px;overflow:auto}.api{padding:12px;border:1px solid #39445a;border-radius:10px;margin:8px 0}.muted{color:#9ca8bb;font-size:12px}@media(max-width:700px){.side{width:150px;padding:9px}.messages{padding:16px 10px}.catalog{inset:2%}.top{padding:12px}}
</style></head><body>
<section id="auth" class="auth"><div class="card"><h1>✦ Nova AI</h1><p class="muted">A tua conta e o teu histórico privado.</p><div class="social-grid"><button class="social google" data-oauth="google">G&nbsp; Continuar com Google</button><button class="social" data-oauth="discord">Discord</button><button class="social" data-oauth="github">GitHub</button><button class="social" data-oauth="apple">Apple</button></div><div class="auth-divider"><span>ou entra com email</span></div><form id="authForm"><input id="email" type="email" placeholder="Email" required><input id="password" type="password" minlength="8" placeholder="Palavra-passe (mín. 8)" required><button id="authSubmit" class="primary">Entrar</button></form><p id="authMsg" class="muted"></p><button id="toggle" style="background:none;border:0;color:#b9afff">Criar conta nova</button></div></section>
<div id="app" class="app hidden"><aside class="side"><h2>✦ Nova AI</h2><button id="new">＋ Nova conversa</button><button id="showCatalog">▦ Catálogo de APIs</button><b class="muted">HISTÓRICO</b><div id="history" class="hist"></div><button id="logout">Terminar sessão</button></aside><main class="main"><div class="top row"><b id="heading">Nova conversa</b><select id="providerSelect" aria-label="Fornecedor"></select><input id="modelSearch" class="model-search" placeholder="Filtrar modelos"><select id="modelSelect" aria-label="Modelo"><option>Carregar modelos</option></select><span class="muted" id="status">Online</span></div><div id="messages" class="messages"><div class="msg"><h2>O que vamos criar hoje?</h2><p class="muted">Sites · Programação · Documentos · Ideias</p></div></div><div class="composer"><div class="row mode"><button data-mode="chat">Conversar</button><button data-mode="code">Programar</button><button data-mode="writing">Escrever</button></div><textarea id="prompt" rows="3" placeholder="Escreve a tua mensagem..."></textarea><div class="row"><span class="muted" style="flex:1">A IA pode cometer erros.</span><button id="send" class="primary" style="width:auto">Enviar ↑</button></div></div></main></div>
<div id="catalog" class="catalog hidden"><div class="row"><h2 style="flex:1">Catálogo de APIs</h2><button id="closeCatalog">Fechar ×</button></div><p class="muted" id="catalogCount">A carregar...</p><input id="searchApi" placeholder="Pesquisar APIs..." style="width:100%;padding:12px;background:#101620;color:white;border:1px solid #39445a;border-radius:9px"><div id="apiList"></div><button id="more">Carregar mais</button><p class="muted">Fonte: public-apis/public-apis. Algumas APIs exigem chave ou pagamento; o catálogo não fornece acesso universal.</p></div>
<script>
const URL="__SUPABASE_URL__",KEY="__SUPABASE_KEY__",ready=URL.startsWith("https://")&&KEY&&!URL.includes("__SUPABASE");
const db=ready?supabase.createClient(URL,KEY):null;let user=null,conversation=null,messages=[],mode="chat",signup=false,offset=0,modelList=[];
const $=s=>document.querySelector(s),auth=$("#auth"),app=$("#app");
function note(t){$("#authMsg").textContent=t}
function add(role,text){let d=document.createElement("div");d.className="msg";let b=document.createElement("b");b.className="who";b.textContent=role==="user"?"Tu":"Nova AI";let p=document.createElement("div");p.textContent=text;d.append(b,p);$("#messages").append(d);$("#messages").scrollTop=$("#messages").scrollHeight;return p}
async function enter(u){user=u;auth.classList.add("hidden");app.classList.remove("hidden");await loadProviders();await loadHistory()}
async function loadHistory(){let {data,error}=await db.from("conversations").select("id,title,updated_at,provider,model").order("updated_at",{ascending:false}).limit(50);let box=$("#history");box.replaceChildren();if(error){box.textContent="Erro ao carregar histórico";return}for(let c of data||[]){let b=document.createElement("button");b.textContent=c.title;b.onclick=()=>openConversation(c);box.append(b)}}
async function openConversation(c){let {data,error}=await db.from("messages").select("role,content").eq("conversation_id",c.id).order("created_at");if(error)return alert("Não foi possível abrir.");conversation=c.id;messages=data||[];$("#messages").replaceChildren();messages.forEach(m=>add(m.role,m.content));if(c.provider){$("#providerSelect").value=c.provider;await loadModels();if(c.model)$("#modelSelect").value=c.model}}
$("#toggle").onclick=()=>{signup=!signup;$("#authSubmit").textContent=signup?"Criar conta":"Entrar";$("#toggle").textContent=signup?"Já tenho conta":"Criar conta nova";note("")};
async function socialLogin(provider){if(!db)return note("A autenticação ainda não foi configurada.");note("A abrir o acesso "+provider+"...");const {error}=await db.auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin}});if(error)note("Não foi possível iniciar: "+error.message)}
document.querySelectorAll("[data-oauth]").forEach(b=>b.addEventListener("click",()=>socialLogin(b.dataset.oauth)));
$("#authForm").onsubmit=async e=>{e.preventDefault();if(!db)return note("A autenticação ainda não foi configurada pelo administrador.");let email=$("#email").value,password=$("#password").value;let r=signup?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});if(r.error)return note(r.error.message);if(r.data.session)enter(r.data.user);else note("Confirma o email e depois entra.")};
$("#logout").onclick=async()=>{await db.auth.signOut();location.reload()};
$("#new").onclick=()=>{conversation=null;messages=[];$("#messages").innerHTML='<div class="msg"><h2>O que vamos criar hoje?</h2></div>';$("#heading").textContent="Nova conversa"};
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll("[data-mode]").forEach(x=>x.style.borderColor=x===b?"#8b7cff":"#30394c")});
async function save(role,content){let {data:session}=await db.auth.getSession();if(!conversation){let r=await db.from("conversations").insert({user_id:user.id,title:content.slice(0,55),provider:$("#providerSelect").value,model:$("#modelSelect").value}).select("id").single();if(r.error)throw r.error;conversation=r.data.id}let r=await db.from("messages").insert({conversation_id:conversation,user_id:user.id,role,content});if(r.error)throw r.error;await db.from("conversations").update({updated_at:new Date().toISOString(),provider:$("#providerSelect").value,model:$("#modelSelect").value}).eq("id",conversation);await loadHistory()}
async function send(){let text=$("#prompt").value.trim();if(!text)return;$("#prompt").value="";add("user",text);messages.push({role:"user",content:text});$("#send").disabled=true;try{await save("user",text);let {data:s}=await db.auth.getSession();let r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+s.session.access_token},body:JSON.stringify({messages,mode,provider:$("#providerSelect").value,model:$("#modelSelect").value})});let j=await r.json();if(!r.ok)throw Error(j.detail||"Erro na IA");add("assistant",j.reply);messages.push({role:"assistant",content:j.reply});await save("assistant",j.reply)}catch(e){add("assistant","Erro: "+e.message)}finally{$("#send").disabled=false}}
$("#send").onclick=send;$("#prompt").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
async function loadProviders(){let {data:s}=await db.auth.getSession();let r=await fetch("/api/providers",{headers:{Authorization:"Bearer "+s.session.access_token}});let j=await r.json();let sel=$("#providerSelect");sel.replaceChildren();for(let p of (j.providers||[])){let o=document.createElement("option");o.value=p.id;o.textContent=p.label+(p.configured?"":" · por configurar");sel.append(o)}let preferred=(j.providers||[]).find(p=>p.id==="freellmapi"&&p.configured)||(j.providers||[]).find(p=>p.configured);if(preferred)sel.value=preferred.id;await loadModels()}
async function loadModels(){let provider=$("#providerSelect").value;let sel=$("#modelSelect");sel.replaceChildren();$("#status").textContent="A obter modelos...";let {data:s}=await db.auth.getSession();let q=$("#modelSearch").value.trim();let r=await fetch("/api/models?provider="+encodeURIComponent(provider)+"&q="+encodeURIComponent(q),{headers:{Authorization:"Bearer "+s.session.access_token}});let j=await r.json();if(!r.ok){let o=document.createElement("option");o.textContent=j.detail||"Fornecedor por configurar";sel.append(o);$("#status").textContent="Chave necessária";return}modelList=j.items||[];for(let m of modelList){let o=document.createElement("option");o.value=m.id;o.textContent=m.name+(m.free?" · grátis":"");sel.append(o)}$("#status").textContent=modelList.length+" modelos"+(provider==="freellmapi"?" · grátis; evita dados pessoais (alguns fornecedores registam pedidos)":provider==="kilo"?" · grátis; evita dados pessoais":"");if(!modelList.length){let o=document.createElement("option");o.textContent="Nenhum modelo encontrado";sel.append(o)}}
$("#providerSelect").onchange=()=>loadModels();$("#modelSearch").oninput=()=>loadModels();
async function loadCatalog(){let {data:s}=await db.auth.getSession();let q=$("#searchApi").value;let r=await fetch("/api/catalog?q="+encodeURIComponent(q)+"&offset="+offset,{headers:{Authorization:"Bearer "+s.session.access_token}});let j=await r.json();if(!r.ok){$("#apiList").textContent=j.detail;return}$("#catalogCount").textContent=j.total+" APIs encontradas";for(let a of j.items){let d=document.createElement("div");d.className="api";let link=document.createElement("a");link.href=a.url;link.target="_blank";link.rel="noopener";link.textContent=a.name;let p=document.createElement("p");p.textContent=a.description+" · Categoria: "+a.category+" · Auth: "+a.auth;d.append(link,p);$("#apiList").append(d)}}
$("#showCatalog").onclick=()=>{$("#catalog").classList.remove("hidden");offset=0;$("#apiList").replaceChildren();loadCatalog()};$("#closeCatalog").onclick=()=>$("#catalog").classList.add("hidden");$("#searchApi").oninput=()=>{offset=0;$("#apiList").replaceChildren();loadCatalog()};$("#more").onclick=()=>{offset+=50;loadCatalog()};
(async()=>{if(!ready){note("O administrador ainda precisa configurar o Supabase.");return}let {data}=await db.auth.getSession();if(data.session)enter(data.session.user)})();
</script></body></html>"""
