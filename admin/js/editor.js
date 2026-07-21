/* Chaskis — admin/js/editor.js : logique de l'editeur admin (ex-inline de editor.html) */
"use strict";

/* ============================================================
   Config
   ============================================================ */
const PAGE = "index";
const STORE_KEY = "chaskis_editor_draft_" + PAGE;
const VERS_KEY  = "chaskis_versions_" + PAGE;
const UI_KEY    = "chaskis_admin_ui";
/* Version du back-office (incrémentée au fil des itérations) + environnement (dev / prod). */
const ADMIN_BUILD = { version: "0.57.1" };

const SECTION_DEFS = [
  { id:"hero", sel:"header.hero", name:"En-tête (accueil)" },
  { id:"partners", sel:".partners", name:"Bandeau confiance" },
  { id:"diff", sel:".diff-sec", name:"Pourquoi Chaskis" },
  { id:"services", sel:".feat-sec", name:"Ce que ça change" },
  { id:"testi", sel:".testi", name:"Témoignages" },
  { id:"sim", sel:".sim-dark", name:"Simulateur d'économies" },
  { id:"offres", sel:".offres", name:"Nos offres" },
  { id:"booking", sel:".cta-booking", name:"Réserver un appel" },
  { id:"faq", sel:".faq", name:"FAQ" }
];
/* rôle stratégique de chaque section (phase du parcours + section clé + apport), pour éduquer dans l'éditeur.
   special = section "structurée" (pas juste texte/image), à gérer autrement. */
const SEC_META={
  hero:{phase:"capter", key:true, apport:"dire en 3 secondes ce que vous faites et pour qui"},
  partners:{phase:"rassurer", apport:"montrer que des entreprises vous font déjà confiance", special:"logos"},
  diff:{phase:"convaincre", apport:"dire pourquoi vous plutôt qu'un autre"},
  services:{phase:"convaincre", apport:"rendre votre offre concrète et tangible"},
  testi:{phase:"rassurer", apport:"installer la confiance par la preuve", special:"avis"},
  sim:{phase:"chiffrer", key:true, apport:"faire prendre conscience du coût actuel des livraisons", special:"simulateur"},
  offres:{phase:"convertir", key:true, apport:"montrer clairement vos prix, sans quoi le visiteur n'ose pas demander"},
  booking:{phase:"convertir", key:true, apport:"transformer l'intérêt en demande de rendez-vous"},
  faq:{phase:"rassurer", apport:"lever les derniers doutes avant le contact"}
};
const SEC_SPECIAL={ logos:"Ces logos sont des SVG calibrés pour le design. En ajouter demande un fichier SVG à la bonne taille et couleur : à gérer avec Gamma Project pour rester nickel.", avis:"Un vrai avis, c'est une photo, une note, un nom, une date. Ça se gère dans un espace dédié (à venir), pas en tapant dans le texte.", simulateur:"Le simulateur calcule des prix : changer sa logique ou vos tarifs se fait dans le projet, pas en direct ici. Le texte autour reste modifiable." };
function phaseInfo(key){ return STRUCT_PHASES.find(p=>p.key===key)||STRUCT_PHASES[0]; }
/* Édition multi-pages : on peut charger n'importe quelle page dans l'éditeur.
   Textes et images sont éditables partout ; la gestion des sections (masquer/réordonner
   + repères stratégiques) est complète sur l'Accueil. */
const EDIT_PAGES=[
  {key:"accueil", file:"index.html", label:"Accueil"},
  {key:"mobilite", file:"mobilite.html", label:"Mobilité"},
  {key:"recrutement", file:"postuler.html", label:"Recrutement"},
  {key:"commander", file:"commander.html", label:"Commander"},
  {key:"suivi", file:"app.html", label:"Suivi de commande"},
  {key:"dashboard", file:"dashboard.html", label:"Tableau de bord"}
];
let editPage="accueil", previewOn=false;
function currentEditPage(){ return EDIT_PAGES.find(x=>x.key===editPage)||EDIT_PAGES[0]; }
function currentPageFile(){ return "../"+currentEditPage().file; }
function switchEditPage(key){
  const p=EDIT_PAGES.find(x=>x.key===key); if(!p||key===editPage) return;
  editPage=key; previewOn=false;
  const l=document.getElementById("loader"); if(l) l.style.display="";
  if(typeof iframe!=="undefined" && iframe){ iframe.src="../"+p.file; }
}
function togglePreview(force){
  previewOn=(force!=null)?!!force:!previewOn;
  if(DOC){ DOC.documentElement.classList.toggle("ck-preview", previewOn);
    DOC.querySelectorAll("[data-ckedit]").forEach(el=> el.setAttribute("contenteditable", previewOn?"false":"true")); }
  const b=document.getElementById("previewBtn"); if(b){ b.classList.toggle("on", previewOn);
    const t=b.querySelector(".pv-txt"); if(t) t.textContent=previewOn?"Quitter l'aperçu":"Prévisualiser"; }
}
function openOnline(){ try{ window.open(currentPageFile(), "_blank"); }catch(e){} }
const PROMO_PARTS = [
  { key:"promo.badge", sel:".promo-bar-badge" },
  { key:"promo.text", sel:".promo-bar-text" },
  { key:"promo.cta", sel:".promo-bar-cta" }
];
const BG_DEFS = [{ key:"faq.banner", sel:".faq-banner-img", name:"Photo FAQ" }];
const MONTHS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const MONTHS_FULL = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MEDIA = { imgTypes:["image/webp","image/png","image/jpeg","image/svg+xml"], imgMax:2*1024*1024,
                vidTypes:["video/mp4","video/webm"], vidMax:50*1024*1024 };
const WEEKDAYS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

/* ============================================================
   Draft + versions state
   ============================================================ */
/* keyPage : pour chaque clé de texte éditée, la page où elle a été modifiée ("accueil"…)
   ou "shared" si la clé appartient au chrome commun (nav/footer = window.T_BASE, appliqué
   à toutes les pages). Sert à buildSiteContent() pour publier des blocs i18n PAR PAGE au
   lieu de recopier le même dictionnaire dans les 6 pages. Absent des vieux brouillons →
   repli non-cassant (toutes les clés → toutes les pages, comportement historique). */
function blankDraft(){ return { text:{fr:{},en:{}}, html:{fr:{},en:{}}, dom:{}, order:null, hidden:[], promoHidden:false, images:{}, bgImages:{}, media:[], lists:{}, keyPage:{}, imgPub:{} }; }
/* historique d'exemple (démo) : montre plusieurs versions avec leurs points clés tant qu'on n'a pas publié pour de vrai */
const SEED_VERSIONS=[
  { id:"v4", date:"2026-07-02T09:05:00", author:"Alex Moreira", changes:["Bandeau promo « -15 % sur Flex & Dédié » activé","Grille tarifaire mise à jour (Flex à 12 CHF / livraison)","FAQ enrichie : 2 nouvelles questions"], snapshot:{} },
  { id:"v3", date:"2026-06-27T16:40:00", author:"Léa Fontaine", changes:["Titre d'accueil reformulé","Photo de couverture remplacée","Section « Ce que ça change » : 1 élément ajouté"], snapshot:{} },
  { id:"v2", date:"2026-06-20T11:15:00", author:"Alex Moreira", changes:["Témoignages : 2 avis clients ajoutés","Logos de confiance : Proton ajouté"], snapshot:{} },
  { id:"v1", date:"2026-06-12T10:00:00", author:"Alex Moreira", changes:["Première mise en ligne du site"], snapshot:{} }
];
let draft = loadDraft();
let versions = loadVersions();
let currentLang = "fr";
let _verPreview = null;
let verQuery = "", verPinnedOnly = false;
let _onlineVer = null, _onlineVerLoaded = false, _onlineVerErr = null;

function loadDraft(){ try{ const r=JSON.parse(localStorage.getItem(STORE_KEY)); if(r) return Object.assign(blankDraft(), r); }catch(e){} return blankDraft(); }
function loadVersions(){ try{ const r=JSON.parse(localStorage.getItem(VERS_KEY)); if(Array.isArray(r)&&r.length) return r; }catch(e){} return JSON.parse(JSON.stringify(SEED_VERSIONS)); }
function saveVersions(){ try{ localStorage.setItem(VERS_KEY, JSON.stringify(versions)); }catch(e){ toast("Stockage plein, supprimez d'anciennes versions."); } }

let saveTimer=null;
function save(immediate){
  if(_verPreview) return; /* en aperçu d'une version : lecture seule, on ne persiste rien */
  clearTimeout(saveTimer);
  const doSave=()=>{ try{ localStorage.setItem(STORE_KEY, JSON.stringify(draft)); setSaved(); }
    catch(e){ toast("Brouillon trop lourd (trop d'images). Supprimez des imports dans la médiathèque."); } };
  if(immediate) doSave(); else saveTimer=setTimeout(doSave, 500);
}
function markDirty(){ const s=document.getElementById("saveState"); s.classList.add("dirty"); document.getElementById("saveLabel").textContent="Enregistrement…"; save(); updateDashboard(); }
function setSaved(){ const s=document.getElementById("saveState"); s.classList.remove("dirty"); document.getElementById("saveLabel").textContent="Enregistré à "+fmtTime(new Date()); }

/* ============================================================
   Iframe boot
   ============================================================ */
const iframe = document.getElementById("site");
const loader = document.getElementById("loader");
let DOC=null, WIN=null;

iframe.addEventListener("load", ()=>{
  try{
    DOC = iframe.contentDocument; WIN = iframe.contentWindow;
    if(!DOC) throw new Error("no doc");
    setTimeout(initEditMode, 60);
  }catch(err){
    loader.innerHTML = "Impossible d'ouvrir la page en édition.<br>Lancez le serveur (lancer-editeur.bat) puis ouvrez <b>/admin</b>.";
  }
});
let iframeLoaded=false;
function ensureEditor(){ if(!iframeLoaded){ iframeLoaded=true; iframe.src=currentPageFile(); } }

/* seed the media library from the static HTML (no heavy site load needed) */
async function seedMediaStatic(){
  try{
    const res=await fetch("../index.html",{cache:"no-store"}); const txt=await res.text();
    const re=/(assets\/(?:img|icons)\/[A-Za-z0-9._@\/-]+\.(?:webp|png|jpe?g|svg))/gi;
    const found=new Set(); let m; while((m=re.exec(txt))) found.add(m[1]);
    const seenName=new Set(draft.media.map(x=>x.name));
    found.forEach(rel=>{ const name=baseName(rel); if(seenName.has(name)) return; seenName.add(name);
      draft.media.push({ src:new URL(rel, location.origin+"/").href, name, origin:"site" }); });
    save();
  }catch(e){}
}

/* ============================================================
   Edit mode injection
   ============================================================ */
const EDIT_CSS = `
  #pageCurtain{display:none!important}
  *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition:none!important}
  html{scroll-behavior:auto!important}
  /* Comme sur le vrai site : nav et bandeau posés PAR-DESSUS le hero (absolute, pas fixed pour ne pas coller au scroll en édition). Le hero part de y=0, son dégradé passe bien derrière la nav, le bandeau reste visible, et le hero garde son padding-top natif (156px, 192px avec bandeau) pour dégager le contenu. */
  .promo-bar{position:absolute!important}
  .nav{position:absolute!important}
  .faq-item .faq-a{display:block!important;height:auto!important;max-height:none!important;overflow:visible!important;opacity:1!important}
  .hero h1 .word,.rv,.vpc,.pipe-step,.bento-card,.sec-card,.diff-card,.vpc.v{opacity:1!important;transform:none!important}
  [data-ckedit]{cursor:text;border-radius:3px;transition:none}
  [data-ckedit]:hover{outline:2px dashed rgba(107,91,204,.55);outline-offset:2px}
  [data-ckedit]:focus{outline:2px solid #6B5BCC!important;background:rgba(107,91,204,.07);box-shadow:0 0 0 4px rgba(107,91,204,.1)}
  [data-ckimg]{cursor:pointer;transition:filter .15s}
  [data-ckimg]:hover{filter:brightness(.78)}
  [data-ckbg]{cursor:pointer;transition:filter .15s}
  [data-ckbg]:hover{filter:brightness(.82)}
  .ck-img-tag{position:absolute;background:#6B5BCC;color:#fff;font:600 11px/1 'Urbanist',sans-serif;padding:5px 8px;border-radius:6px;display:flex;gap:5px;align-items:center;pointer-events:none;z-index:9998;transform:translate(-50%,-50%)}
  .ck-sec{position:relative}
  .ck-sec-tb{position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:9997;opacity:0;transition:opacity .12s;pointer-events:none}
  .ck-sec:hover > .ck-sec-tb{opacity:1;pointer-events:auto}
  .ck-sec-tb button{all:unset;width:30px;height:30px;border-radius:8px;background:#fff;border:1px solid #e0dcd2;box-shadow:0 2px 8px rgba(40,32,60,.16);display:flex;align-items:center;justify-content:center;color:#2C2052;cursor:pointer}
  .ck-sec-tb button:hover{background:#6B5BCC;border-color:#6B5BCC;color:#fff}
  .ck-sec-tb button svg{width:16px;height:16px}
  .ck-sec-hl{outline:2px dashed rgba(75,179,164,.7)!important;outline-offset:-2px}
  .ck-hidden{position:relative;filter:grayscale(1) opacity(.45)}
  .ck-hidden > *{pointer-events:none!important}
  .ck-hidden-ov{all:unset;box-sizing:border-box;position:absolute;inset:0;z-index:9996;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto!important}
  .ck-hidden-ov > span{display:inline-flex;align-items:center;gap:7px;background:#2C2052;color:#fff;font:700 12px/1.2 'Urbanist',sans-serif;padding:10px 15px;border-radius:9px;box-shadow:0 4px 16px rgba(0,0,0,.28)}
  .ck-hidden-ov:hover > span{background:#6B5BCC}
  .ck-preview .ck-sec-tb,.ck-preview .ck-hidden-ov,.ck-preview .ck-img-tag{display:none!important}
  .ck-preview .ck-hidden{display:none!important}
  .ck-preview [data-ckedit]{outline:none!important;background:none!important;box-shadow:none!important;cursor:auto!important}
  .ck-preview [data-ckimg]:hover,.ck-preview [data-ckbg]:hover{filter:none!important}
  .ck-li{position:relative}
  .ck-li-x{all:unset;box-sizing:border-box;position:absolute;top:2px;right:-8px;width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #e0dcd2;box-shadow:0 2px 6px rgba(40,32,60,.18);display:none;align-items:center;justify-content:center;color:#B23B3B;cursor:pointer;z-index:9995}
  .ck-li:hover > .ck-li-x{display:flex}
  .ck-li-x svg{width:11px;height:11px}
  /* fond OPAQUE : reste lisible aussi sur les sections sombres (evite le "bleu sur bleu") */
  .ck-list-add{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;margin-top:10px;font:600 12px/1 'Urbanist',sans-serif;color:#5A46C0;cursor:pointer;padding:7px 13px;border:1px solid #d3cbf2;border-radius:8px;background:#F3F1FC;box-shadow:0 1px 3px rgba(20,16,38,.12)}
  .ck-list-add:hover{background:#EAE6FA;border-color:#c3b8ee}
  .ck-list-add span{font-size:15px;line-height:1}
  .ck-preview .ck-li-x,.ck-preview .ck-list-add{display:none!important}
`;

/* affichage du bandeau : on pilote la classe native du site (has-promo) plutot que des display inline.
   has-promo ajuste aussi le haut de page cote site ; en edition, tout est en flux statique donc pas de vide. */
function setPromoVisible(on){ if(!DOC||!DOC.body) return; DOC.body.classList.toggle("has-promo", !!on);
  const pb=DOC.getElementById("promoBar"); if(pb) pb.style.display=""; }
function initEditMode(){
  if(!DOC) return;
  if(!DOC.getElementById("ck-edit-style")){
    const st=DOC.createElement("style"); st.id="ck-edit-style"; st.textContent=EDIT_CSS; DOC.head.appendChild(st);
  }
  const pb=DOC.getElementById("promoBar"); if(pb){ pb.style.display=""; pb.classList.remove("is-hidden","hidden"); }
  setPromoVisible(!draft.promoHidden);
  killNavigation();
  markTexts(); markPromo(); markImages(); markBg(); markLists(); seedMedia(); renderContentHealth();
  setupSections(); applyDraft(); decorateAllLists(); renderSecList(); refreshSecToolbars();
  togglePreview(false);
  loader.style.display="none";
  updateDashboard();
}

function killNavigation(){
  DOC.addEventListener("click",(e)=>{
    const a=e.target.closest("a"); if(a) e.preventDefault();
    const cb=e.target.closest(".promo-bar-close"); if(cb){ e.preventDefault(); e.stopPropagation(); }
  }, true);
  DOC.addEventListener("submit",(e)=>e.preventDefault(), true);
}

/* ---- text editing ---- */
function attachEditable(el, kind, key){
  el.setAttribute("data-ckedit", kind); el.setAttribute("data-ckkey", key);
  el.setAttribute("contenteditable","true"); el.setAttribute("spellcheck","false");
  el.addEventListener("mousedown",(e)=>e.stopPropagation());
  el.addEventListener("click",(e)=>e.stopPropagation());
  el.addEventListener("focus",()=>{ el.__ck_prev=el.textContent; });
  el.addEventListener("blur",()=>{ contentFeedback(el, kind); });
  el.addEventListener("input",()=>{
    if(el.hasAttribute("data-cklistedit")) return; /* point de liste : géré par draft.lists */
    if(kind==="html") setVal(draft.html,key,el.innerHTML); else setVal(draft.text,key,el.textContent);
    recordEditPageForKey(key); syncSiblings(el,kind,key); markDirty(); contentHealthDebounced();
  });
}
function setVal(bag,key,v){ (bag[currentLang]||(bag[currentLang]={}))[key]=v; }
/* Note où une clé i18n a été éditée : "shared" si elle vit dans window.T_BASE (nav/footer,
   commun à tout le site → à publier sur toutes les pages), sinon la page courante. Une clé
   éditée sur deux pages différentes devient "shared" (jamais perdre une modif). */
function isSharedKey(key){
  try{ if(WIN&&WIN.T_BASE){ return ["fr","en","de","it"].some(function(lg){ return WIN.T_BASE[lg] && Object.prototype.hasOwnProperty.call(WIN.T_BASE[lg], key); }); } }catch(e){}
  return false;
}
function recordEditPageForKey(key){
  if(!draft.keyPage) draft.keyPage={};
  if(isSharedKey(key)){ draft.keyPage[key]="shared"; return; }
  var cur=draft.keyPage[key];
  if(cur===undefined) draft.keyPage[key]=editPage;
  else if(cur!=="shared" && cur!==editPage) draft.keyPage[key]="shared";
}
function syncSiblings(src,kind,key){
  const sel = kind==="html" ? '[data-i18n-html="'+cssEsc(key)+'"]' : '[data-i18n="'+cssEsc(key)+'"]';
  DOC.querySelectorAll(sel).forEach(o=>{ if(o===src) return; if(kind==="html") o.innerHTML=src.innerHTML; else o.textContent=src.textContent; });
}
function cssEsc(s){ return s.replace(/"/g,'\\"'); }
function markTexts(){
  DOC.querySelectorAll("[data-i18n-html]").forEach(el=> attachEditable(el,"html",el.getAttribute("data-i18n-html")));
  DOC.querySelectorAll("[data-i18n]").forEach(el=>{ if(el.hasAttribute("data-ckedit")) return; attachEditable(el,"text",el.getAttribute("data-i18n")); });
}
function markPromo(){
  PROMO_PARTS.forEach(p=>{
    const el=DOC.querySelector(p.sel); if(!el) return;
    el.setAttribute("data-ckedit","dom"); el.setAttribute("data-ckkey",p.key);
    el.setAttribute("contenteditable","true"); el.setAttribute("spellcheck","false");
    el.addEventListener("mousedown",(e)=>e.stopPropagation());
    el.addEventListener("click",(e)=>e.stopPropagation());
    el.addEventListener("input",()=>{ draft.dom[p.key]=el.innerHTML; markDirty(); });
  });
}

/* ---- santé du contenu en direct : guider l'éditeur, de façon équilibrée (bon / attention / neutre) ---- */
function contentHealthScore(){
  if(!DOC) return {score:100,status:"good"};
  const els=DOC.querySelectorAll("[data-i18n],[data-i18n-html]");
  let words=0, empties=0;
  els.forEach(el=>{ const t=(el.textContent||"").trim(); if(!t) empties++; else words+=t.split(/\s+/).length; });
  const h1=DOC.querySelector(".hero h1"), h1len=h1?(h1.textContent||"").trim().length:1;
  let s=100;
  if(h1len===0) s-=28; else if(h1len<15) s-=14;
  if(words<220) s-=Math.min(24, Math.round((220-words)/9));
  s-=Math.min(20, empties*2);
  s=Math.max(45, Math.min(100, s));
  return {score:s, status: s>=85?"good":s>=65?"warn":"bad"};
}
let chTimer=null; function contentHealthDebounced(){ if(chTimer) clearTimeout(chTimer); chTimer=setTimeout(renderContentHealth,200); }
function renderContentHealth(){ const el=document.getElementById("contentHealth"); if(!el) return;
  const r=contentHealthScore(), c=pfStat(r.status);
  el.style.color=c.c; el.style.background=c.bg;
  el.innerHTML='<span class="ch-dot" style="background:'+c.c+'"></span>Qualité du contenu <b>'+r.score+'</b><span class="ch-100">/100</span>';
}
const CONTENT_SEC=[
  {sel:".hero", name:"l'accroche", apport:"dire en 3 secondes ce que vous faites et pour qui"},
  {sel:".sim-dark", name:"le simulateur", apport:"faire prendre conscience au visiteur de ce que lui coûtent ses livraisons"},
  {sel:".offres", name:"les offres et les prix", apport:"montrer clairement vos tarifs, sans quoi le visiteur n'ose pas demander"},
  {sel:".cta-booking", name:"la prise de rendez-vous", apport:"transformer l'intérêt en demande de contact"},
  {sel:".testi", name:"les témoignages", apport:"installer la confiance par la preuve"}
];
function contentSection(el){ if(!el||!el.closest) return null; for(const s of CONTENT_SEC){ if(el.closest(s.sel)) return s; } return null; }
function contentFeedback(el, kind){
  const prev=(el.__ck_prev==null?"":el.__ck_prev).trim(), now=(el.textContent||"").trim();
  if(prev===now) return;
  const isHeading=/^H[1-6]$/.test(el.tagName), pl=prev.length, nl=now.length, sec=contentSection(el);
  let type, msg;
  if(nl===0 && pl>0){ type="bad"; msg=isHeading?"Vous avez vidé un titre. Le visiteur ne saura plus de quoi parle cette partie, et Google non plus.":"Vous avez vidé un texte. Google a besoin de mots pour comprendre et bien classer la page."; }
  else if(isHeading && nl>0 && nl<15 && nl<pl*0.6){ type="warn"; msg="Ce titre est devenu très court. Un titre clair et parlant retient mieux le visiteur, et aide au référencement."; }
  else if(isHeading && pl===0 && nl>=15){ type="good"; msg="Bien : un titre clair, c'est la première chose que lisent vos visiteurs et Google."; }
  else if(!isHeading && pl>60 && nl<pl*0.5){ type="warn"; msg="Cette partie a beaucoup moins de texte qu'avant. Gardez assez de contenu pour rester bien référencé."; }
  else if(!isHeading && nl>60 && nl>pl*1.4){ type="good"; msg="Bien : plus de contenu utile, c'est bon pour le référencement, tant que ça reste vrai et clair."; }
  else { renderContentHealth(); return; } /* reformulation de longueur voisine : on met à jour le score sans message, pour ne pas être répétitif ni juger le fond */
  if((type==="bad"||type==="warn") && sec) msg+=" Rappel : cette section sert à "+sec.apport+".";
  showContentGuide(type, msg); renderContentHealth();
}
let cgTimer=null;
function showContentGuide(type, msg){ const w=document.getElementById("contentGuide"); if(!w) return;
  if(!w.hidden && w.dataset.last===type+"|"+msg) return; /* évite de répéter le même message */
  w.dataset.last=type+"|"+msg;
  const ic=type==="good"?"check-circle-2":type==="neutral"?"info":"alert-triangle";
  w.className="content-guide cg-"+type; w.hidden=false;
  w.innerHTML='<span class="cg-ic"><i data-lucide="'+ic+'"></i></span><span class="cg-msg">'+msg+'</span><button type="button" class="cg-x" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
  w.querySelector(".cg-x").addEventListener("click",()=>{ w.hidden=true; });
  refreshIcons();
  if(cgTimer) clearTimeout(cgTimer); cgTimer=setTimeout(()=>{ if(w) w.hidden=true; }, 9000);
}

/* ---- media ---- */
let mediaTarget=null;
const mediaInput=makeMediaInput();
function markImages(){
  let n=0;
  SECTION_DEFS.forEach(def=>{
    const root=DOC.querySelector(def.sel); if(!root) return;
    root.querySelectorAll("img").forEach(img=>{
      if(img.closest("nav")) return;
      img.setAttribute("data-ckimg","img"+(n++));
      /* src d'ORIGINE (authored) = clé stable pour publier le remplacement vers le site public.
         content.js pose data-ck-orig-src quand il applique un remplacement HORS éditeur ; ici (dans
         l'iframe) content.js n'applique PAS les images, donc getAttribute("src") EST l'original. */
      var _orig=img.getAttribute("data-ck-orig-src")||img.getAttribute("src")||"";
      if(_orig) img.setAttribute("data-ckimg-orig",_orig);
      img.addEventListener("mouseenter",()=>showRepTag(img));
      img.addEventListener("mouseleave",hideRepTag);
      img.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openMedia(img,"img"); });
    });
  });
}
function markBg(){
  BG_DEFS.forEach(b=>{
    const el=DOC.querySelector(b.sel); if(!el) return;
    el.setAttribute("data-ckbg",b.key);
    el.addEventListener("mouseenter",()=>showRepTag(el));
    el.addEventListener("mouseleave",hideRepTag);
    el.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openMedia(el,"bg",b.key); });
  });
}
let repTagEl=null;
function showRepTag(el){
  hideRepTag();
  const r=el.getBoundingClientRect();
  repTagEl=DOC.createElement("div"); repTagEl.className="ck-img-tag";
  repTagEl.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0 4 4m-4-4L8 8"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>Remplacer';
  repTagEl.style.left=(r.left+r.width/2)+"px"; repTagEl.style.top=(r.top+r.height/2)+"px";
  DOC.body.appendChild(repTagEl);
}
function hideRepTag(){ if(repTagEl){ repTagEl.remove(); repTagEl=null; } }
function bgUrl(el){ const m=getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/); return m?m[1]:null; }
function baseName(s){ try{ return decodeURIComponent((s||"").split("/").pop().split("?")[0]); }catch(e){ return s; } }
function seedMedia(){
  const seenSrc=new Set(draft.media.map(m=>m.src)), seenName=new Set(draft.media.map(m=>m.name));
  const add=(src)=>{ if(!src) return; const name=baseName(src);
    if(seenSrc.has(src)||seenName.has(name)) return;
    seenSrc.add(src); seenName.add(name); draft.media.push({src,name,origin:"site"}); };
  DOC.querySelectorAll("[data-ckimg]").forEach(img=> add(img.src));
  BG_DEFS.forEach(b=>{ const el=DOC.querySelector(b.sel); if(el) add(bgUrl(el)); });
  save();
}
function openMedia(el,kind,key){ mediaTarget={el,kind,key,page:editPage}; renderMediaInto(document.getElementById("mediaGrid"),true); document.getElementById("mediaModalBg").classList.add("show"); } /* page capturée ici : un import async + changement de page ne classera pas le remplacement sous la mauvaise page */
function currentSrc(){ if(!mediaTarget) return null; return mediaTarget.kind==="img" ? mediaTarget.el.getAttribute("src") : bgUrl(mediaTarget.el); }
function applyMedia(src){
  if(mediaTarget.kind==="img"){
    var orig=mediaTarget.el.getAttribute("data-ckimg-orig");
    mediaTarget.el.src=src; draft.images[mediaTarget.el.getAttribute("data-ckimg")]=src;
    /* Cohérence aperçu/publié : la publication remplace par SRC D'ORIGINE -> on applique la même
       image à TOUTES les <img> de même origine dans l'aperçu (ex. logos répétés du bandeau),
       exactement comme content.js le fera en ligne. Sinon l'aperçu ne changerait qu'une occurrence. */
    if(orig && DOC){ DOC.querySelectorAll("[data-ckimg-orig]").forEach(function(im){ if(im!==mediaTarget.el && im.getAttribute("data-ckimg-orig")===orig){ im.src=src; var id=im.getAttribute("data-ckimg"); if(id) draft.images[id]=src; } }); }
    recordImgPub(orig, src, mediaTarget.page||editPage);
  }
  else { mediaTarget.el.style.backgroundImage='url("'+src+'")'; draft.bgImages[mediaTarget.key]=src; }
  markDirty();
}
/* Vrai si `url` désigne le MÊME fichier que le src d'origine (donc un retour à l'image par défaut) :
   soit identique, soit sa forme absolue (l'image « du site » que la médiathèque fournit en URL
   absolue de l'hôte courant). Empêche de publier l'URL de l'hôte d'édition (ex. preview) et rend
   le « revert » atteignable via l'UI. */
function sameImgAsset(orig, url){
  if(!url || url===orig) return true;
  try{ var u=String(url).split("?")[0]; if(u===orig || u.endsWith("/"+orig) || u.endsWith(orig)) return true; }catch(e){}
  return false;
}
/* Remplacement d'image à publier vers le site public : { <page> : { <src d'origine> : <URL> } }.
   On mémorise même un dataURL (état courant) ; buildSiteContent ne publie QUE les URL https ET
   externes (une image « du site » = même asset -> retrait de l'entrée, retour à l'image par défaut). */
function recordImgPub(orig, url, page){
  if(!orig) return;
  page=page||editPage;
  if(!draft.imgPub) draft.imgPub={};
  var pg=draft.imgPub[page]||(draft.imgPub[page]={});
  if(sameImgAsset(orig, url)){ delete pg[orig]; if(!Object.keys(pg).length) delete draft.imgPub[page]; }
  else pg[orig]=url;
}
function pickMedia(src){ if(!mediaTarget){ return; } applyMedia(src); document.getElementById("mediaModalBg").classList.remove("show"); toast("Image mise à jour"); }
function deleteMediaAt(i){ const m=draft.media[i]; if(m && !confirm("Supprimer « "+(m.name||"ce média")+" » de la médiathèque ? Action définitive.")) return; draft.media.splice(i,1); save(); renderAllMedia(); updateDashboard(); }
/* Optimisation d'image à l'import (chantier "media", étape « compresser/redimensionner ») :
   redimensionne au-delà de MEDIA_MAX_DIM et ré-encode en WebP (transparence préservée ;
   repli PNG si WebP non supporté). 100% navigateur, aucun service. done(result|null) :
   null => l'appelant garde l'original tel quel (repli sûr, aucune régression possible).
   Ignore le SVG (vectoriel) et ne garde l'optimisé que s'il est plus léger ou redimensionné. */
const MEDIA_MAX_DIM=1920, MEDIA_Q=0.82;
/* Détecte une image animée (WebP « ANIM » / APNG « acTL ») pour NE PAS l'aplatir en une seule frame. */
function mediaIsAnimated(buf, type){
  try{
    const marker = type==="image/webp" ? [0x41,0x4E,0x49,0x4D] : (type==="image/png" ? [0x61,0x63,0x54,0x4C] : null);
    if(!marker) return false;
    const b=new Uint8Array(buf), n=Math.min(b.length, 2*1024*1024); // les chunks d'animation sont en tête de fichier
    for(let i=0;i<n-3;i++){ if(b[i]===marker[0]&&b[i+1]===marker[1]&&b[i+2]===marker[2]&&b[i+3]===marker[3]) return true; }
  }catch(e){}
  return false;
}
function mediaOptimize(file, done){
  try{
    // Seules les images matricielles STATIQUES sont ré-encodées ; SVG (vectoriel), vidéos et images animées passent leur tour.
    if(!file || !/^image\//.test(file.type) || file.type==="image/svg+xml"){ done(null); return; }
    const rd=new FileReader();
    rd.onerror=()=>done(null);
    rd.onload=()=>{
      try{
        const buf=rd.result;
        if(mediaIsAnimated(buf, file.type)){ done(null); return; } // WebP/APNG animé : garder l'original (animation préservée)
        const url=URL.createObjectURL(new Blob([buf], {type:file.type}));
        const im=new Image();
        im.onerror=()=>{ try{ URL.revokeObjectURL(url); }catch(e){} done(null); };
        im.onload=()=>{
          try{
            const w0=im.naturalWidth, h0=im.naturalHeight; if(!w0||!h0){ URL.revokeObjectURL(url); done(null); return; }
            let w=w0, h=h0; const mx=Math.max(w0,h0);
            if(mx>MEDIA_MAX_DIM){ const k=MEDIA_MAX_DIM/mx; w=Math.round(w0*k); h=Math.round(h0*k); }
            const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
            const ctx=cv.getContext("2d"); if(!ctx){ URL.revokeObjectURL(url); done(null); return; }
            ctx.drawImage(im,0,0,w,h);
            let out=""; try{ out=cv.toDataURL("image/webp",MEDIA_Q); }catch(e){ out=""; }
            if(!out || out.indexOf("data:image/webp")!==0){ try{ out=cv.toDataURL("image/png"); }catch(e){ out=""; } }
            URL.revokeObjectURL(url);
            if(!out || out.indexOf("data:image/")!==0){ done(null); return; }
            const size=Math.round((out.length-out.indexOf(",")-1)*0.75);
            const type=out.slice(5, out.indexOf(";"));
            if(size>=file.size){ done(null); return; } // on ne garde l'optimisée QUE si elle est réellement plus légère (sinon repli sur l'original)
            done({ src:out, w:w, h:h, size:size, type:type });
          }catch(e){ try{ URL.revokeObjectURL(url); }catch(_){} done(null); }
        };
        im.src=url;
      }catch(e){ done(null); }
    };
    rd.readAsArrayBuffer(file);
  }catch(e){ done(null); }
}
function importMediaFile(file){
  if(!file) return;
  const isVid=file.type.startsWith("video/");
  const okType = isVid ? MEDIA.vidTypes.includes(file.type) : MEDIA.imgTypes.includes(file.type);
  if(!okType){ toast("Format non supporté (WebP, PNG, JPEG, SVG, MP4, WebM)"); return; }
  if(isVid && file.size > MEDIA.vidMax){ toast("Vidéo trop lourde (max 50 Mo)"); return; }
  if(isVid){
    // POC local : on enregistre la référence + les métadonnées ; le fichier ira sur le serveur à la publication
    const entry={ name:file.name, origin:"upload", kind:"video", size:file.size, type:file.type, alt:"" };
    draft.media.push(entry);
    save(); renderAllMedia(); updateDashboard();
    toast("Vidéo ajoutée (envoyée au serveur lors de la publication)");
    const url=URL.createObjectURL(file); const v=document.createElement("video"); v.preload="metadata";
    v.onloadedmetadata=()=>{ entry.w=v.videoWidth; entry.h=v.videoHeight; entry.dur=v.duration; URL.revokeObjectURL(url); save(); renderAllMedia(); };
    v.onerror=()=>URL.revokeObjectURL(url); v.src=url;
    return;
  }
  const fromPage = !mediaTarget;
  const storeImg=(src, meta)=>{
    const entry=Object.assign({ src:src, name:file.name, origin:"upload", kind:"image", alt:"" }, meta);
    draft.media.push(entry);
    if(mediaTarget){ applyMedia(src); document.getElementById("mediaModalBg").classList.remove("show"); toast(meta.optimized?"Image importée et optimisée":"Image importée"); }
    else { save(); toast(meta.optimized?"Image ajoutée et optimisée":"Image ajoutée à la médiathèque"); }
    renderAllMedia(); updateDashboard();
    uploadMediaToBlobAsync(entry, src); /* stockage réel : dataURL -> URL Blob persistante (repli local si indispo) */
    if(!entry.w||!entry.h){ const im=new Image(); im.onload=()=>{ entry.w=im.naturalWidth; entry.h=im.naturalHeight; save(); renderAllMedia();
      if(fromPage){ const mv=document.getElementById("view-media"); if(mv&&mv.classList.contains("on")) openMediaDetail(draft.media.indexOf(entry)); } }; im.src=src; }
    else if(fromPage){ const mv=document.getElementById("view-media"); if(mv&&mv.classList.contains("on")) openMediaDetail(draft.media.indexOf(entry)); }
  };
  mediaOptimize(file, function(opt){
    // L'optimisée n'est retenue que si elle est réellement plus légère ET sous la limite.
    if(opt && opt.size <= MEDIA.imgMax){
      storeImg(opt.src, { size:opt.size, type:opt.type, w:opt.w, h:opt.h, optimized:true, origSize:file.size }); return;
    }
    // Sinon (pas d'optimisation utile, image animée, ou encore trop lourde) : on retombe sur l'original s'il tient dans la limite.
    if(file.size > MEDIA.imgMax){ toast(opt ? "Image trop lourde même après optimisation (max 2 Mo)" : "Image trop lourde (max 2 Mo)"); return; }
    const rd=new FileReader(); rd.onload=()=>storeImg(rd.result, { size:file.size, type:file.type, optimized:false }); rd.readAsDataURL(file);
  });
}
/* ---- Stockage réel des médias (chantier media) ----
   Un import produit d'abord un dataURL (aperçu instantané), puis on l'envoie au store via
   /api/media-upload et on remplace PARTOUT le dataURL par l'URL persistante (médiathèque, images
   appliquées, fonds). Repli NON-CASSANT : sans connexion/clé ou si l'API échoue, on garde le
   dataURL (comportement historique) et entry.stored="local" — la démo hors-ligne reste intacte. */
function dataUrlParts(src){
  var m=/^data:([^;,]+);base64,/.exec(src||""); if(!m) return null; // on n'envoie QUE des dataURL base64
  return { contentType:(m[1]||"application/octet-stream"), dataBase64:src.slice(m[0].length) };
}
function replaceMediaSrc(oldSrc, newSrc){
  if(!oldSrc || !newSrc || oldSrc===newSrc) return;
  (draft.media||[]).forEach(function(m){ if(m && m.src===oldSrc) m.src=newSrc; });
  Object.keys(draft.images||{}).forEach(function(k){ if(draft.images[k]===oldSrc) draft.images[k]=newSrc; });
  Object.keys(draft.bgImages||{}).forEach(function(k){ if(draft.bgImages[k]===oldSrc) draft.bgImages[k]=newSrc; });
  // imgPub : quand un dataURL devient une URL Blob, l'entrée à publier suit (elle devient https -> publiable)
  Object.keys(draft.imgPub||{}).forEach(function(pk){ var m=draft.imgPub[pk]; Object.keys(m).forEach(function(o){ if(m[o]===oldSrc) m[o]=newSrc; }); });
  if(DOC){
    DOC.querySelectorAll("[data-ckimg]").forEach(function(el){ if(el.getAttribute("src")===oldSrc) el.setAttribute("src", newSrc); });
    BG_DEFS.forEach(function(b){ var el=DOC.querySelector(b.sel); if(el && bgUrl(el)===oldSrc) el.style.backgroundImage='url("'+newSrc+'")'; });
  }
}
function uploadMediaToBlobAsync(entry, dataUrl){
  try{
    if(!entry || entry.kind!=="image") return; // vidéos : envoi différé (gros fichiers) — non concerné ici
    var parts=dataUrlParts(dataUrl); if(!parts) return; // déjà une URL (média du site) : rien à envoyer
    var key=getStoredPublishKey(); if(!key){ entry.stored="local"; return; } // pas connecté : repli local (démo)
    entry.stored="uploading";
    fetch("/api/media-upload", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+key },
      body:JSON.stringify({ filename:entry.name||"media", contentType:parts.contentType, dataBase64:parts.dataBase64 }) })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        if(j && j.ok && j.url){ replaceMediaSrc(dataUrl, j.url); entry.src=j.url; entry.stored="blob"; entry.blobPath=j.pathname; save(); renderAllMedia(); }
        else { entry.stored="local"; } // échec (401/limite/indispo) : on garde le dataURL, aucune régression
      })
      .catch(function(){ entry.stored="local"; });
  }catch(e){ if(entry) entry.stored="local"; }
}
function makeMediaInput(){
  const inp=document.createElement("input"); inp.type="file";
  inp.accept="image/webp,image/png,image/jpeg,image/svg+xml,video/mp4,video/webm";
  inp.style.display="none"; document.body.appendChild(inp);
  inp.addEventListener("change",()=>{ const f=inp.files&&inp.files[0]; inp.value=""; importMediaFile(f); });
  return inp;
}
function renderMediaInto(grid, pickable){
  if(!grid) return; grid.innerHTML="";
  const cur=currentSrc();
  if(!draft.media.length){ grid.innerHTML='<p class="hint" style="grid-column:1/-1">Aucune image pour l\'instant. Importez-en une.</p>'; return; }
  draft.media.forEach((m,idx)=>{
    const isVid = m.kind==="video";
    const canPick = pickable && !isVid;
    const cell=document.createElement("div"); cell.className="media-cell"+(canPick&&m.src===cur?" on":"")+(canPick?"":" nopick");
    const thumb = isVid
      ? '<div class="media-pick" style="display:flex;align-items:center;justify-content:center;color:var(--muted)"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/></svg></div>'
      : '<button class="media-pick"'+(canPick?' title="Utiliser cette image"':'')+'><img src="'+escAttr(m.src)+'" alt="" loading="lazy"></button>';
    const tag = isVid ? "vidéo" : (m.origin==="upload"?"importé":"site");
    cell.innerHTML = thumb +
      '<div class="media-meta"><span class="tag '+(m.origin==="upload"?"up":"")+'">'+tag+'</span>'+
      (m.origin==="upload"?'<button class="media-del" data-i="'+idx+'" title="Retirer de la médiathèque" aria-label="Retirer">&times;</button>':'')+'</div>';
    if(canPick){ const pb=cell.querySelector(".media-pick"); if(pb) pb.addEventListener("click",()=>pickMedia(m.src)); }
    const del=cell.querySelector(".media-del"); if(del) del.addEventListener("click",(e)=>{ e.stopPropagation(); deleteMediaAt(idx); });
    grid.appendChild(cell);
  });
}
function renderAllMedia(){
  if(document.getElementById("mediaModalBg").classList.contains("show")) renderMediaInto(document.getElementById("mediaGrid"),true);
  renderMediaPage();
}

/* ---- métadonnées des médias (format, dimensions, poids) + fiche détaillée ---- */
function fmtBytes(b){ if(b==null) return "—"; if(b<1024) return b+" o"; if(b<1048576) return (b/1024).toFixed(b<10240?1:0)+" Ko"; return (b/1048576).toFixed(1)+" Mo"; }
function fmtDur(s){ if(s==null) return null; s=Math.round(s); const m=Math.floor(s/60); return m+":"+String(s%60).padStart(2,"0"); }
function mediaFormat(m){ const ext=((m.name||m.src||"").split("?")[0].split(".").pop()||"").toLowerCase();
  const known={webp:"WEBP",png:"PNG",jpg:"JPG",jpeg:"JPG",svg:"SVG",gif:"GIF",avif:"AVIF",mp4:"MP4",webm:"WEBM",mov:"MOV"};
  if(known[ext]) return known[ext];
  let t=m.type||""; if(t && t.indexOf("octet-stream")<0){ return (t.split("/")[1]||"").toUpperCase().replace("SVG+XML","SVG").replace("JPEG","JPG"); }
  return (ext&&ext.length<=4)?ext.toUpperCase():"—"; }
function mediaDims(m){ return (m.w&&m.h)?(m.w+" × "+m.h+" px"):null; }
function mediaSizeHint(m){ if(!m.w||!m.h||m.kind==="video") return null; const px=Math.max(m.w,m.h);
  if(px<=80) return {t:"Icône",c:"#8a8c89"}; if(px<=500) return {t:"Petite",c:"#8a8c89"}; if(px<=1200) return {t:"Moyenne",c:"#0F6E56"}; if(px<=2400) return {t:"Grande",c:"#0F6E56"}; return {t:"Très grande",c:"#9A6A15"}; }
const _mediaEnriching=new Set();
let _mediaRerenderT=null;
function enrichMedia(m, cb){
  const tasks=[];
  if((!m.w||!m.h) && m.src){ tasks.push(new Promise(res=>{
    if(m.kind==="video"){ const v=document.createElement("video"); v.preload="metadata"; v.onloadedmetadata=()=>{ m.w=v.videoWidth; m.h=v.videoHeight; m.dur=v.duration; res(); }; v.onerror=res; v.src=m.src; }
    else { const im=new Image(); im.onload=()=>{ m.w=im.naturalWidth; m.h=im.naturalHeight; res(); }; im.onerror=res; im.src=m.src; } })); }
  if(m.size==null && m.src){ if(m.src.indexOf("data:")===0){ const i=m.src.indexOf(","); m.size=i>=0?Math.round((m.src.length-i-1)*0.75):null; }
    else tasks.push(fetch(m.src).then(r=>r.blob()).then(b=>{ m.size=b.size; if(!m.type) m.type=b.type; }).catch(()=>{})); }
  if(!tasks.length){ if(cb) cb(); return; }
  Promise.all(tasks).then(()=>{ save(); if(cb) cb(); });
}
const MD_CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const MD_WARN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4h.01"/></svg>';
const MD_VIDICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/></svg>';
function mediaMetaLine(m){ const isVid=m.kind==="video"; return [mediaFormat(m), mediaDims(m), (m.size!=null?fmtBytes(m.size):null), (isVid?fmtDur(m.dur):null)].filter(Boolean).join(" · ")||"…"; }
function mediaAltBadge(m){ if(m.kind==="video") return ''; return m.alt?'<span class="mcard-alt ok" title="Texte alternatif défini">'+MD_CHECK+'alt</span>':'<span class="mcard-alt miss" title="Texte alternatif manquant">'+MD_WARN+'alt manquant</span>'; }
/* MàJ d'une carte EN PLACE (pas de reconstruction du grid) : évite le clignotement au survol pendant l'enrichissement/la saisie */
function updateMediaCard(idx){ const grid=document.getElementById("mediaPageGrid"); if(!grid) return; const card=grid.querySelector('.mcard[data-idx="'+idx+'"]'); const m=draft.media[idx]; if(!card||!m) return;
  const meta=card.querySelector(".mcard-meta"); if(meta) meta.textContent=mediaMetaLine(m);
  const nm=card.querySelector(".mcard-name"); if(nm){ nm.textContent=m.name||"sans nom"; nm.title=m.name||""; }
  const tags=card.querySelector(".mcard-tags"); if(tags) tags.innerHTML='<span class="mcard-origin '+(m.origin==="upload"?"up":"")+'">'+(m.kind==="video"?"vidéo":(m.origin==="upload"?"importé":"site"))+'</span>'+mediaAltBadge(m); }
function renderMediaPage(){ const grid=document.getElementById("mediaPageGrid"); if(!grid) return; grid.innerHTML="";
  const cnt=document.getElementById("mediaCount"); if(cnt) cnt.textContent=draft.media.length?(draft.media.length+" élément"+(draft.media.length>1?"s":"")):"";
  if(!draft.media.length){ grid.innerHTML='<p class="hint" style="grid-column:1/-1">Aucun média pour l\'instant. Importez-en un ci-dessus.</p>'; return; }
  draft.media.forEach((m,idx)=>{
    const isVid=m.kind==="video";
    const card=document.createElement("div"); card.className="mcard"; card.setAttribute("data-idx",idx);
    const thumb = isVid ? (m.src?'<video src="'+escAttr(m.src)+'" muted preload="metadata"></video>':'<div class="mcard-vid">'+MD_VIDICON+'</div>') : '<img src="'+escAttr(m.src)+'" alt="" loading="lazy">';
    const typeBadge = isVid ? '<span class="mcard-type vid" title="Vidéo"><i data-lucide="video"></i></span>' : '<span class="mcard-type" title="Image"><i data-lucide="image"></i></span>';
    card.innerHTML='<button class="mcard-thumb" title="Voir et modifier les détails">'+typeBadge+thumb+'</button>'
      +'<div class="mcard-body"><div class="mcard-name" title="'+escHtml(m.name||"")+'">'+escHtml(m.name||"sans nom")+'</div>'
      +'<div class="mcard-meta">'+mediaMetaLine(m)+'</div>'
      +'<div class="mcard-tags"><span class="mcard-origin '+(m.origin==="upload"?"up":"")+'">'+(isVid?"vidéo":(m.origin==="upload"?"importé":"site"))+'</span>'+mediaAltBadge(m)+'</div></div>';
    card.querySelector(".mcard-thumb").addEventListener("click",()=>openMediaDetail(idx));
    grid.appendChild(card);
    const key=m.src||m.name;
    if((m.size==null||!m.w) && !_mediaEnriching.has(key)){ _mediaEnriching.add(key); enrichMedia(m,()=>{ _mediaEnriching.delete(key); updateMediaCard(idx); if(mediaDetailIdx===idx) renderMediaDetail(); }); }
  });
  refreshIcons();
}
let mediaDetailIdx=null;
function openMediaDetail(idx){ mediaDetailIdx=idx; renderMediaDetail(); document.getElementById("mediaDetailModal").classList.add("show"); }
function closeMediaDetail(){ document.getElementById("mediaDetailModal").classList.remove("show"); mediaDetailIdx=null; }
function renderMediaDetail(){ if(mediaDetailIdx==null) return; const m=draft.media[mediaDetailIdx]; const b=document.getElementById("mdBody"); if(!m||!b){ closeMediaDetail(); return; }
  const isVid=m.kind==="video";
  const preview = isVid ? (m.src?'<video src="'+escAttr(m.src)+'" controls muted></video>':'<div class="md-vidph">'+MD_VIDICON+'</div>') : '<img src="'+escAttr(m.src)+'" alt="">';
  const sh=mediaSizeHint(m);
  const chips=[["Format",mediaFormat(m)],["Dimensions",mediaDims(m)||"…"],["Poids",m.size!=null?fmtBytes(m.size):"…"]];
  if(isVid) chips.push(["Durée",fmtDur(m.dur)||"…"]);
  b.innerHTML='<div class="md-prev">'+preview+'</div>'
    +'<div class="md-chips">'+chips.map(c=>'<span class="md-chip"><span class="md-chip-k">'+c[0]+'</span><span class="md-chip-v">'+escHtml(String(c[1]))+'</span></span>').join("")
      +(sh?'<span class="md-chip"><span class="md-chip-k">Taille</span><span class="md-chip-v" style="color:'+sh.c+'">'+sh.t+'</span></span>':'')+'</div>'
    +'<div class="formf"><label>Nom du fichier</label><input id="mdName" value="'+escHtml(m.name||"")+'"></div>'
    +(isVid?'':'<div class="formf" style="margin-bottom:2px"><label>Texte alternatif <span class="md-hint">décrit l\'image pour Google et les lecteurs d\'écran</span></label><input id="mdAlt" value="'+escHtml(m.alt||"")+'" placeholder="Ex. Coursier Chaskis remettant un colis"></div>')
    +'<div class="md-actions"><span class="mcard-origin '+(m.origin==="upload"?"up":"")+'">'+(isVid?"vidéo":(m.origin==="upload"?"importé":"image du site"))+'</span><div style="flex:1"></div>'
      +(m.origin==="upload"?'<button class="btn ghost md-del" id="mdDel"><i data-lucide="trash-2"></i>Supprimer</button>':'')
      +'<button class="btn primary" id="mdOk">Terminé</button></div>';
  const nm=document.getElementById("mdName"); if(nm) nm.addEventListener("input",()=>{ m.name=nm.value; save(); updateMediaCard(mediaDetailIdx); });
  const al=document.getElementById("mdAlt"); if(al) al.addEventListener("input",()=>{ m.alt=al.value; save(); updateMediaCard(mediaDetailIdx); });
  const dl=document.getElementById("mdDel"); if(dl) dl.addEventListener("click",()=>{ const i=mediaDetailIdx; closeMediaDetail(); deleteMediaAt(i); });
  const ok=document.getElementById("mdOk"); if(ok) ok.addEventListener("click",closeMediaDetail);
  refreshIcons();
}

/* ============================================================
   Éditeurs de contenu structuré (logos, avis, simulateur)
   ============================================================ */
function escAttr(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
function openSpec(title, sub){ document.getElementById("specTitle").textContent=title; document.getElementById("specSub").textContent=sub||""; document.getElementById("specModal").classList.add("show"); }
function closeSpec(){ document.getElementById("specModal").classList.remove("show"); }
function openSpecialEditor(kind){
  if(kind==="logos") return openLogosEditor();
  if(kind==="avis") return openTestiEditor();
  if(kind==="simulateur") return openPricingEditor();
  showContentGuide("neutral", SEC_SPECIAL[kind]||"");
}

/* ---- Logos de confiance : SVG uploadables, taille et recoloration (gris uniforme) ---- */
let _logosWork=null;
function seedLogos(){ const arr=[], seen=new Set();
  if(DOC){ DOC.querySelectorAll(".partners .mq-inner .mq-logo").forEach(img=>{ let src; try{ src=new URL(img.getAttribute("src"), DOC.baseURI).pathname; }catch(e){ src=img.getAttribute("src"); }
    if(seen.has(src)) return; seen.add(src); arr.push({id:"lg"+arr.length, name:img.getAttribute("alt")||"Logo", src, height:34, keepColor:false}); }); }
  if(!arr.length){ arr.push({id:"lg0",name:"Uber",src:"/assets/img/uber.svg",height:34,keepColor:false},{id:"lg1",name:"Proton",src:"/assets/img/proton.svg",height:34,keepColor:false}); }
  return arr;
}
function getLogos(){ if(Array.isArray(draft.logos)) return draft.logos; if(!_logosWork) _logosWork=seedLogos(); return _logosWork; }
function commitLogos(){ draft.logos=getLogos(); markDirty(); applyLogos(); }
function applyLogos(){ if(!DOC||!Array.isArray(draft.logos)) return; const logos=draft.logos; const inners=DOC.querySelectorAll(".partners .mq-inner"); if(!inners.length||!logos.length) return;
  const reps=Math.max(1, Math.ceil(Math.max(8, logos.length*4)/logos.length)); let items="";
  for(let r=0;r<reps;r++){ logos.forEach(l=>{ const st="height:"+(l.height||34)+"px"+(l.keepColor?";filter:none;opacity:1":""); items+='<span class="mq-i"><img src="'+escAttr(l.src)+'" alt="'+escAttr(l.name||"")+'" class="mq-logo" style="'+st+'"></span>'; }); }
  inners.forEach(inner=>{ inner.innerHTML=items; });
}
const logoInput=(function(){ const i=document.createElement("input"); i.type="file"; i.accept="image/svg+xml,image/png,image/webp,image/jpeg"; i.style.display="none"; document.body.appendChild(i);
  i.addEventListener("change",()=>{ const f=i.files&&i.files[0]; if(!f) return; i.value=""; if(!/^image\/(svg\+xml|png|webp|jpeg)$/.test(f.type)){ toast("Format non supporté (SVG conseillé)"); return; } if(f.size>1048576){ toast("Logo trop lourd (max 1 Mo)"); return; }
    const rd=new FileReader(); rd.onload=()=>{ const logos=getLogos(); logos.push({id:"lg"+Date.now(), name:f.name.replace(/\.[^.]+$/,""), src:rd.result, height:34, keepColor:false}); commitLogos(); renderLogosEditor(); toast("Logo ajouté"); }; rd.readAsDataURL(f); });
  return i; })();
const ICO_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
const ICO_UP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0 4 4m-4-4L8 8"/><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/></svg>';
function openLogosEditor(){ openSpec("Logos de confiance","Les entreprises qui vous font confiance. Les logos sont mis en gris pour un rendu uniforme ; ajustez la taille pour bien les équilibrer."); renderLogosEditor(); }
function logoStripHTML(){ const logos=getLogos(); return logos.length?logos.map(l=>'<img src="'+escAttr(l.src)+'" alt="'+escAttr(l.name)+'" class="'+(l.keepColor?"":"mono")+'" style="height:'+(l.height||34)+'px">').join(""):'<span class="hint">Aucun logo pour l\'instant.</span>'; }
function updateLogoStrip(){ const s=document.querySelector("#specBody .logo-strip"); if(s) s.innerHTML=logoStripHTML(); }
function renderLogosEditor(){ const logos=getLogos(); const b=document.getElementById("specBody");
  const list=logos.map((l,i)=>'<div class="logo-item">'
     +'<div class="logo-item-thumb"><img src="'+escAttr(l.src)+'" alt="" class="'+(l.keepColor?"color":"")+'"></div>'
     +'<div class="logo-item-main"><input class="logo-item-name" data-i="'+i+'" value="'+escAttr(l.name)+'" placeholder="Nom de l\'entreprise">'
       +'<div class="logo-item-ctrls"><span class="logo-h">Taille <input type="range" min="18" max="52" value="'+(l.height||34)+'" data-h="'+i+'"><span class="hv">'+(l.height||34)+' px</span></span>'
       +'<button type="button" class="logo-color-btn'+(l.keepColor?" on":"")+'" data-c="'+i+'">Couleurs d\'origine</button></div></div>'
     +'<button class="logo-del" data-d="'+i+'" title="Retirer" aria-label="Retirer">'+ICO_TRASH+'</button></div>').join("");
  b.innerHTML='<div class="spec-preview"><div class="spec-preview-l">Aperçu du bandeau</div><div class="logo-strip">'+logoStripHTML()+'</div></div>'
    +'<div class="logo-list">'+list+'</div>'
    +'<button class="btn primary spec-add" id="logoAdd">'+ICO_UP+'Ajouter un logo (SVG conseillé)</button>';
  b.querySelectorAll(".logo-item-name").forEach(inp=>inp.addEventListener("input",()=>{ logos[+inp.dataset.i].name=inp.value; draft.logos=logos; markDirty(); applyLogos(); }));
  b.querySelectorAll("[data-h]").forEach(r=>r.addEventListener("input",()=>{ const i=+r.dataset.h; logos[i].height=+r.value; commitLogos(); const hv=r.parentNode.querySelector(".hv"); if(hv) hv.textContent=r.value+" px"; updateLogoStrip(); }));
  b.querySelectorAll("[data-c]").forEach(btn=>btn.addEventListener("click",()=>{ const i=+btn.dataset.c; logos[i].keepColor=!logos[i].keepColor; commitLogos(); renderLogosEditor(); }));
  b.querySelectorAll("[data-d]").forEach(btn=>btn.addEventListener("click",()=>{ const i=+btn.dataset.d; if(logos.length<=1){ toast("Gardez au moins un logo"); return; } logos.splice(i,1); commitLogos(); renderLogosEditor(); }));
  document.getElementById("logoAdd").addEventListener("click",()=>logoInput.click());
}

/* ---- Avis clients : photo, nom, entreprise, note, texte (add / edit / delete / réordonner) ---- */
let _testiWork=null, _testiPhotoTarget=null, _testiApplyT=null;
function seedTesti(){ let src=null; try{ src=WIN&&WIN.CHASKIS_TESTI_DEFAULT; }catch(e){}
  if(Array.isArray(src)&&src.length) return src.map((c,i)=>({id:"tm"+i, name:c.name||"", company:c.role||"", text:c.text||"", photo:c.photo||"", rating:c.rating||5}));
  return [{id:"tm0",name:"Marie Laurent",company:"Pharmacie du Lac, Genève",text:"On est passé de 30% de commission à un tarif fixe. En 3 mois, la marge est récupérée sur chaque commande.",photo:"https://randomuser.me/api/portraits/women/44.jpg",rating:5}];
}
function getTesti(){ if(Array.isArray(draft.testimonials)) return draft.testimonials; if(!_testiWork) _testiWork=seedTesti(); return _testiWork; }
function applyTestimonials(){ try{ if(typeof WIN!=="undefined" && WIN && Array.isArray(draft.testimonials)){ WIN.CHASKIS_TESTI=draft.testimonials.map(t=>({text:t.text, name:t.name, role:t.company, photo:t.photo, rating:t.rating})); if(typeof WIN._testiRebuild==="function") WIN._testiRebuild(currentLang); } }catch(e){} }
function applyTestiDebounced(){ if(_testiApplyT) clearTimeout(_testiApplyT); _testiApplyT=setTimeout(applyTestimonials,260); }
function commitTesti(){ draft.testimonials=getTesti(); markDirty(); applyTestimonials(); }
const testiPhotoInput=(function(){ const i=document.createElement("input"); i.type="file"; i.accept="image/webp,image/png,image/jpeg"; i.style.display="none"; document.body.appendChild(i);
  i.addEventListener("change",()=>{ const f=i.files&&i.files[0]; if(!f||_testiPhotoTarget==null){ i.value=""; return; } i.value=""; if(f.size>1048576){ toast("Photo trop lourde (max 1 Mo)"); return; } const rd=new FileReader(); rd.onload=()=>{ const t=getTesti()[_testiPhotoTarget]; if(t){ t.photo=rd.result; commitTesti(); renderTestiEditor(); } }; rd.readAsDataURL(f); });
  return i; })();
const STAR_POLY='<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>';
function starsPick(i, rating){ let s=""; for(let k=1;k<=5;k++){ s+='<button type="button" class="tm-star'+(k<=rating?" on":"")+'" data-star="'+i+'" data-v="'+k+'" aria-label="'+k+' sur 5"><svg viewBox="0 0 24 24">'+STAR_POLY+'</svg></button>'; } return s; }
function openTestiEditor(){ openSpec("Avis clients","Ajoutez, modifiez ou retirez des témoignages : photo, nom, entreprise, note et texte. Le carrousel de la page d'accueil se met à jour."); renderTestiEditor(); }
function renderTestiEditor(){ const arr=getTesti(); const b=document.getElementById("specBody");
  const items=arr.map((t,i)=>'<div class="tm-item">'
    +'<div class="tm-top"><button type="button" class="tm-photo" data-photo="'+i+'" title="Changer la photo">'+(t.photo?'<img src="'+escAttr(t.photo)+'" alt="">':'<span class="tm-photo-ph"><i data-lucide="camera"></i></span>')+'</button>'
      +'<div class="tm-id"><input class="tm-in" data-name="'+i+'" value="'+escAttr(t.name)+'" placeholder="Nom du client"><input class="tm-in tm-comp" data-comp="'+i+'" value="'+escAttr(t.company)+'" placeholder="Entreprise, ville"></div>'
      +'<div class="tm-ord"><button class="tm-mv" data-up="'+i+'"'+(i===0?" disabled":"")+' aria-label="Monter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg></button>'
        +'<button class="tm-mv" data-down="'+i+'"'+(i===arr.length-1?" disabled":"")+' aria-label="Descendre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>'
        +'<button class="logo-del" data-tmdel="'+i+'" title="Retirer">'+ICO_TRASH+'</button></div></div>'
    +'<div class="tm-stars">'+starsPick(i,t.rating||5)+'</div>'
    +'<textarea class="tm-text" data-text="'+i+'" rows="2" placeholder="Ce que dit le client…">'+escHtml(t.text)+'</textarea>'
  +'</div>').join("");
  b.innerHTML='<div class="tm-list">'+(items||'<p class="hint">Aucun avis.</p>')+'</div><button class="btn primary spec-add" id="tmAdd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Ajouter un avis</button>';
  b.querySelectorAll("[data-photo]").forEach(el=>el.addEventListener("click",()=>{ _testiPhotoTarget=+el.dataset.photo; testiPhotoInput.click(); }));
  b.querySelectorAll("[data-name]").forEach(el=>el.addEventListener("input",()=>{ arr[+el.dataset.name].name=el.value; draft.testimonials=arr; markDirty(); applyTestiDebounced(); }));
  b.querySelectorAll("[data-comp]").forEach(el=>el.addEventListener("input",()=>{ arr[+el.dataset.comp].company=el.value; draft.testimonials=arr; markDirty(); applyTestiDebounced(); }));
  b.querySelectorAll("[data-text]").forEach(el=>el.addEventListener("input",()=>{ arr[+el.dataset.text].text=el.value; draft.testimonials=arr; markDirty(); applyTestiDebounced(); }));
  b.querySelectorAll("[data-star]").forEach(el=>el.addEventListener("click",()=>{ arr[+el.dataset.star].rating=+el.dataset.v; commitTesti(); renderTestiEditor(); }));
  b.querySelectorAll("[data-up]").forEach(el=>el.addEventListener("click",()=>{ const i=+el.dataset.up; if(i<=0) return; const a=arr.splice(i,1)[0]; arr.splice(i-1,0,a); commitTesti(); renderTestiEditor(); }));
  b.querySelectorAll("[data-down]").forEach(el=>el.addEventListener("click",()=>{ const i=+el.dataset.down; if(i>=arr.length-1) return; const a=arr.splice(i,1)[0]; arr.splice(i+1,0,a); commitTesti(); renderTestiEditor(); }));
  b.querySelectorAll("[data-tmdel]").forEach(el=>el.addEventListener("click",()=>{ if(arr.length<=1){ toast("Gardez au moins un avis"); return; } arr.splice(+el.dataset.tmdel,1); commitTesti(); renderTestiEditor(); }));
  const add=document.getElementById("tmAdd"); if(add) add.addEventListener("click",()=>{ arr.push({id:"tm"+Date.now(), name:"", company:"", text:"", photo:"", rating:5}); commitTesti(); renderTestiEditor(); });
  refreshIcons();
}

/* ---- Simulateur & tarifs : source unique partagée (accueil + copilote) ---- */
const PRICING_KEY="chaskis_pricing";
const DEFAULT_PRICING={ days:22,
  tiers:[{max:10,rate:16,plan:"Express"},{max:40,rate:12,plan:"Flex"},{max:null,rate:8,plan:"Dédié"}],
  zones:[{key:"geneve",name:"Genève",unit:14},{key:"leman",name:"Léman / Vaud",unit:22}],
  flexMonthly:249, flexIncluded:30, express:9,
  promos:[{code:"CHASKIS10",pct:10},{code:"BIENVENUE",pct:15},{code:"PARTNER20",pct:20}] };
let _pricingWork=null;
function seedPricing(){ try{ const s=JSON.parse(localStorage.getItem(PRICING_KEY)); if(s) return s; }catch(e){} return JSON.parse(JSON.stringify(DEFAULT_PRICING)); }
function getPricing(){ if(draft.pricing) return draft.pricing; if(!_pricingWork) _pricingWork=seedPricing(); return _pricingWork; }
function commitPricing(){ draft.pricing=getPricing(); try{ localStorage.setItem(PRICING_KEY, JSON.stringify(draft.pricing)); }catch(e){} markDirty(); applyPricingToPage(); const cv=document.getElementById("view-copilot"); if(cv&&cv.classList.contains("on")&&typeof renderCopilot==="function") renderCopilot(); }
function applyPricingToPage(){ try{ if(typeof WIN!=="undefined" && WIN && draft.pricing){ WIN.CHASKIS_PRICING=draft.pricing; if(typeof WIN._simUpdate==="function") WIN._simUpdate(); } }catch(e){} }
function prNum(v){ return v==null?"":v; }
function openPricingEditor(){ openSpec("Simulateur & tarifs","Ces tarifs alimentent le simulateur de la page d'accueil et le simulateur d'offre du copilote. Une modification se répercute aux deux."); renderPricingEditor(); }
function renderPricingEditor(){ const P=getPricing(); const b=document.getElementById("specBody");
  const tierRows=P.tiers.map((t,i)=>{ const isLast=(t.max==null);
    return '<div class="pr-row"><span class="pr-cap">'+(isLast?"Au-delà":"Jusqu\'à")+'</span>'
      +(isLast?'<span class="pr-fixed">—</span>':'<input class="pr-in" type="number" min="1" value="'+prNum(t.max)+'" data-tmax="'+i+'">')
      +'<span class="pr-unit">liv/jour</span><input class="pr-in" type="number" min="0" value="'+prNum(t.rate)+'" data-trate="'+i+'"><span class="pr-unit">CHF/course</span>'
      +'<input class="pr-in pr-plan" value="'+escAttr(t.plan||"")+'" data-tplan="'+i+'" placeholder="Palier">'
      +((P.tiers.length>2 && !isLast)?'<button class="logo-del" data-tdel="'+i+'" title="Retirer">'+ICO_TRASH+'</button>':'<span style="width:30px;display:inline-block"></span>')+'</div>'; }).join("");
  const zoneRows=P.zones.map((z,i)=>'<div class="pr-row"><input class="pr-in pr-plan" value="'+escAttr(z.name)+'" data-zname="'+i+'" placeholder="Nom de la zone"><input class="pr-in" type="number" min="0" value="'+prNum(z.unit)+'" data-zunit="'+i+'"><span class="pr-unit">CHF/course</span></div>').join("");
  const promoRows=P.promos.map((p,i)=>'<div class="pr-row"><input class="pr-in pr-plan" value="'+escAttr(p.code)+'" data-pcode="'+i+'" style="text-transform:uppercase" placeholder="CODE"><input class="pr-in" type="number" min="0" max="100" value="'+prNum(p.pct)+'" data-ppct="'+i+'"><span class="pr-unit">% de remise</span><button class="logo-del" data-pdel="'+i+'" title="Retirer">'+ICO_TRASH+'</button></div>').join("");
  b.innerHTML=
    '<div class="pr-sec"><div class="pr-sec-t">Tarif dégressif · page d\'accueil</div>'
      +'<div class="pr-line"><label>Jours ouvrés par mois</label><input class="pr-in" type="number" min="1" max="31" value="'+prNum(P.days)+'" id="prDays"></div>'
      +'<p class="pr-hint">Plus le volume est élevé, plus le tarif par course baisse.</p>'+tierRows
      +'<button class="btn ghost pr-add" id="prTierAdd"><i data-lucide="plus"></i>Ajouter un palier</button></div>'
    +'<div class="pr-sec"><div class="pr-sec-t">Simulateur d\'offre · copilote</div>'
      +'<p class="pr-hint">Prix par course selon la zone dominante.</p>'+zoneRows
      +'<div class="pr-line"><label>Abonnement Flex</label><input class="pr-in" type="number" min="0" value="'+prNum(P.flexMonthly)+'" id="prFlex"><span class="pr-unit">CHF/mois ·</span><input class="pr-in" type="number" min="0" value="'+prNum(P.flexIncluded)+'" id="prFlexInc"><span class="pr-unit">courses incluses</span></div>'
      +'<div class="pr-line"><label>Surcharge express (&lt; 2h)</label><input class="pr-in" type="number" min="0" value="'+prNum(P.express)+'" id="prExp"><span class="pr-unit">CHF/course</span></div></div>'
    +'<div class="pr-sec"><div class="pr-sec-t">Codes promo · copilote</div>'+promoRows
      +'<button class="btn ghost pr-add" id="prPromoAdd"><i data-lucide="plus"></i>Ajouter un code</button></div>';
  const num=(id,fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener("input",()=>{ fn(el.value===""?null:+el.value); commitPricing(); }); };
  num("prDays",v=>P.days=v); num("prFlex",v=>P.flexMonthly=v); num("prFlexInc",v=>P.flexIncluded=v); num("prExp",v=>P.express=v);
  b.querySelectorAll("[data-tmax]").forEach(el=>el.addEventListener("input",()=>{ P.tiers[+el.dataset.tmax].max=el.value===""?null:+el.value; commitPricing(); }));
  b.querySelectorAll("[data-trate]").forEach(el=>el.addEventListener("input",()=>{ P.tiers[+el.dataset.trate].rate=+el.value; commitPricing(); }));
  b.querySelectorAll("[data-tplan]").forEach(el=>el.addEventListener("input",()=>{ P.tiers[+el.dataset.tplan].plan=el.value; commitPricing(); }));
  b.querySelectorAll("[data-tdel]").forEach(el=>el.addEventListener("click",()=>{ P.tiers.splice(+el.dataset.tdel,1); commitPricing(); renderPricingEditor(); }));
  b.querySelectorAll("[data-zname]").forEach(el=>el.addEventListener("input",()=>{ P.zones[+el.dataset.zname].name=el.value; commitPricing(); }));
  b.querySelectorAll("[data-zunit]").forEach(el=>el.addEventListener("input",()=>{ P.zones[+el.dataset.zunit].unit=+el.value; commitPricing(); }));
  b.querySelectorAll("[data-pcode]").forEach(el=>el.addEventListener("input",()=>{ P.promos[+el.dataset.pcode].code=el.value.toUpperCase(); commitPricing(); }));
  b.querySelectorAll("[data-ppct]").forEach(el=>el.addEventListener("input",()=>{ P.promos[+el.dataset.ppct].pct=+el.value; commitPricing(); }));
  b.querySelectorAll("[data-pdel]").forEach(el=>el.addEventListener("click",()=>{ if(P.promos.length<=1){ toast("Gardez au moins un code"); return; } P.promos.splice(+el.dataset.pdel,1); commitPricing(); renderPricingEditor(); }));
  const ta=document.getElementById("prTierAdd"); if(ta) ta.addEventListener("click",()=>{ P.tiers.splice(Math.max(0,P.tiers.length-1),0,{max:20,rate:10,plan:"Palier"}); commitPricing(); renderPricingEditor(); });
  const pa=document.getElementById("prPromoAdd"); if(pa) pa.addEventListener("click",()=>{ P.promos.push({code:"NOUVEAU",pct:10}); commitPricing(); renderPricingEditor(); });
  refreshIcons();
}

/* ---- Points de listes : ajouter / retirer un point dans les cards à puces (diff, offres) ---- */
/* listes éditables : puces (.diff-list/.offre-list = <li>) ET blocs (.feat-list = .feat-item icône+titre+texte) */
const LIST_TYPES=[{sel:".diff-list",item:"li"},{sel:".offre-list",item:"li"},{sel:".feat-list",item:".feat-item"}];
function listItemSel(ul){ return ul.getAttribute("data-ckitem")||"li"; }
function listItems(ul){ return ul.querySelectorAll(":scope > "+listItemSel(ul)); }
function listTextEl(li){ let t=li.querySelector("[data-cklistedit]")||li.querySelector(".feat-item-text")||li.querySelector("[data-i18n],[data-i18n-html]"); if(t) return t;
  const sp=li.querySelectorAll(":scope > span"); return sp.length?sp[sp.length-1]:li; }
function markLists(){ if(!DOC) return; let n=0; editableEls().forEach(sec=> LIST_TYPES.forEach(lt=> sec.querySelectorAll(lt.sel).forEach(ul=>{ ul.setAttribute("data-cklist","list"+(n++)); ul.setAttribute("data-ckitem",lt.item); }))); }
function applyLists(){ if(!DOC||!draft.lists) return; Object.keys(draft.lists).forEach(key=>{ const ul=DOC.querySelector('[data-cklist="'+cssEsc(key)+'"]'); if(ul && Array.isArray(draft.lists[key]) && draft.lists[key].length) ul.innerHTML=draft.lists[key].join(""); }); }
function cleanLiHTML(li){ const c=li.cloneNode(true); c.querySelectorAll(".ck-li-x").forEach(x=>x.remove()); c.classList.remove("ck-li");
  c.querySelectorAll("[contenteditable],[data-i18n],[data-i18n-html],[data-ckedit],[data-cklistedit],[data-ckkey],[spellcheck]").forEach(e=>{ ["contenteditable","spellcheck","data-i18n","data-i18n-html","data-ckedit","data-cklistedit","data-ckkey"].forEach(a=>e.removeAttribute(a)); });
  return c.outerHTML; }
function storeList(ul){ const key=ul.getAttribute("data-cklist"); if(!key) return; if(!draft.lists) draft.lists={}; draft.lists[key]=[...listItems(ul)].map(cleanLiHTML); markDirty(); }
function makeLiEditable(li, ul){ const t=listTextEl(li); if(!t||t.hasAttribute("data-cklistedit")) return;
  t.setAttribute("data-cklistedit","1"); t.setAttribute("contenteditable","true"); t.setAttribute("spellcheck","false");
  t.addEventListener("mousedown",e=>e.stopPropagation()); t.addEventListener("click",e=>e.stopPropagation());
  t.addEventListener("input",()=>storeList(ul)); }
function addLiRemove(li, ul){ if(li.querySelector(":scope > .ck-li-x")) return; li.classList.add("ck-li");
  const x=DOC.createElement("button"); x.type="button"; x.className="ck-li-x"; x.title="Retirer"; x.setAttribute("aria-label","Retirer");
  x.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  x.addEventListener("click",e=>{ e.preventDefault(); e.stopPropagation(); if(listItems(ul).length<=1){ toast("Gardez au moins un élément"); return; } li.remove(); storeList(ul); }); li.appendChild(x); }
function refreshListAdd(ul){ let add=ul.nextElementSibling; if(add&&add.classList&&add.classList.contains("ck-list-add")) return;
  const isBlock=listItemSel(ul)!=="li";
  add=DOC.createElement("button"); add.type="button"; add.className="ck-list-add"; add.innerHTML='<span>+</span>'+(isBlock?"ajouter un élément":"ajouter un point");
  add.addEventListener("click",e=>{ e.preventDefault(); e.stopPropagation(); addListItem(ul); }); ul.after(add); }
function decorateList(ul){ listItems(ul).forEach(li=>{ makeLiEditable(li,ul); addLiRemove(li,ul); }); refreshListAdd(ul); }
function decorateAllLists(){ if(!DOC) return; DOC.querySelectorAll("[data-cklist]").forEach(ul=> decorateList(ul)); }
function addListItem(ul){ const lis=listItems(ul); const tmpl=lis[lis.length-1]; if(!tmpl) return;
  const li=tmpl.cloneNode(true); li.querySelectorAll(".ck-li-x").forEach(x=>x.remove()); li.classList.remove("ck-li");
  const isFeat=li.matches&&li.matches(".feat-item"), t=listTextEl(li);
  if(t){ ["data-i18n","data-i18n-html","data-cklistedit","data-ckedit","data-ckkey","contenteditable"].forEach(a=>t.removeAttribute(a));
    if(isFeat) t.innerHTML='<h3>Nouvel élément</h3><p>Décrivez ce que ça apporte à vos clients…</p>'; else t.textContent="Nouveau point"; }
  ul.appendChild(li); makeLiEditable(li,ul); addLiRemove(li,ul); storeList(ul);
  const nt=listTextEl(li); if(nt){ try{ nt.focus(); const r=DOC.createRange(); r.selectNodeContents(nt); const sel=WIN.getSelection(); sel.removeAllRanges(); sel.addRange(r); }catch(e){} } }

/* ---- sections ---- */
function secEl(id){ const d=SECTION_DEFS.find(s=>s.id===id); return d?DOC.querySelector(d.sel):null; }
function editableEls(){ return SECTION_DEFS.map(d=>secEl(d.id)).filter(Boolean); }
function setupSections(){
  SECTION_DEFS.forEach(def=>{
    const el=secEl(def.id); if(!el) return;
    el.classList.add("ck-sec");
    const tb=DOC.createElement("div"); tb.className="ck-sec-tb";
    tb.innerHTML=
      '<button data-act="up" title="Monter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>'+
      '<button data-act="down" title="Descendre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>'+
      '<button data-act="hide" title="Masquer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/></svg></button>';
    tb.querySelector('[data-act="up"]').addEventListener("click",(e)=>{e.stopPropagation();moveSection(def.id,-1);});
    tb.querySelector('[data-act="down"]').addEventListener("click",(e)=>{e.stopPropagation();moveSection(def.id,1);});
    tb.querySelector('[data-act="hide"]').addEventListener("click",(e)=>{e.stopPropagation();toggleSection(def.id,true);});
    el.appendChild(tb);
  });
  refreshSecToolbars();
}
function refreshSecToolbars(){
  const order=currentOrder();
  order.forEach((id,i)=>{
    const el=secEl(id); if(!el) return;
    const tb=el.querySelector(":scope > .ck-sec-tb"); if(!tb) return;
    tb.querySelector('[data-act="up"]').style.display = i===0?"none":"";
    tb.querySelector('[data-act="down"]').style.display = i===order.length-1?"none":"";
  });
}
function currentOrder(){
  const items=SECTION_DEFS.map(d=>({id:d.id,el:secEl(d.id)})).filter(x=>x.el);
  items.sort((a,b)=> (a.el.compareDocumentPosition(b.el)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1);
  return items.map(x=>x.id);
}
/* règles d'ordre à préserver (A doit rester avant B), pour guider sans faux positifs sur l'ordre d'origine */
const ORDER_DEPS=[
  ["services","testi","Montrer la preuve avant d'avoir présenté ce que vous faites a moins d'impact."],
  ["sim","offres","Le simulateur doit venir avant les prix : il fait prendre conscience du coût, ce qui rend votre offre plus juste."],
  ["diff","offres","Annoncer le prix avant d'avoir convaincu fait fuir. On convainc, puis on chiffre."],
  ["services","offres","On montre la valeur avant d'annoncer le prix."],
  ["diff","booking","Pousser au rendez-vous avant d'avoir convaincu réduit les prises de contact."]
];
function orderGuidanceCheck(){
  const order=currentOrder(), pos={}; order.forEach((id,i)=>pos[id]=i);
  for(const dep of ORDER_DEPS){ const a=dep[0], b=dep[1];
    if(pos[a]==null||pos[b]==null) continue;
    if(pos[a] > pos[b]){ const A=SECTION_DEFS.find(s=>s.id===a), B=SECTION_DEFS.find(s=>s.id===b);
      showContentGuide("warn","Attention à l'ordre : « "+B.name+" » passe avant « "+A.name+" ». "+dep[2]);
      return;
    }
  }
}
function moveSection(id,dir){
  const order=currentOrder(); const i=order.indexOf(id), j=i+dir;
  if(i<0||j<0||j>=order.length) return;
  const a=secEl(order[i]), b=secEl(order[j]);
  if(dir<0) a.parentNode.insertBefore(a,b); else b.parentNode.insertBefore(b,a);
  draft.order=currentOrder(); markDirty(); renderSecList(); refreshSecToolbars(); orderGuidanceCheck();
}
function reorderSection(dragId, targetId, before){
  if(!dragId||dragId===targetId) return;
  const a=secEl(dragId), t=secEl(targetId); if(!a||!t) return;
  if(before) t.parentNode.insertBefore(a, t); else t.parentNode.insertBefore(a, t.nextSibling);
  draft.order=currentOrder(); markDirty(); renderSecList(); refreshSecToolbars(); orderGuidanceCheck();
}
/* réordonnancement maison : l'élément soulevé suit le curseur (léger rotate), les voisins s'écartent en douceur */
let secDrag=null;
function initSecDrag(item, id){
  item.addEventListener("pointerdown",(e)=>{
    if(e.button!==0 || (e.target.closest && e.target.closest("button"))) return;
    const sx=e.clientX, sy=e.clientY; let started=false;
    const move=(ev)=>{ if(!started){ if(Math.abs(ev.clientY-sy)<4 && Math.abs(ev.clientX-sx)<4) return; started=true; beginSecDrag(item, id, sy); } secDragMove(ev); };
    const up=(ev)=>{ document.removeEventListener("pointermove",move); document.removeEventListener("pointerup",up); if(started){ ev.preventDefault(); endSecDrag(); } else { scrollToSec(id); } };
    document.addEventListener("pointermove",move); document.addEventListener("pointerup",up);
  });
}
function beginSecDrag(item, id, startY){
  const wrap=item.parentNode, items=[...wrap.querySelectorAll(".sec-item")], rects=items.map(el=>el.getBoundingClientRect()), idx=items.indexOf(item);
  const step = rects.length>1 ? (rects[1].top-rects[0].top) : (rects[idx].height+8);
  secDrag={ item, id, items, rects, idx, startY, step, targetIdx:idx };
  document.body.classList.add("sec-sorting"); item.classList.add("sorting");
}
function secDragMove(ev){
  const d=secDrag; if(!d) return;
  const dy=ev.clientY-d.startY;
  d.item.style.transform="translateY("+dy+"px) rotate(2.2deg) scale(1.03)";
  const centerY=d.rects[d.idx].top + d.rects[d.idx].height/2 + dy;
  let ti=0; for(let i=0;i<d.items.length;i++){ const r=d.rects[i]; if(centerY > r.top + r.height/2) ti=i; }
  d.targetIdx=ti;
  d.items.forEach((el,i)=>{ if(el===d.item) return; let shift=0;
    if(d.idx < ti){ if(i>d.idx && i<=ti) shift=-d.step; }
    else if(d.idx > ti){ if(i>=ti && i<d.idx) shift=d.step; }
    el.style.transform = shift ? "translateY("+shift+"px)" : "";
  });
}
function endSecDrag(){
  const d=secDrag; secDrag=null; if(!d) return;
  document.body.classList.remove("sec-sorting");
  d.item.classList.remove("sorting"); d.item.style.transform="";
  d.items.forEach(el=>{ el.style.transform=""; });
  if(d.targetIdx!==d.idx){ const targetId=d.items[d.targetIdx].dataset.id; reorderSection(d.id, targetId, d.targetIdx<d.idx); }
}
function sectionIdOf(el){ const d=SECTION_DEFS.find(s=>secEl(s.id)===el); return d?d.id:null; }
function applySecHiddenVisual(el, hide){
  if(!el) return;
  el.classList.toggle("ck-hidden", !!hide);
  let ov=el.querySelector(":scope > .ck-hidden-ov");
  if(hide && !ov){ ov=DOC.createElement("button"); ov.type="button"; ov.className="ck-hidden-ov";
    ov.innerHTML='<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/></svg>Section masquée · cliquez pour la réafficher</span>';
    ov.addEventListener("click",(e)=>{ e.stopPropagation(); e.preventDefault(); const id=sectionIdOf(el); if(id) toggleSection(id,false); });
    el.appendChild(ov);
  } else if(!hide && ov){ ov.remove(); }
}
function toggleSection(id,hide){
  const el=secEl(id); if(!el) return;
  applySecHiddenVisual(el, hide);
  const set=new Set(draft.hidden); if(hide) set.add(id); else set.delete(id);
  draft.hidden=[...set]; markDirty(); renderSecList();
  const m=SEC_META[id]||{}, d=SECTION_DEFS.find(s=>s.id===id);
  if(hide){ let msg="Vous masquez « "+(d?d.name:"cette section")+" ». Elle n'apparaîtra plus sur le site publié.";
    if(m.apport) msg+=" Rappel : cette section sert à "+m.apport+".";
    showContentGuide(m.key?"bad":"warn", msg);
  } else { showContentGuide("good","« "+(d?d.name:"Section")+" » est de nouveau visible sur le site publié."); }
}
function applyDraft(){
  if(draft.order && draft.order.length){
    const first=editableEls()[0]; let anchor=first?first.previousElementSibling:null;
    if(anchor){ draft.order.forEach(id=>{ const el=secEl(id); if(el){ anchor.after(el); anchor=el; } }); }
  }
  (draft.hidden||[]).forEach(id=>{ applySecHiddenVisual(secEl(id), true); });
  setPromoVisible(!draft.promoHidden);
  setPromoSwitch(!draft.promoHidden);
  Object.keys(draft.dom).forEach(k=>{ const el=DOC.querySelector('[data-ckkey="'+cssEsc(k)+'"]'); if(el) el.innerHTML=draft.dom[k]; });
  Object.keys(draft.images).forEach(id=>{ const el=DOC.querySelector('[data-ckimg="'+id+'"]'); if(el) el.src=draft.images[id]; });
  BG_DEFS.forEach(b=>{ if(draft.bgImages[b.key]){ const el=DOC.querySelector(b.sel); if(el) el.style.backgroundImage='url("'+draft.bgImages[b.key]+'")'; } });
  applyLogos(); applyTestimonials(); applyPricingToPage(); applyLists();
  applyTextForLang();
}
function applyTextForLang(){
  const t=draft.text[currentLang]||{};
  Object.keys(t).forEach(k=>{ DOC.querySelectorAll('[data-i18n="'+cssEsc(k)+'"]').forEach(el=> el.textContent=t[k]); });
  const h=draft.html[currentLang]||{};
  Object.keys(h).forEach(k=>{ DOC.querySelectorAll('[data-i18n-html="'+cssEsc(k)+'"]').forEach(el=> el.innerHTML=h[k]); });
}

/* ---- editor right panel: sections ---- */
function renderSecList(){
  const wrap=document.getElementById("secList"); wrap.innerHTML="";
  if(editPage!=="accueil"){ wrap.innerHTML='<div class="sec-note"><i data-lucide="info"></i><span>Sur cette page, vous modifiez les <b>textes</b> et les <b>images</b> directement en cliquant dessus. La réorganisation et le masquage des sections sont disponibles sur l\'Accueil.</span></div>'; refreshIcons(); return; }
  const order=(DOC?currentOrder():SECTION_DEFS.map(s=>s.id));
  const hidden=new Set(draft.hidden);
  order.forEach((id,idx)=>{
    const def=SECTION_DEFS.find(s=>s.id===id); if(!def) return;
    const isHidden=hidden.has(id);
    const item=document.createElement("div"); item.className="sec-item"+(isHidden?" hidden":"");
    const m=SEC_META[id]||{}, ph=phaseInfo(m.phase);
    const tags='<span class="sec-tags"><span class="sec-ph" style="color:'+ph.col+';background:'+ph.bg+'">'+ph.label+'</span>'
      +(m.key?'<span class="sec-cle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>clé</span>':'')
      +(m.special?'<button type="button" class="sec-special" data-a="special">personnaliser</button>':'')+'</span>';
    item.innerHTML=
      '<span class="grip">'+
        '<button '+(idx===0?'disabled':'')+' data-a="up" aria-label="Monter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg></button>'+
        '<button '+(idx===order.length-1?'disabled':'')+' data-a="down" aria-label="Descendre"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>'+
      '</span>'+
      '<div class="sec-tx"><span class="nm">'+def.name+'</span>'+tags+'</div>'+
      '<button class="eye" data-a="eye" aria-label="'+(isHidden?'Afficher':'Masquer')+'">'+(isHidden?eyeOff():eyeOn())+'</button>';
    item.querySelector('[data-a="up"]').addEventListener("click",()=>moveSection(id,-1));
    item.querySelector('[data-a="down"]').addEventListener("click",()=>moveSection(id,1));
    item.querySelector('[data-a="eye"]').addEventListener("click",()=>toggleSection(id,!isHidden));
    /* le clic (tap sans drag) sur toute la ligne défile vers la section, géré dans initSecDrag */
    const sp=item.querySelector('[data-a="special"]'); if(sp) sp.addEventListener("click",(e)=>{ e.stopPropagation(); openSpecialEditor(m.special); });
    item.dataset.id=id; initSecDrag(item, id);
    wrap.appendChild(item);
  });
}
function scrollToSec(id){ const el=secEl(id); if(!el) return; el.scrollIntoView({behavior:"smooth",block:"start"}); el.classList.add("ck-sec-hl"); setTimeout(()=>el.classList.remove("ck-sec-hl"),1200); }
function eyeOn(){ return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z"/><circle cx="12" cy="12" r="3"/></svg>'; }
function eyeOff(){ return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M6.6 6.6A18 18 0 0 0 2 12s3 8 10 8a9 9 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/></svg>'; }

/* ---- summaries / dates ---- */
function nkeys(o){ return o?Object.keys(o).length:0; }
function changeCount(dr){
  const text=nkeys(dr.text&&dr.text.fr)+nkeys(dr.text&&dr.text.en)+nkeys(dr.html&&dr.html.fr)+nkeys(dr.html&&dr.html.en)+nkeys(dr.dom);
  const img=nkeys(dr.images)+nkeys(dr.bgImages);
  const sec=(dr.order?1:0)+((dr.hidden&&dr.hidden.length)||0)+(dr.promoHidden?1:0);
  const struct=(Array.isArray(dr.logos)?1:0)+(Array.isArray(dr.testimonials)?1:0)+(dr.pricing?1:0)+((dr.lists&&Object.keys(dr.lists).length)?1:0);
  return { text, img, sec, struct, total:text+img+sec+struct };
}
function humanSummary(dr){
  const parts=[]; const c=changeCount(dr);
  if(c.text) parts.push(c.text+" texte"+(c.text>1?"s":""));
  if(c.img) parts.push(c.img+" image"+(c.img>1?"s":""));
  if(dr.order) parts.push("sections réordonnées");
  const hid=(dr.hidden||[]).map(id=>{ const d=SECTION_DEFS.find(s=>s.id===id); return d?d.name:null; }).filter(Boolean);
  if(hid.length) parts.push(hid.join(", ")+" masquée"+(hid.length>1?"s":""));
  if(dr.promoHidden) parts.push("bandeau masqué");
  if(Array.isArray(dr.logos)) parts.push("logos de confiance");
  if(Array.isArray(dr.testimonials)) parts.push("témoignages");
  if(dr.pricing) parts.push("tarifs du simulateur");
  if(dr.lists && Object.keys(dr.lists).length) parts.push("points de listes");
  return parts.length?parts.join(", "):"aucune modification";
}
/* Résumé HONNÊTE pour la modale Publier : ce que buildSiteContent envoie RÉELLEMENT en ligne
   (textes i18n, images en URL https, tarifs, réglages assistant) — à distinguer de ce qui n'est
   enregistré QUE dans la version locale (structure/logos/témoignages/bandeau/HTML enrichi). */
function publishedSummary(dr){
  const parts=[];
  const t=nkeys(dr.text&&dr.text.fr)+nkeys(dr.text&&dr.text.en);
  if(t) parts.push(t+" texte"+(t>1?"s":""));
  let imgN=0; try{ Object.keys(dr.imgPub||{}).forEach(pk=>{ const m=dr.imgPub[pk]||{}; Object.keys(m).forEach(o=>{ if(/^https:\/\//i.test(m[o])) imgN++; }); }); }catch(e){}
  if(imgN) parts.push(imgN+" image"+(imgN>1?"s":""));
  if(dr.pricing) parts.push("tarifs du simulateur");
  try{ if(typeof chat==="object"&&chat&&((chat.forbidden&&chat.forbidden.length)||chat.tone||chat.instr||chat.botName||(chat.sources&&chat.sources.length))) parts.push("réglages de l'assistant"); }catch(e){}
  return parts.length?parts.join(", "):"aucun changement publiable";
}
function localOnlySummary(dr){
  const parts=[];
  if(dr.order) parts.push("réorganisation des sections");
  const hid=(dr.hidden||[]).map(id=>{ const d=SECTION_DEFS.find(s=>s.id===id); return d?d.name:null; }).filter(Boolean);
  if(hid.length) parts.push("section"+(hid.length>1?"s":"")+" masquée"+(hid.length>1?"s":"")+" ("+hid.join(", ")+")");
  if(dr.promoHidden || (dr.dom && (dr.dom["promo.text"]||dr.dom["promo.badge"]||dr.dom["promo.cta"]))) parts.push("bandeau promo");
  if(Array.isArray(dr.logos)) parts.push("logos de confiance");
  if(Array.isArray(dr.testimonials)) parts.push("témoignages");
  if(dr.lists && Object.keys(dr.lists).length) parts.push("points de listes");
  if(nkeys(dr.html&&dr.html.fr)+nkeys(dr.html&&dr.html.en)) parts.push("mise en forme de textes");
  if(dr.bgImages && Object.keys(dr.bgImages).length) parts.push("image de fond FAQ");
  return parts;
}
/* Nombre de médias en cours d'envoi / non encore stockés en ligne (dataURL local) : bloquent une
   publication complète des images tant qu'ils n'ont pas d'URL https persistante. */
function pendingUploadCount(dr){
  let n=0; try{ (dr.media||[]).forEach(m=>{ if(m&&m.kind==="image"&&(m.stored==="uploading"||m.stored==="local")&&/^data:/.test(m.src||"")) n++; }); }catch(e){}
  return n;
}
function fmtTime(d){ return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function fmtDate(iso){ const d=new Date(iso); if(isNaN(+d)) return "date inconnue"; return d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear()+", "+fmtTime(d); }
function fmtShort(iso){ const d=new Date(iso); return d.getDate()+" "+MONTHS[d.getMonth()]+" "+d.getFullYear(); }

/* ============================================================
   Dashboard / versions views
   ============================================================ */
function fillDashProgress(){ const el=document.getElementById("dashProgress"); if(!el||typeof PROGRESS==="undefined") return;
  const c={prod:0,preprod:0,dev:0}; PROGRESS.forEach(p=>{ if(c[p.env]!=null) c[p.env]++; });
  const sum='<div class="dash-av-sum">'+["prod","preprod","dev"].map(k=>c[k]?'<span class="dash-av-c"><span class="av-dot" style="background:'+APP_ENV[k].c+'"></span><b>'+c[k]+'</b> '+APP_ENV[k].lbl.toLowerCase()+'</span>':'').filter(Boolean).join("")+'</div>';
  const inProg=PROGRESS.filter(p=>p.stage!=="stable").slice(0,4);
  const rows=inProg.map(p=>{ const st=(typeof APP_STAGE_H!=="undefined"&&APP_STAGE_H[p.stage])?APP_STAGE_H[p.stage]:APP_STAGE[p.stage]; return '<div class="dash-av-row"><span class="dash-av-n">'+escHtml(p.name)+'</span><span class="av-stage" style="color:'+st.c+';background:'+st.c+'1e">'+st.lbl+'</span><span class="dash-av-v">v'+escHtml(p.version)+'</span></div>'; }).join("");
  el.innerHTML=sum+'<div class="dash-av-list">'+rows+'</div>';
  refreshIcons();
}
function updateDashboard(){
  const u=currentUser(), role=(u&&u.role)||"admin", first=((u&&u.name)||"").split(" ")[0];
  const g=document.getElementById("dashGreet"); if(g) g.textContent="Bonjour "+(first||"");
  const gd=document.getElementById("dashDate");
  if(gd){ const d=new Date(); const wd=WEEKDAYS[d.getDay()];
    gd.textContent=wd.charAt(0).toUpperCase()+wd.slice(1)+" "+d.getDate()+" "+MONTHS_FULL[d.getMonth()]+" "+d.getFullYear(); }
  const drole = role==="leadcommercial" ? "commercial" : role;
  renderDashHero(drole); renderDashStats(drole); renderDashPanels(drole); refreshIcons();
}
const HERO_IC={
  editor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  copilot:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/></svg>'
};
const DASH_ARROW='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
function renderDashHero(role){ const w=document.getElementById("dashHero"); if(!w) return;
  const h = role==="commercial"
    ? {ic:HERO_IC.copilot, title:"Piloter un rendez-vous", sub:"Choisissez un client, puis lancez le copilote : découverte, chiffrage et compte-rendu.", cta:"Voir mes clients", goto:"clients", grad:"linear-gradient(100deg,#12795f,#0b4a3b)"}
    : {ic:HERO_IC.editor, title:"Modifier le site", sub:"Textes, images, sections, bandeau promo.", cta:"Ouvrir l'éditeur", goto:"editor", grad:"linear-gradient(100deg,#3a2c6e,var(--ink))"};
  w.innerHTML='<div class="cta-card" style="background:'+h.grad+'"><div class="ic">'+h.ic+'</div><div><h3>'+h.title+'</h3><p>'+h.sub+'</p></div><button class="go" data-goto="'+h.goto+'">'+h.cta+' '+DASH_ARROW+'</button></div>';
  const b=w.querySelector("[data-goto]"); if(b) b.addEventListener("click",()=>showView(h.goto)); }
const DASH_ICOL={ teal:["#E1F5EE","#0F6E56"], purple:["#EEEDFE","#534AB7"], amber:["#FBF0DD","#9A6A15"], pink:["#FBEAF2","#B0518F"], blue:["#E6F1FB","#185FA5"] };
function dashTip(h, period, val, delta){ return '<div class="tt-h">'+h+'</div><div class="tt-row"><span>'+period+'</span><b>'+val+'</b></div><div class="tt-sub">'+delta+'</div>'; }
function renderDashStats(role){ const w=document.getElementById("dashStats"); if(!w) return; const c=changeCount(draft); let cards;
  if(role==="commercial") cards=[
    {k:"RDV à venir", v:"5", d:"2 cette semaine", ic:"calendar", col:"teal", goto:"rdv", ex:1},
    {k:"RDV honorés (30 j)", v:"18", ic:"calendar-check", col:"purple", ex:1, tip:dashTip("RDV honorés","30 derniers jours","18","exemple de démonstration")},
    {k:"Taux de conversion (30 j)", v:"34 %", ic:"trending-up", col:"amber", ex:1, tip:dashTip("Taux de conversion","30 derniers jours","34 %","exemple — nécessite les abonnements du back-office")}
  ];
  else if(role==="editor") cards=[
    {k:"Modifs en attente", v:String(c.total), d:c.total?"à publier":"tout est à jour", ic:"file-pen", col:"amber", goto:"editor"},
    {k:"Version en ligne", v:versions.length?versions[0].id:"—", d:versions.length?fmtShort(versions[0].date):"aucune", ic:"upload", col:"teal", goto:"versions"},
    {k:"Médiathèque", v:String(draft.media.length), d:"éléments", ic:"image", col:"purple", goto:"media"}
  ];
  else cards=[
    {k:"Visites (30 j)", v:"4 280", ic:"eye", col:"blue", ex:1, tip:dashTip("Visites","30 derniers jours","4 280","exemple — l'audience réelle est dans Statistiques")},
    {k:"Chatbot · conversations (30 j)", v:"1 248", ic:"message-square", col:"purple", ex:1, tip:dashTip("Conversations chatbot","30 derniers jours","1 248","exemple de démonstration")},
    {k:"Rendez-vous à venir", v:String(rdvUpcomingCount()), ic:"calendar", col:"teal", goto:"rdv"},
    {k:"Conversion des RDV (30 j)", v:"34 %", ic:"target", col:"amber", goto:"rdv", ex:1, tip:dashTip("Conversion des rendez-vous","RDV transformés en clients (30 j)","34 %","exemple — nécessite les abonnements du back-office")}
  ];
  w.style.gridTemplateColumns="repeat("+cards.length+",1fr)"; w.innerHTML="";
  cards.forEach(cd=>{ const el=document.createElement("div"); el.className="statc"+(cd.goto?" dash-clic":"")+(cd.tip?" tipped":"");
    const bc=DASH_ICOL[cd.col]||DASH_ICOL.teal;
    el.innerHTML='<div class="top"><div class="ic-badge" style="background:'+bc[0]+';color:'+bc[1]+';border-radius:9px"><i data-lucide="'+cd.ic+'"></i></div>'+(cd.ex?'<span class="ex-tag">exemple</span>':(cd.trend||""))+'</div><div class="k">'+cd.k+'</div><div class="v">'+cd.v+'</div>'+(cd.d?'<div class="d">'+cd.d+'</div>':'');
    if(cd.tip) el._tip=cd.tip;
    if(cd.goto) el.addEventListener("click",()=>showView(cd.goto));
    w.appendChild(el); }); }
function dashPanel(icon, title, bodyId, hic, moreView){ const more=moreView?'<button class="dash-more" type="button" data-goto="'+moreView+'">Tout voir <i data-lucide="arrow-right"></i></button>':''; return '<div class="dpan"><div class="pan-head"><h4><span class="hic '+(hic||"")+'"><i data-lucide="'+icon+'"></i></span> '+title+'</h4>'+more+'</div><div id="'+bodyId+'"></div></div>'; }
function renderDashPanels(role){ const w=document.getElementById("dashPanels"); if(!w) return;
  if(role==="editor"){ w.innerHTML='<div class="dash-grid">'+dashPanel("history","Versions récentes","dashVersions")+dashPanel("image","Médiathèque","dashMedia","violet")+'</div>'+dashPanel("clock","Activité récente","dashActivity","teal");
    fillDashVersions(); fillDashMedia(); fillDashActivity(); }
  else if(role==="commercial"){ w.innerHTML='<div class="dash-grid">'+dashPanel("calendar","Prochains rendez-vous","dashRdv","teal")+dashPanel("clipboard-check","Votre copilote","dashCop","violet")+'</div>'+dashLeadsPanelHtml();
    fillDashRdv(); fillDashCop(); loadDashLeads(); }
  else { const zbtn='<span class="zoomctl"><button class="zoom-btn" id="dashZoomOut" title="Dézoomer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg></button><button class="zoom-btn" id="dashZoomIn" title="Zoomer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button></span>';
    w.innerHTML='<div class="dash-grid dash-grid-21">'
      + '<div class="dpan"><div class="pan-head"><h4><span class="hic teal"><i data-lucide="trending-up"></i></span> Trafic du site</h4><div class="ch-hd-r"><span class="hint" id="dashChartHint" style="margin:0"></span>'+zbtn+'</div></div><svg class="lchart" id="dashChart" viewBox="0 0 700 176" preserveAspectRatio="none"></svg><div class="leg" id="dashChartLeg" style="margin-top:16px"></div></div>'
      + dashPanel("calendar","Prochains rendez-vous","dashRdv","amber","rdv")
    + '</div>'
      + dashLeadsPanelHtml()
    + '<div class="dash-grid">'
      + dashPanel("activity","Avancement du projet","dashProgress","teal","progress")
      + dashPanel("users","Utilisateurs & accès","dashTeam","violet","users")
    + '</div><div class="dash-grid">'
      + dashPanel("clock","Activité récente","dashActivity","purple")
      + dashPanel("megaphone","Bandeau promotionnel","dashBanner","amber")
    + '</div>';
    fillDashChart(); fillDashRdv(); fillDashActivity(); fillDashBanner(); fillDashTeam(); fillDashProgress(); loadDashLeads();
    w.querySelectorAll(".dash-more[data-goto]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.goto))); refreshIcons(); } }
let dashChartKey="30j";
function dashChartZoom(dir){ let i=STAT_ZOOM.indexOf(dashChartKey); if(i<0)i=STAT_ZOOM.indexOf("30j"); const ni=Math.min(STAT_ZOOM.length-1,Math.max(0,i+dir)); if(ni===i) return; dashChartKey=STAT_ZOOM[ni]; fillDashChart(); }
function fillDashChart(){ const svg=document.getElementById("dashChart"); if(!svg) return;
  const p=(typeof STAT_PERIODS!=="undefined")&&(STAT_PERIODS[dashChartKey]||STAT_PERIODS["30j"]); if(!p) return;
  const prev=p.chart.vals.map(v=>Math.round(v*0.88));
  drawLine(svg, p.chart.labels, p.chart.vals, prev, "Visites");
  const cur=p.chart.vals.reduce((a,b)=>a+b,0), pre=prev.reduce((a,b)=>a+b,0), delta=pre?Math.round((cur-pre)/pre*100):0;
  const hint=document.getElementById("dashChartHint"); if(hint) hint.innerHTML=trendChip(delta)+' <span style="color:var(--muted)">vs '+p.prevR+' · molette pour zoomer</span>';
  const leg=document.getElementById("dashChartLeg"); if(leg) leg.innerHTML='<span class="li"><span class="dot" style="background:#4BB3A4"></span><span class="li-k">'+p.label+'</span></span><span class="li"><span class="dot dash" style="background:#c4c9c4"></span><span class="li-k">Période précédente</span></span>';
  updateZoomBtns(STAT_ZOOM, dashChartKey, "dashZoomOut", "dashZoomIn");
  const zo=document.getElementById("dashZoomOut"); if(zo) zo.onclick=()=>dashChartZoom(1);
  const zi=document.getElementById("dashZoomIn"); if(zi) zi.onclick=()=>dashChartZoom(-1);
  if(!svg.dataset.wheel){ svg.dataset.wheel="1"; let t=0; svg.addEventListener("wheel",e=>{ e.preventDefault(); const now=Date.now(); if(now-t<200)return; t=now; dashChartZoom(e.deltaY>0?1:-1); },{passive:false}); } }
function fillDashVersions(){ const dv=document.getElementById("dashVersions"); if(!dv) return;
  if(!versions.length){ dv.innerHTML='<p class="hint" style="margin:0">Aucune version publiée. Cliquez « Publier » quand vos modifications sont prêtes.</p>'; return; }
  dv.innerHTML=""; versions.slice(0,3).forEach((v,i)=>{ const row=document.createElement("div"); row.className="ver-row";
    row.innerHTML='<span class="vid'+(i===0?" cur":"")+'">'+v.id+'</span><div class="vinfo"><div class="vd">'+fmtShort(v.date)+'</div><div class="vs">'+escHtml(v.summary||(v.changes&&v.changes[0])||"Mise à jour")+'</div></div>'+(i===0?'<span class="badge-live">en ligne</span>':'<button class="btn" data-restore="'+v.id+'">Restaurer</button>');
    const rb=row.querySelector("[data-restore]"); if(rb) rb.addEventListener("click",()=>restoreVersion(v.id)); dv.appendChild(row); }); }
function fillDashMedia(){ const dt=document.getElementById("dashMedia"); if(!dt) return;
  const imgs=draft.media.filter(m=>m.kind!=="video"&&m.src), list=imgs.slice(0,4); let h='<div class="dthumbs">';
  list.forEach(m=>h+='<div class="dthumb"><img src="'+escAttr(m.src)+'" alt=""></div>'); const extra=imgs.length-list.length; if(extra>0) h+='<div class="dthumb">+'+extra+'</div>'; h+='</div>';
  h+='<p class="hint" style="margin:9px 0 0">'+draft.media.length+' élément'+(draft.media.length>1?"s":"")+' dans la médiathèque</p>'; dt.innerHTML=h; }
function fillDashActivity(){ const da=document.getElementById("dashActivity"); if(!da) return;
  /* Activite reelle derivee des publications (variable `versions`), plus de flux invente. */
  const col="#0F6E56";
  const acts=(typeof versions!=="undefined"&&Array.isArray(versions)?versions:[]).slice(0,6).map(v=>{
    const ch=(v.changes&&v.changes.length)?v.changes:[v.summary||"Mise à jour"];
    return { who:v.author||"—", t:"a publié la version "+v.id, w:fmtDate(v.date), detail:ch.join(" · ") };
  });
  if(!acts.length){ da.innerHTML='<p class="hint" style="margin:0">Aucune publication pour l\'instant. L\'activité apparaîtra ici dès votre première publication.</p>'; return; }
  da.innerHTML=acts.map(a=>'<div class="dash-act"><button type="button" class="dash-act-hd"><span class="avatar xs" style="background:'+((commercialChip(a.who)||{}).color||col)+';color:#fff;margin-right:0">'+initials(a.who)+'</span><div class="dash-act-tx"><div class="dash-act-t"><b>'+escHtml(a.who.split(" ")[0]||a.who)+'</b> '+escHtml(a.t)+'</div><div class="dash-act-w">'+escHtml(a.w)+'</div></div><svg class="dash-act-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div class="dash-act-detail">'+escHtml(a.detail)+'</div></div>').join("");
  da.querySelectorAll(".dash-act-hd").forEach(hd=>hd.addEventListener("click",()=>hd.parentElement.classList.toggle("open"))); }
function commercialChip(name){ const u=adminUsers.find(x=>x.name===name||x.name.split(" ")[0]===String(name).split(" ")[0]);
  return { color:u?roleColor(u.role):"#0F6E56", ini:u?userInitials(u):initials(name), full:u?u.name:name }; }
function fillDashRdv(){ const el=document.getElementById("dashRdv"); if(!el) return;
  const up=(typeof rdvData!=="undefined"?rdvData:[]).filter(r=>r.st==="avenir").slice(0,5);
  if(!up.length){ el.innerHTML='<p class="hint" style="margin:0">Aucun rendez-vous à venir.</p>'; return; }
  el.innerHTML=up.map(r=>{ const c=commercialChip(r.who); const mi=r.mode==="visio"?{l:"Visio",i:"video",cls:"visio"}:{l:"Appel",i:"phone",cls:"tel"};
    return '<div class="dash-rdv"><div class="drr-main"><div class="drr-client" title="'+escHtml(r.client)+'">'+escHtml(r.client)+'</div><div class="drr-sub"><span class="drr-secteur">'+escHtml(r.secteur)+'</span><span class="drr-contact">'+escHtml(r.contact)+'</span></div></div>'
      +'<div class="drr-side"><div class="drr-date">'+r.day+' '+r.mon+' · '+r.time+'</div><div class="drr-meta"><span class="fmode fmode-'+mi.cls+'"><i data-lucide="'+mi.i+'"></i>'+mi.l+'</span><span class="avatar xs drr-com" style="background:'+c.color+';color:#fff" title="Commercial attitré : '+escHtml(c.full)+'">'+c.ini+'</span></div></div></div>'; }).join(""); }
/* ---- Demandes reçues (leads du formulaire « Commander » -> GET /api/crm) : RÉEL, repli SILENCIEUX ----
   Panneau caché par défaut : ne s'affiche que si des demandes réelles reviennent (pas de clé /
   endpoint absent / aucune demande -> reste masqué, la démo hors-ligne est intacte). */
function dashLeadsPanelHtml(){ return '<div class="dpan" id="dashLeadsPan" style="display:none;margin-top:16px"><div class="pan-head"><h4><span class="hic amber"><i data-lucide="inbox"></i></span> Demandes reçues</h4><span class="hint" id="dashLeadsHint" style="margin:0"></span></div><div id="dashLeads"></div></div>'; }
function dashLeadRow(l){
  var when=""; try{ when=new Date(l.receivedAt).toLocaleString("fr-CH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }catch(e){}
  var title=escHtml(l.company||l.contact||"Demande");
  var subBits=[]; if(l.company&&l.contact) subBits.push(escHtml(l.contact)); if(l.summary) subBits.push(escHtml(l.summary));
  if(l.newsletter) subBits.push('<span class="ex-tag" style="color:#0F6E56;background:#E1F5EE">newsletter ok</span>');   // consentement opt-in donné à la commande
  var links=[];
  if(l.email) links.push('<a class="lead-lnk" href="mailto:'+escAttr(l.email)+'"><i data-lucide="mail"></i>'+escHtml(l.email)+'</a>');
  if(l.phone) links.push('<a class="lead-lnk" href="tel:'+escAttr(String(l.phone).replace(/\s+/g,""))+'"><i data-lucide="phone"></i>'+escHtml(l.phone)+'</a>');
  var lk=cliKeyFor({company:l.company,email:l.email,contact:l.contact});
  return '<div class="lead-row'+(lk?' lead-clic':'')+'"'+(lk?' data-lk="'+escAttr(lk)+'" title="Ouvrir la fiche client"':'')+'><div class="lead-main"><div class="lead-co">'+title+'</div>'+(subBits.length?'<div class="lead-sub">'+subBits.join(" · ")+'</div>':'')+(links.length?'<div class="lead-links">'+links.join("")+'</div>':'')+'</div><div class="lead-when">'+escHtml(when)+'</div></div>';
}
async function loadDashLeads(){
  var pan=document.getElementById("dashLeadsPan"), body=document.getElementById("dashLeads"); if(!body) return;
  try{
    var key=getStoredPublishKey(); if(!key) return;               // non connecté -> panneau caché (démo intacte)
    var r=await fetch("/api/crm?days=60",{headers:{Authorization:"Bearer "+key}}); if(!r.ok) return;
    var j=await r.json(); var leads=(j&&Array.isArray(j.leads))?j.leads:[];
    if(!leads.length) return;                                     // aucune demande -> reste caché
    body.innerHTML=leads.slice(0,8).map(dashLeadRow).join("");
    body.querySelectorAll(".lead-row[data-lk]").forEach(function(row){ row.addEventListener("click",function(){ openClientCard(row.dataset.lk); }); });
    body.querySelectorAll(".lead-lnk").forEach(function(a){ a.addEventListener("click",function(e){ e.stopPropagation(); }); }); // mail/tel : ne pas ouvrir la fiche
    var hint=document.getElementById("dashLeadsHint"); if(hint) hint.textContent=leads.length+" demande"+(leads.length>1?"s":"")+" (60 j)";
    if(pan) pan.style.display=""; refreshIcons();
  }catch(e){ /* silencieux : démo / hors-ligne intacte */ }
}
/* ---- Bandeaux : plusieurs bandeaux enregistres + modeles prets a l'emploi, un seul actif a la fois ---- */
const BANNER_PRESETS=[
  {name:"Lancement", badge:"Nouveau site", emphasis:"-15%", text:"sur votre premier mois avec Flex & Dédié", cta:"Découvrir nos offres", href:"#offres", code:"FLEX15"},
  {name:"Suivi en direct", badge:"Nouveau", emphasis:"", text:"Suivez votre livraison en temps réel, du départ à la remise", cta:"En savoir plus", href:"#services", code:""},
  {name:"Offre de rentrée", badge:"Offre limitée", emphasis:"-20%", text:"sur l'abonnement Dédié jusqu'à fin septembre", cta:"J'en profite", href:"#offres", code:"DEDIE20"},
  {name:"Recrutement", badge:"On recrute", emphasis:"", text:"Coursiers en CDI à Genève et Lausanne, salaire fixe", cta:"Postuler", href:"postuler.html", code:""}
];
function ensureBanners(){
  if(!Array.isArray(draft.banners)||!draft.banners.length){
    draft.banners=BANNER_PRESETS.map((b,i)=>Object.assign({id:"b"+(i+1)}, b, {from:"",to:""}));
    if(draft.promo&&draft.promo.label){ draft.banners[0].emphasis=""; draft.banners[0].text=draft.promo.label; if(draft.promo.code) draft.banners[0].code=draft.promo.code; draft.banners[0].from=draft.promo.from||""; draft.banners[0].to=draft.promo.to||""; }
    draft.activeBannerId=draft.activeBannerId||draft.banners[0].id;
  }
  if(!draft.banners.some(b=>b.id===draft.activeBannerId)) draft.activeBannerId=draft.banners[0].id;
  return draft.banners;
}
function activeBanner(){ ensureBanners(); return draft.banners.find(b=>b.id===draft.activeBannerId)||draft.banners[0]; }
function applyBannerToBar(){ const b=activeBanner(); if(!b) return;
  draft.dom["promo.badge"]=escHtml(b.badge||"");
  draft.dom["promo.text"]=(b.emphasis?'<strong>'+escHtml(b.emphasis)+'</strong> ':'')+escHtml(b.text||"");
  draft.dom["promo.cta"]=escHtml(b.cta||"");
  if(typeof DOC!=="undefined" && DOC){
    const bd=DOC.querySelector(".promo-bar-badge"); if(bd){ bd.innerHTML=draft.dom["promo.badge"]; bd.style.display=b.badge?"":"none"; }
    const tx=DOC.querySelector(".promo-bar-text"); if(tx) tx.innerHTML=draft.dom["promo.text"];
    const ct=DOC.querySelector(".promo-bar-cta"); if(ct){ ct.textContent=b.cta||""; ct.style.display=b.cta?"":"none"; if(b.href) ct.setAttribute("href",b.href); }
  }
}
function activateBanner(id){ ensureBanners(); if(!draft.banners.some(b=>b.id===id)) return; draft.activeBannerId=id; applyBannerToBar(); markDirty(); fillDashBanner(); }
function addBannerFromPreset(i){ const p=BANNER_PRESETS[i]; if(!p) return; const b=Object.assign({id:"b"+Date.now()}, p, {from:"",to:""}); ensureBanners(); draft.banners.push(b); draft.activeBannerId=b.id; applyBannerToBar(); markDirty(); fillDashBanner(); toast("Bandeau « "+p.name+" » ajouté"); }
function addBlankBanner(){ ensureBanners(); const b={id:"b"+Date.now(), name:"Nouveau bandeau", badge:"", emphasis:"", text:"", cta:"", href:"#offres", code:"", from:"", to:""}; draft.banners.push(b); draft.activeBannerId=b.id; applyBannerToBar(); markDirty(); fillDashBanner(); }
function deleteBanner(id){ ensureBanners(); if(draft.banners.length<=1){ toast("Gardez au moins un bandeau"); return; } const b=draft.banners.find(x=>x.id===id); if(!b) return; if(!confirm("Supprimer le bandeau « "+(b.name||"sans nom")+" » ?")) return;
  draft.banners=draft.banners.filter(x=>x.id!==id); if(draft.activeBannerId===id){ draft.activeBannerId=draft.banners[0].id; applyBannerToBar(); } markDirty(); fillDashBanner(); toast("Bandeau supprimé"); }
function fillDashBanner(){ const el=document.getElementById("dashBanner"); if(!el) return; ensureBanners();
  const on=!draft.promoHidden, b=activeBanner(), preview=(b.emphasis?b.emphasis+" ":"")+(b.text||"")||"Bandeau sans texte";
  const chips=draft.banners.map(x=>'<button type="button" class="dbn-chip'+(x.id===b.id?" on":"")+'" data-act="'+x.id+'">'+escHtml(x.name||"Sans nom")+'</button>').join("");
  const presets=BANNER_PRESETS.map((p,i)=>'<button type="button" class="dbn-preset" data-preset="'+i+'"><i data-lucide="plus"></i>'+escHtml(p.name)+'</button>').join("");
  el.innerHTML='<div class="dbn-row"><button class="switch'+(on?" on":"")+'" id="dbnSwitch" role="switch" aria-checked="'+on+'"><span class="k"></span></button><div class="dbn-tx"><span class="dbn-t">Bandeau '+(on?"affiché":"masqué")+'</span><span class="dbn-s">'+escHtml(preview)+'</span></div></div>'
    +'<div class="dbn-manage"><div class="dbn-manage-hd"><span>Vos bandeaux</span><button type="button" class="dbn-newbtn" id="dbnNew"><i data-lucide="plus"></i>Vide</button></div>'
      +'<div class="dbn-chips">'+chips+'</div>'
      +'<div class="dbn-presets"><span class="dbn-presets-l">Modèles</span>'+presets+'</div></div>'
    +'<div class="dbn-form">'
      +'<div class="formf" style="margin:0"><label>Nom du bandeau <span class="dbn-hint">(interne, pour vous)</span></label><input id="dbnName" value="'+escHtml(b.name||"")+'" placeholder="Ex. Offre de rentrée"></div>'
      +'<div class="form-row" style="margin:0"><div class="formf" style="margin:0"><label>Étiquette</label><input id="dbnBadge" value="'+escHtml(b.badge||"")+'" placeholder="Nouveau site"></div><div class="formf" style="margin:0"><label>Accroche en gras <span class="dbn-hint">(optionnel)</span></label><input id="dbnEmph" value="'+escHtml(b.emphasis||"")+'" placeholder="-15%"></div></div>'
      +'<div class="formf" style="margin:0"><label>Texte du bandeau</label><input id="dbnText" value="'+escHtml(b.text||"")+'" placeholder="sur votre premier mois avec Flex & Dédié"></div>'
      +'<div class="form-row" style="margin:0"><div class="formf" style="margin:0"><label>Bouton</label><input id="dbnCta" value="'+escHtml(b.cta||"")+'" placeholder="Découvrir nos offres"></div><div class="formf" style="margin:0"><label>Lien du bouton</label><input id="dbnHref" value="'+escHtml(b.href||"")+'" placeholder="#offres"></div></div>'
      +'<div class="dbn-dates"><div class="formf" style="margin:0"><label>Code promo</label><input id="dbnCode" value="'+escHtml(b.code||"")+'" placeholder="FLEX15" style="text-transform:uppercase"></div><div class="formf" style="margin:0"><label>Du</label><input type="date" id="dbnFrom" value="'+escHtml(b.from||"")+'"></div><div class="formf" style="margin:0"><label>Au</label><input type="date" id="dbnTo" value="'+escHtml(b.to||"")+'"></div></div>'
      +'<div class="dbn-actions"><span class="dbn-live">Modifications appliquées en direct sur le site</span><button type="button" class="btn ghost dbn-del" id="dbnDel"><i data-lucide="trash-2"></i>Supprimer</button></div>'
    +'</div>';
  const sw=document.getElementById("dbnSwitch"); if(sw) sw.addEventListener("click",()=>{ const nowOn=!sw.classList.contains("on"); if(typeof setPromoSwitch==="function") setPromoSwitch(nowOn); draft.promoHidden=!nowOn; setPromoVisible(nowOn); markDirty(); fillDashBanner(); });
  el.querySelectorAll("[data-act]").forEach(c=>c.addEventListener("click",()=>activateBanner(c.dataset.act)));
  el.querySelectorAll("[data-preset]").forEach(p=>p.addEventListener("click",()=>addBannerFromPreset(+p.dataset.preset)));
  const nb=document.getElementById("dbnNew"); if(nb) nb.addEventListener("click",addBlankBanner);
  const dl=document.getElementById("dbnDel"); if(dl) dl.addEventListener("click",()=>deleteBanner(b.id));
  const bind=(id,key,up)=>{ const inp=document.getElementById(id); if(!inp) return; inp.addEventListener("input",()=>{ let v=inp.value; if(up) v=v.toUpperCase(); b[key]=v; applyBannerToBar(); markDirty();
    const pv=el.querySelector(".dbn-s"); if(pv&&(key==="text"||key==="emphasis")) pv.textContent=(b.emphasis?b.emphasis+" ":"")+(b.text||"");
    const chip=el.querySelector('.dbn-chip.on'); if(chip&&key==="name") chip.textContent=v||"Sans nom"; }); };
  bind("dbnName","name"); bind("dbnBadge","badge"); bind("dbnEmph","emphasis"); bind("dbnText","text"); bind("dbnCta","cta"); bind("dbnHref","href"); bind("dbnCode","code",true);
  const fr=document.getElementById("dbnFrom"); if(fr) fr.addEventListener("change",()=>{ b.from=fr.value; markDirty(); });
  const to=document.getElementById("dbnTo"); if(to) to.addEventListener("change",()=>{ b.to=to.value; markDirty(); });
  refreshIcons(); }
function fillDashCop(){ const el=document.getElementById("dashCop"); if(!el) return;
  el.innerHTML='<p class="hint" style="margin:0 0 11px">Préparez votre prochain rendez-vous : découverte guidée, chiffrage en direct et compte-rendu prêt en partant.</p><button class="btn primary" data-goto="copilot" style="width:100%;justify-content:center">Ouvrir le copilote</button>';
  const b=el.querySelector("[data-goto]"); if(b) b.addEventListener("click",()=>showView("copilot")); }
function fillDashTeam(){ const el=document.getElementById("dashTeam"); if(!el) return; const byRole={}; adminUsers.forEach(u=>byRole[u.role]=(byRole[u.role]||0)+1);
  const PLUR={admin:["administrateur","administrateurs"],commercial:["commercial","commerciaux"],leadcommercial:["lead commercial","leads commerciaux"],editor:["éditeur","éditeurs"]};
  const legend=ROLE_ORDER.filter(r=>byRole[r]).map(r=>'<span class="dash-team-lg"><span class="dot" style="background:'+roleColor(r)+'"></span>'+byRole[r]+' '+(PLUR[r]||[r,r])[byRole[r]>1?1:0]+'</span>').join("");
  el.innerHTML='<div class="dash-team-avas">'+adminUsers.slice(0,7).map((u,i)=>'<span class="avatar sm" style="background:'+roleColor(u.role)+';color:#fff;margin-left:'+(i?"-9px":"0")+';box-shadow:0 0 0 2px var(--panel)" title="'+escHtml(u.name)+' · '+roleLabel(u.role)+'">'+initials(u.name)+'</span>').join("")+'</div>'
    +'<div class="dash-team-legend">'+legend+'</div>'
    +'<button class="btn" data-goto="users">Gérer les accès</button>';
  const b=el.querySelector("[data-goto]"); if(b) b.addEventListener("click",()=>showView("users")); }
const DASH_CHANGELOG=[
  {icon:"bot", t:"Chatbot repensé", d:"Cartes santé, tiroirs de détail et zoom par période", tag:"Amélioré"},
  {icon:"calendar-check", t:"Rendez-vous", d:"Fiche unifiée, interlocuteur et graphiques Calendly", tag:"Amélioré"},
  {icon:"gauge", t:"Page Performance", d:"Suivi SEO, accessibilité et rapidité du site", tag:"Nouveau"},
  {icon:"compass", t:"Copilote RDV", d:"Assistant commercial en rendez-vous : découverte guidée, chiffrage, compte-rendu", tag:"Nouveau"},
  {icon:"handshake", t:"Page Affiliation", d:"Partenaires (restaurants, commerces…), avantages et jeux concours", tag:"Nouveau"},
  {icon:"bar-chart-3", t:"Statistiques", d:"Vue analytics du site validée", tag:"Amélioré"}
];
function humanChanges(dr){ const c=changeCount(dr), parts=[];
  if(c.text) parts.push(c.text+" texte"+(c.text>1?"s":"")+" modifié"+(c.text>1?"s":""));
  if(c.img) parts.push(c.img+" image"+(c.img>1?"s":"")+" remplacée"+(c.img>1?"s":""));
  if(dr.order) parts.push("Sections réordonnées");
  const hid=(dr.hidden||[]).map(id=>{ const d=SECTION_DEFS.find(s=>s.id===id); return d?d.name:null; }).filter(Boolean);
  if(hid.length) parts.push("Section masquée : "+hid.join(", "));
  if(dr.promoHidden) parts.push("Bandeau promo masqué"); else if(dr.dom && dr.dom["promo.text"]) parts.push("Bandeau promo mis à jour");
  if(Array.isArray(dr.logos)) parts.push("Logos de confiance mis à jour");
  if(Array.isArray(dr.testimonials)) parts.push("Témoignages mis à jour");
  if(dr.pricing) parts.push("Tarifs du simulateur mis à jour");
  if(dr.lists && Object.keys(dr.lists).length) parts.push("Points de listes modifiés");
  return parts.length?parts:["Petites retouches"]; }
function renderVersions(){ renderVersionsOnline(); const vl=document.getElementById("versionList"); if(!vl) return; vl.className="vtl"; vl.innerHTML="";
  const c=changeCount(draft);
  const q=(verQuery||"").trim().toLowerCase(), filtering=(!!q||verPinnedOnly);
  // Tête « brouillon » : c'est l'état courant (pas une version de l'historique), affiché hors filtre uniquement.
  if(!filtering){
    const head=document.createElement("div"); head.className="vtl-item";
    head.innerHTML='<div class="vtl-rail"><span class="vtl-dot draft"></span></div>'
      +'<div class="vtl-card draft"><div class="vtl-hd"><span class="vtl-id draft">Brouillon</span><span class="vtl-badge draft">Non publié</span><span class="vtl-sp"></span>'+(c.total?'<button class="btn primary sm" id="vlPublish"><i data-lucide="upload"></i>Publier</button>':'<span class="hint" style="margin:0">à jour</span>')+'</div>'
      +(c.total?'<ul class="vtl-changes">'+humanChanges(draft).map(x=>'<li>'+escHtml(x)+'</li>').join("")+'</ul>':'<div class="vtl-empty">Aucune modification non publiée.</div>')+'</div>';
    vl.appendChild(head);
    const hp=head.querySelector("#vlPublish"); if(hp) hp.addEventListener("click",openPublish);
  }
  let list=versions.map((v,i)=>({v:v,live:i===0}));
  if(verPinnedOnly) list=list.filter(x=>x.v.pinned);
  if(q) list=list.filter(x=>{ const hay=[x.v.id||"",x.v.author||"",fmtDate(x.v.date)].concat(x.v.changes||[],[x.v.summary||""]).join(" ").toLowerCase(); return hay.indexOf(q)>=0; });
  if(!list.length){ const e=document.createElement("div"); e.className="vtl-empty"; e.style.padding="6px 0";
    e.textContent=(verPinnedOnly&&!q)?"Aucune version épinglée pour l'instant.":"Aucune version ne correspond à votre recherche."; vl.appendChild(e); refreshIcons(); return; }
  list.forEach(function(x){ const v=x.v, live=x.live, changes=(v.changes&&v.changes.length)?v.changes:[v.summary||"Mise à jour"];
    const it=document.createElement("div"); it.className="vtl-item";
    it.innerHTML='<div class="vtl-rail"><span class="vtl-dot'+(live?" live":"")+'"></span></div>'
      +'<div class="vtl-card"><div class="vtl-hd"><span class="vtl-id">'+escHtml(v.id)+'</span>'+(live?'<span class="vtl-badge live">En ligne</span>':'<span class="vtl-badge">Précédente</span>')+(v.pinned?'<span class="vtl-badge" style="background:#E1F5EE;color:#0F6E56">Épinglée</span>':'')+'<span class="vtl-date">'+fmtDate(v.date)+(v.author?' · '+escHtml(v.author):"")+'</span><span class="vtl-sp"></span><button class="btn ghost sm" data-pin="'+escHtml(v.id)+'" title="'+(v.pinned?"Retirer l’épingle":"Épingler cette version (la garder en avant)")+'"'+(v.pinned?' style="color:#0F6E56"':'')+'><i data-lucide="pin"></i></button></div>'
      +'<ul class="vtl-changes">'+changes.map(y=>'<li>'+escHtml(y)+'</li>').join("")+'</ul>'
      +'<div class="vtl-acts">'+(live?'':'<button class="vtl-restore" data-restore="'+escHtml(v.id)+'"><i data-lucide="rotate-ccw"></i>Restaurer cette version</button>')+'<button class="btn ghost sm" data-prev="'+escHtml(v.id)+'"><i data-lucide="eye"></i>Prévisualiser</button>'+(live?'':'<span class="vtl-restore-note"><i data-lucide="corner-up-left"></i>remet le site dans cet état</span>')+'</div></div>';
    const pv=it.querySelector("[data-prev]"); if(pv) pv.addEventListener("click",()=>previewVersion(v.id));
    const rb=it.querySelector("[data-restore]"); if(rb) rb.addEventListener("click",()=>restoreVersion(v.id));
    const pn=it.querySelector("[data-pin]"); if(pn) pn.addEventListener("click",()=>toggleVersionPin(v.id));
    vl.appendChild(it); });
  refreshIcons();
}
function toggleVersionPin(id){ const v=versions.find(x=>x.id===id); if(!v) return; v.pinned=!v.pinned; saveVersions(); toast(v.pinned?"Version épinglée":"Épingle retirée"); renderVersions(); }
/* Historique RÉEL des publications (commits de site-content.json), lu via /api/history.
   Repli silencieux : sans clé, ou si l'endpoint n'existe pas (aperçu local, non déployé),
   le panneau se masque et seule la chronologie locale ci-dessous reste (démo intacte). */
function fetchOnlineVersions(cb){
  const key=getStoredPublishKey();
  if(!key){ _onlineVer=null; _onlineVerLoaded=true; _onlineVerErr="nokey"; if(cb) cb(); return; }
  fetch("/api/history",{ headers:{ "Authorization":"Bearer "+key }, cache:"no-store" })
    .then(r=>r.ok?r.json():Promise.reject(r.status))
    .then(d=>{ _onlineVer=(d&&d.versions)||[]; _onlineVerLoaded=true; _onlineVerErr=null; if(cb) cb(); })
    .catch(err=>{ _onlineVer=null; _onlineVerLoaded=true; _onlineVerErr=String(err); if(cb) cb(); });
}
function renderVersionsOnline(forceReload){
  const w=document.getElementById("versionsOnline"); if(!w) return;
  if(!getStoredPublishKey()){ w.style.display="none"; w.innerHTML=""; return; }
  if(!_onlineVerLoaded || forceReload){
    w.style.display=""; w.innerHTML='<div class="pan-head"><h4><span class="hic teal"><i data-lucide="globe"></i></span> Versions publiées en ligne</h4></div><p class="hint" style="margin:0">Chargement de l\'historique…</p>'; refreshIcons();
    fetchOnlineVersions(()=>paintOnlineVersions(w)); return;
  }
  paintOnlineVersions(w);
}
function paintOnlineVersions(w){
  const list=_onlineVerErr?[]:(_onlineVer||[]);
  if(!list.length){ w.style.display="none"; w.innerHTML=""; return; }
  w.style.display="";
  const rows=list.map(function(v,i){
    const cur=(i===0);
    let dt="—"; try{ if(v.date) dt=new Date(v.date).toLocaleString("fr-CH",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }catch(e){}
    let msg=(v.message||"").replace(/^publish\s+/i,"").replace(/^restore\s+/i,"retour à ");
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 2px;border-top:1px solid #EEF0EE;font-size:14px">'
      +'<span style="min-width:152px;color:var(--muted,#6b6f6b);font-size:13px">'+escHtml(dt)+'</span>'
      +'<span style="flex:1;min-width:120px">'+escHtml(msg||v.shortSha||"")+(cur?' <span class="vtl-badge live" style="margin-left:4px">en ligne</span>':'')+'<span style="color:var(--muted,#8a8c89);font-size:12px"> · '+escHtml(v.author||"")+'</span></span>'
      +(cur?'':'<button class="btn ghost sm" data-restore-sha="'+escHtml(v.sha||"")+'"><i data-lucide="rotate-ccw"></i>Restaurer</button>')
      +'</div>';
  }).join("");
  w.innerHTML='<div class="pan-head"><h4><span class="hic teal"><i data-lucide="globe"></i></span> Versions publiées en ligne</h4><span class="hint" style="margin:0">l\'historique réel de vos mises en ligne</span></div><div>'+rows+'</div>';
  w.querySelectorAll("[data-restore-sha]").forEach(b=>b.addEventListener("click",()=>restoreOnlineVersion(b.getAttribute("data-restore-sha"))));
  refreshIcons();
}
function restoreOnlineVersion(sha){
  if(!sha) return;
  if(!confirm("Restaurer cette version ? Le site public reviendra à cet état. Une nouvelle version est créée, rien n'est perdu (on peut revenir en avant).")) return;
  const key=getStoredPublishKey(); if(!key){ toast("Clé de publication requise."); return; }
  toast("Restauration en cours…");
  fetch("/api/restore",{ method:"POST", headers:{ "Authorization":"Bearer "+key, "Content-Type":"application/json" }, body:JSON.stringify({sha:sha}) })
    .then(r=>r.json().then(d=>({s:r.status,d:d})).catch(()=>({s:r.status,d:{}})))
    .then(o=>{
      if(o.s===200){ toast("Version restaurée. Le site revient à cet état dans une minute environ."); renderVersionsOnline(true); }
      else if(o.s===401){ setStoredPublishKey(""); toast("Clé refusée. Ressaisissez-la à la prochaine publication."); }
      else if(o.s===409){ toast("Quelqu'un vient de publier. Rechargez, puis réessayez."); }
      else { toast("Restauration impossible ("+((o.d&&o.d.error)||o.s)+")."); }
    })
    .catch(()=>toast("Restauration impossible depuis cet aperçu (à faire sur le site en ligne)."));
}
(function wireVersionTools(){
  const s=document.getElementById("verSearch"); if(s) s.addEventListener("input",function(){ verQuery=s.value||""; renderVersions(); });
  const pf=document.getElementById("verPinFilter"); if(pf) pf.addEventListener("click",function(){ verPinnedOnly=!verPinnedOnly; pf.style.background=verPinnedOnly?"#E1F5EE":""; pf.style.color=verPinnedOnly?"#0F6E56":""; renderVersions(); });
})();
/* ============================================================
   Journal des versions (notes de version produit) : ce qui a été
   ajouté, corrigé, amélioré au fil des versions, plus le reste à faire.
   Badges de couleur pour distinguer ajout / correctif / amélioration.
   À TENIR À JOUR à chaque nouvelle passe (comme le plan de faisabilité).
   ============================================================ */
const REL_TYPES={ add:{lbl:"Ajout",c:"add",ic:"plus"}, fix:{lbl:"Correctif",c:"fix",ic:"wrench"}, imp:{lbl:"Amélioration",c:"imp",ic:"sparkles"} };
const REL_MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const RELEASE_LOG=[
  { v:"v0.57.1", cur:true, date:"2026-07-21", title:"Site : le bouton principal vend la consultation", items:[
    {t:"imp", x:"« Planifier un appel gratuit » devient « Réserver ma consultation offerte » (hero, bouton flottant, pied de page, menu) : même action, mais présentée comme une valeur reçue — cohérent avec la pastille « créneaux de rendez-vous » et la section « Votre consultation logistique offerte » (FR + EN)"}
  ]},
  { v:"v0.57.0", date:"2026-07-21", title:"Site vitrine : retours client (lot validé)", items:[
    {t:"imp", x:"Accueil : la pastille du haut annonce des « créneaux de rendez-vous » (plus d'ambiguïté avec la livraison) et son chiffre suit le vrai calendrier ; « Coursier(e)s salarié(e)s » remplace « en CDI » (aussi dans les descriptions Google) ; compteur « 7 villes »"},
    {t:"imp", x:"Accueil : la grande photo (Genève) devient une vraie image remplaçable depuis la médiathèque — le client pourra fournir la sienne (couvrant les 2 cantons)"},
    {t:"add", x:"Commander : taille/poids et description du colis (optionnel), adresse de facturation différente (repliée derrière une case), et case « recevoir les actualités » (décochée par défaut) — le consentement remonte avec la demande et s'affiche dans l'admin"},
    {t:"fix", x:"Réservation : le calendrier de démonstration reste actif tant que le vrai Calendly n'a pas confirmé son chargement (hors-ligne, la démo reste cliquable ; plus de date figée périmée)"}
  ]},
  { v:"v0.56.0", date:"2026-07-21", title:"Filtres clients : contenu revu (même fenêtre)", items:[
    {t:"imp", x:"Dans la fenêtre Filtres : Commercial et Secteur deviennent des listes à cocher RECHERCHABLES (elles tiennent quand l'équipe ou les secteurs se multiplient), au lieu d'une rangée de pastilles"},
    {t:"add", x:"« Dernière activité » : on choisit une plage de dates précise (du / au), avec des raccourcis facultatifs — plus de dates imposées"},
    {t:"add", x:"Filtrer par statut (multiple) et par offre, + raccourcis métier : à relancer, RDV à venir, sans commercial attribué, avec compte-rendu"}
  ]},
  { v:"v0.55.0", date:"2026-07-21", title:"Compte-rendu : rédaction après coup", items:[
    {t:"add", x:"On peut maintenant rédiger (ou modifier) le compte-rendu d'un rendez-vous directement depuis sa fiche, même sans être passé par le copilote — utile pour un rendez-vous sur place ou noté après coup. Il est daté et rattaché au rendez-vous."}
  ]},
  { v:"v0.54.0", date:"2026-07-21", title:"Fiche client & filtres : refonte design", items:[
    {t:"imp", x:"Fiche client remise au propre : hiérarchie claire (intitulés discrets, valeurs lisibles), séparateurs entre sections et espacement régulier"},
    {t:"imp", x:"Relance : le choix du modèle de message se fait via un menu à droite de l'objet (il remplit objet et message d'un coup), au lieu d'une rangée de boutons"},
    {t:"imp", x:"Le menu de statut reprend les couleurs des badges du tableau (pastille + surbrillance au survol)"},
    {t:"add", x:"Filtres clients enrichis façon métier : vues rapides « à relancer » et « RDV à venir », tranche de dates (dernière activité), en plus de commercial / secteur / offre"}
  ]},
  { v:"v0.53.0", date:"2026-07-21", title:"Chiffres honnêtes : réels quand possible, sinon « exemple »", items:[
    {t:"imp", x:"Tableau de l'équipe (Rendez-vous) : rendez-vous et taux de présence calculés sur vos VRAIS rendez-vous dès que Calendly est connecté ; sinon chiffres d'exemple. Jean-Christophe apparaît désormais dans le tableau."},
    {t:"imp", x:"Le taux de conversion est clairement marqué « exemple » partout : il n'est pas calculable sans les données d'abonnement du back-office (jamais inventé)"},
    {t:"imp", x:"Les chiffres de démonstration sont étiquetés « exemple » là où ils apparaissent (tableau de bord, statistiques, chatbot, équipe commerciale) pour ne rien laisser croire de faux"}
  ]},
  { v:"v0.52.0", date:"2026-07-21", title:"Clients : fiche outil + relance intégrée + filtres à puces", items:[
    {t:"add", x:"Relance par e-mail directement dans la fiche : modèles de messages prêts à l'emploi et modifiables, ouverture de votre messagerie pré-remplie, et la relance est horodatée"},
    {t:"add", x:"Résumé en tête de fiche : nombre de rendez-vous, dernier rendez-vous, dernière relance et prochaine étape en un coup d'œil"},
    {t:"imp", x:"Fenêtre de filtres repensée : sélection par pastilles (avatars des commerciaux, secteurs, offres) au lieu des menus déroulants"}
  ]},
  { v:"v0.51.1", date:"2026-07-21", title:"Correctif : fenêtres transparentes", items:[
    {t:"fix", x:"Les fenêtres (fiche client, Filtres, thème) s'affichaient sans fond, laissant voir la page derrière : leur fond blanc et leur ombre sont rétablis"}
  ]},
  { v:"v0.51.0", date:"2026-07-21", title:"Clients : sélection multiple + suivi qui/quand", items:[
    {t:"add", x:"Sélection multiple dans le tableau (cases à cocher + « tout sélectionner ») avec barre d'actions groupées : relancer la sélection en un e-mail (destinataires en copie cachée) ou changer le statut de plusieurs clients d'un coup"},
    {t:"imp", x:"En-tête revu : recherche et bouton « Filtres » (même hauteur) au-dessus, onglets de filtre soulignés en dessous ; pagination toujours visible ; cases à cocher remplies en bleu foncé ; boutons d'action carrés"},
    {t:"imp", x:"Fiche client = vrai suivi : chaque rendez-vous indique QUI l'a mené et QUAND, et se déplie sur son compte-rendu ; chaque compte-rendu est attribué à son commercial et daté"}
  ]},
  { v:"v0.50.0", date:"2026-07-21", title:"Clients : refonte du tableau", items:[
    {t:"imp", x:"Recherche déplacée à gauche au-dessus du tableau ; bouton « Filtres » ouvrant une fenêtre (commercial, secteur, offre) ; choix du nombre de lignes par page (10 / 25 / 50 / 100)"},
    {t:"add", x:"Nouvelle colonne « Commercial » : les avatars du ou des commerciaux ayant vu le client"},
    {t:"imp", x:"Tags de statut sans préfixe « Auto » et colonne Actions alignée ; actions carrées avec info-bulle (lancer un rendez-vous, relancer par e-mail, ouvrir la fiche) ; le nombre de comptes-rendus est cliquable"}
  ]},
  { v:"v0.49.1", date:"2026-07-21", title:"Clients : tags colorés + menu cohérent", items:[
    {t:"fix", x:"Les statuts de la page Clients reprennent enfin les couleurs de la page Rendez-vous (fond clair net au lieu de blanc)"},
    {t:"imp", x:"« Copilote RDV » retiré du menu latéral : il se lance depuis un client (bouton « Piloter avec le copilote ») ; il n'était pas logique de le garder comme entrée de menu"}
  ]},
  { v:"v0.49.0", date:"2026-07-21", title:"Clients : statut en 1 clic + actions par ligne", items:[
    {t:"add", x:"Dans le tableau Clients, le statut se change directement en un clic (même présentation que la page Rendez-vous) ; compteurs et filtres se mettent à jour aussitôt"},
    {t:"add", x:"Chaque ligne a des actions rapides : lancer le rendez-vous (copilote), voir le compte-rendu, ouvrir la fiche"}
  ]},
  { v:"v0.48.2", date:"2026-07-21", title:"Clients : jeu de démonstration stable", items:[
    {t:"fix", x:"La page Clients affiche un jeu de démonstration riche et stable (statuts variés, comptes-rendus, offres, prochaines étapes) tant qu'aucune vraie donnée n'existe : elle ne se vide plus quand Calendly est connecté sans rendez-vous. Le réel prend le relais dès la première vraie demande ou le premier vrai rendez-vous."}
  ]},
  { v:"v0.48.1", date:"2026-07-21", title:"Demandes reçues cliquables", items:[
    {t:"imp", x:"Dans le tableau de bord, cliquer une demande reçue ouvre directement la fiche client correspondante (les liens e-mail / téléphone restent cliquables séparément)"}
  ]},
  { v:"v0.48.0", date:"2026-07-21", title:"Clients : suivi commercial partagé", items:[
    {t:"add", x:"Chaque fiche client a un « Suivi commercial » modifiable et partagé entre tous les commerciaux : statut (nouveau lead, en discussion, devis envoyé, client actif, sans suite), prochaine étape et offre souscrite (Flex / Express / Dédié)"},
    {t:"add", x:"Nouveau filtre « Clients actifs » ; le statut choisi à la main prime sur le statut déduit automatiquement des rendez-vous"}
  ]},
  { v:"v0.47.0", date:"2026-07-21", title:"Tout est relié : Rendez-vous, Clients et Copilote", items:[
    {t:"add", x:"Depuis un rendez-vous, le bouton « Voir la fiche client » ouvre la vue d'ensemble du client (ses rendez-vous, ses comptes-rendus, ses coordonnées)"},
    {t:"add", x:"Depuis une fiche client, le bouton « Piloter avec le copilote » démarre le copilote pré-rempli (relié au prochain rendez-vous s'il y en a un)"}
  ]},
  { v:"v0.46.1", date:"2026-07-21", title:"Clients : vue en tableau", items:[
    {t:"imp", x:"La page Clients passe en tableau (comme le bas de la page Rendez-vous) : lisible même avec beaucoup de clients, avec recherche, filtres comptés et pagination ; un clic sur une ligne ouvre la fiche détaillée"}
  ]},
  { v:"v0.46.0", date:"2026-07-21", title:"Nouvelle page « Clients » : le commercial relié", items:[
    {t:"add", x:"Une page « Clients » regroupe automatiquement tous vos clients et prospects à partir des rendez-vous et des demandes reçues (fini les silos)"},
    {t:"add", x:"Chaque fiche client réunit ses coordonnées, ses rendez-vous et surtout ses comptes-rendus au même endroit : plus besoin de chercher où retrouver un compte-rendu"},
    {t:"add", x:"Recherche et filtres par statut (nouveaux leads, RDV planifié, rencontrés, sans suite)"}
  ]},
  { v:"v0.45.0", date:"2026-07-21", title:"Les demandes du site remontent à l'admin", items:[
    {t:"add", x:"Les demandes envoyées via le formulaire « Commander » sont désormais reçues côté serveur et regroupées dans un panneau « Demandes reçues » du tableau de bord (entreprise, contact, e-mail, téléphone, résumé de la demande)"},
    {t:"imp", x:"Ces demandes restaient auparavant sur l'appareil du visiteur (invisibles) : les commerciaux peuvent maintenant les retrouver et recontacter en un clic"}
  ]},
  { v:"v0.44.2", date:"2026-07-21", title:"Optimisation technique interne", items:[
    {t:"imp", x:"Regroupement technique de fonctions serveur (préparation des prochaines évolutions), sans changement visible ni perte de fonctionnalité"}
  ]},
  { v:"v0.44.1", date:"2026-07-21", title:"Copilote RDV : fiabilité (revue)", items:[
    {t:"fix", x:"Préparer un rendez-vous demande confirmation si un copilote est déjà en cours (plus de perte de saisie) ; un champ email éditable a été ajouté"},
    {t:"fix", x:"« Terminer » réinitialise le copilote et ne crée plus de doublon si on reclique ; le compte-rendu d'un rendez-vous synchronisé est correctement conservé après actualisation"}
  ]},
  { v:"v0.44.0", date:"2026-07-21", title:"Copilote RDV : le cycle complet, du rendez-vous au compte-rendu", items:[
    {t:"add", x:"Depuis la fiche d'un rendez-vous, le bouton « Préparer / piloter avec le copilote » ouvre le copilote pré-rempli (client, contact, secteur, volume) et le relie à ce rendez-vous"},
    {t:"add", x:"En cliquant « Terminer », le compte-rendu est rattaché au rendez-vous (visible dans sa fiche) et vous pouvez le marquer « honoré » ; un panneau « Comptes-rendus récents » permet de les relire et re-télécharger"},
    {t:"imp", x:"Les actions « Envoyer la plaquette / l'offre chiffrée » ouvrent maintenant un vrai email pré-rempli adressé au prospect, au lieu d'un simple message de confirmation"}
  ]},
  { v:"v0.43.1", date:"2026-07-20", title:"Menu épuré", items:[
    {t:"imp", x:"Retrait des pastilles « bêta/alpha » qui s'affichaient sur chaque entrée du menu (bruit visuel) ; le menu est plus net. L'état d'avancement de chaque page reste consultable dans la page « Avancement ». Le compteur de rendez-vous à venir est conservé."}
  ]},
  { v:"v0.43.0", date:"2026-07-20", title:"Audit qualité complet : sécurité, fiabilité et honnêteté renforcées", items:[
    {t:"fix", x:"Sécurité : la page de suivi de commande ne peut plus être détournée par un lien piégé (faille XSS fermée) ; l'accès à l'administration est verrouillé côté serveur par défaut"},
    {t:"fix", x:"Fiabilité : plus de perte de brouillon en manipulant les versions ; le calendrier de démonstration reste affiché même sans connexion ; l'assistant gère proprement une coupure réseau"},
    {t:"imp", x:"La fenêtre « Publier » distingue clairement ce qui part EN LIGNE de ce qui reste en version locale — fini les fausses promesses ; les textes modifiés s'appliquent aussi sur les adresses de page « propres »"},
    {t:"imp", x:"Documentation technique intégralement remise à jour pour le hand-off aux développeurs ; couverture de tests élargie (14 suites)"}
  ]},
  { v:"v0.42.1", date:"2026-07-20", title:"Fiabilité & robustesse (revue de code médias + statistiques)", items:[
    {t:"fix", x:"Statistiques : les visites vers des adresses de page longues ne sont plus perdues au comptage ; les chiffres restent fiables même sous forte affluence"},
    {t:"fix", x:"Médias : remplacer un logo répété (bandeau de confiance) met à jour toutes ses occurrences dans l'aperçu comme en ligne ; choisir une image déjà présente sur le site ne fige plus une adresse temporaire"},
    {t:"imp", x:"Statistiques : libellé honnête (« visiteurs / jour en moyenne »), protection anti-abus du point de collecte, et affichage plus économe (mise en cache)"}
  ]},
  { v:"v0.42.0", date:"2026-07-20", title:"Vraies statistiques d'audience (tous les visiteurs) dans l'admin, sans cookie", items:[
    {t:"add", x:"La page Statistiques affiche désormais l'audience RÉELLE de tous les visiteurs du site en ligne (pages vues, visiteurs, pages les plus vues, provenance), mesurée par notre propre serveur — sans cookie ni outil tiers payant"},
    {t:"imp", x:"Visiteurs uniques anonymisés (aucun suivi d'un jour à l'autre) et robots automatiquement écartés, pour des chiffres fiables"},
    {t:"imp", x:"On maîtrise la durée de conservation (aucun plafond imposé) ; le panneau « cet appareil » reste en repli et les chiffres de démonstration restent affichés pour vos présentations"}
  ]},
  { v:"v0.41.0", date:"2026-07-20", title:"Les images modifiées apparaissent sur le site en ligne après publication", items:[
    {t:"add", x:"Quand vous remplacez une image dans l'éditeur et que vous publiez, la nouvelle image s'affiche sur le site en ligne (elle est servie depuis le stockage de fichiers, pas « en dur » dans la page)"},
    {t:"imp", x:"Ne s'applique qu'aux vraies images stockées en ligne : une image encore en cours d'envoi reste locale tant qu'elle n'a pas d'adresse permanente (aucun risque d'image cassée)"},
    {t:"imp", x:"Revenir à l'image d'origine est pris en compte : le site réaffiche l'image par défaut"}
  ]},
  { v:"v0.40.0", date:"2026-07-20", title:"Médiathèque : stockage réel des fichiers (fini les images « lourdes » en mémoire)", items:[
    {t:"add", x:"Les images importées sont désormais envoyées sur un vrai stockage de fichiers en ligne et remplacées par une adresse (URL) permanente, au lieu d'être gardées « en dur » dans le navigateur"},
    {t:"imp", x:"Plus de saturation du navigateur : la médiathèque peut accueillir beaucoup plus d'images, partagées entre appareils et collaborateurs"},
    {t:"imp", x:"Sans coupure : si la connexion au stockage n'est pas disponible, l'image reste utilisable localement comme avant (aucune perte, démo intacte)"}
  ]},
  { v:"v0.39.0", date:"2026-07-20", title:"Publication propre par page + finitions d'accessibilité", items:[
    {t:"imp", x:"La publication du contenu est maintenant organisée PAR PAGE : chaque page en ligne ne reçoit que ses propres textes, tandis que le commun (menu, pied de page) s'applique partout. Modifier une page n'alourdit plus les autres"},
    {t:"imp", x:"Accessibilité : sur la FAQ (accueil, mobilité, postuler), chaque question est reliée à sa réponse pour les lecteurs d'écran (aria-controls)"},
    {t:"imp", x:"Accessibilité : sur la page Mobilité, l'animation de mots (« signature ») n'énonce plus que le mot affiché aux lecteurs d'écran, plus toute la liste"}
  ]},
  { v:"v0.38.0", date:"2026-07-15", title:"Performance : mesure automatique planifiée + historique conservé côté serveur", items:[
    {t:"add", x:"La vitesse Google (Core Web Vitals) est désormais mesurée AUTOMATIQUEMENT, tous les jours, sans clic : plus besoin d'y penser"},
    {t:"add", x:"L'historique des mesures est conservé côté serveur (partagé entre appareils et collaborateurs), pas seulement sur votre navigateur — visible dans « Mesures automatiques (serveur) » de la page Performance"},
    {t:"imp", x:"Prévu pour l'hébergement final (la mesure planifiée et le stockage se rebranchent par simple réglage). Sur l'hébergement de test, une mesure par jour ; le stockage durable s'active avec le même service de fichiers que la médiathèque"}
  ]},
  { v:"v0.37.0", date:"2026-07-15", title:"Chatbot : réponses en direct (au fil de l'eau) + mémoire de conversation", items:[
    {t:"add", x:"L'assistant écrit maintenant sa réponse EN DIRECT, mot après mot (comme ChatGPT), au lieu d'attendre la réponse complète : c'est plus vivant et on voit tout de suite qu'il répond"},
    {t:"add", x:"Il SUIT LE FIL de la conversation : posez une question de suivi (« et pour Lausanne ? ») et il comprend de quoi vous parliez, sans tout répéter"},
    {t:"imp", x:"Sans coupure ni régression : si le direct n'est pas disponible, l'assistant retombe automatiquement sur une réponse d'un bloc, puis sur ses réponses de démonstration — il répond toujours"}
  ]},
  { v:"v0.36.0", date:"2026-07-15", title:"Comptes & accès : les droits sont désormais vérifiés côté serveur", items:[
    {t:"add", x:"« Qui peut faire quoi » n'est plus seulement une question d'affichage : le serveur fait RESPECTER les rôles. Un compte sans le droit de publier ne peut pas publier, même en contournant l'interface — la demande est refusée côté serveur (et aucune écriture n'a lieu). Idem pour restaurer une version, voir l'historique, les rendez-vous ou la performance"},
    {t:"imp", x:"Sans casse ni verrouillage : votre compte administrateur garde l'accès complet, l'accès de secours par clé reste possible. L'attribution d'un rôle à un collaborateur se fait par un simple réglage (pas de développement), et chaque service reste derrière une couture fine (changer de compte = changer une variable)"}
  ]},
  { v:"v0.35.0", date:"2026-07-15", title:"Avancement : recalibrage sur « développé & fonctionnel »", items:[
    {t:"imp", x:"L'avancement mesure désormais ce qui est DÉVELOPPÉ et FONCTIONNE. Brancher les comptes définitifs et basculer vers l'hébergement final restent de la CONFIGURATION (tout est prévu pour, derrière des réglages), pas du développement — c'est suivi à part. Les pourcentages montent donc parce que c'est un changement de définition, pas un avancement soudain"}
  ]},
  { v:"v0.34.2", date:"2026-07-15", title:"Authentification : accès verrouillé aux seuls comptes autorisés", items:[
    {t:"imp", x:"La sécurité est désormais irréprochable : le serveur n'accepte QUE les comptes autorisés (liste blanche). Même si quelqu'un parvenait à s'inscrire, il serait refusé. L'accès de secours par clé reste disponible en cas de pépin"}
  ]},
  { v:"v0.34.1", date:"2026-07-14", title:"Authentification : connexion validée en ligne (édition + publication)", items:[
    {t:"add", x:"La connexion par compte est vérifiée de bout en bout : on se connecte, l'éditeur s'ouvre, et la publication fonctionne via un jeton de session sécurisé (plus la clé collée). Redirection après connexion corrigée (retour direct à l'éditeur)"},
    {t:"imp", x:"Dernière étape sécurité en cours : verrouiller l'accès aux seuls comptes autorisés (fermeture des inscriptions publiques + liste blanche serveur)"}
  ]},
  { v:"v0.34.0", date:"2026-07-14", title:"Authentification : écran de connexion sécurisé dans l'administration (étape 2/2)", items:[
    {t:"add", x:"L'administration s'ouvre désormais derrière un vrai écran de connexion (Clerk) : une fois connecté, l'accès est protégé par un compte, plus par une clé collée. Les échanges avec le serveur utilisent un jeton de session court et sécurisé"},
    {t:"imp", x:"Aucun risque de blocage : si la connexion sécurisée est indisponible, l'administration reste accessible par l'ancienne clé (accès de secours) ; un accès direct de secours existe aussi (?fallback=1). La sécurité côté serveur a été renforcée (revue dédiée : émetteur vérifié strictement, origine contrôlée)"}
  ]},
  { v:"v0.33.3", date:"2026-07-14", title:"Statistiques : les vraies visites sont désormais comptées (agrégé, sans cookie)", items:[
    {t:"add", x:"Le site envoie maintenant ses visites à un outil de mesure d'audience agrégé et sans cookie (Umami) : vous voyez les vraies statistiques multi-visiteurs dans votre tableau de bord Umami. La mesure « sur cet appareil » de la page Statistiques reste disponible en repli, et les prévisualisations de l'éditeur ne sont jamais comptées"}
  ]},
  { v:"v0.33.2", date:"2026-07-14", title:"Sécurité : renforcement de l'échappement des données affichées dans l'admin", items:[
    {t:"fix", x:"Durcissement préventif : tous les champs affichés dans l'administration (dont les noms, sociétés et liens issus des réservations Calendly) sont désormais échappés y compris dans les info-bulles et les liens, empêchant toute exécution de code piégé. Aucun changement visible pour vous"}
  ]},
  { v:"v0.33.1", date:"2026-07-14", title:"Performance : image de la bannière FAQ de l'accueil allégée", items:[
    {t:"imp", x:"L'image de fond de la bannière « Questions fréquentes » de l'accueil a été ré-encodée et redimensionnée : elle passe d'environ 1,1 Mo à environ 250 Ko (près de 77 % de poids en moins), sans changement visible. L'accueil se charge d'autant plus vite, surtout sur mobile et connexions lentes (image purement décorative, elle n'affecte pas l'affichage initial)"}
  ]},
  { v:"v0.33.0", date:"2026-07-14", title:"Performance : Google note aussi accessibilité & SEO, reprise auto et historique", items:[
    {t:"add", x:"Le bloc « Vitesse réelle » affiche maintenant les QUATRE notes de Google (Lighthouse) : Vitesse, Accessibilité, Référencement (SEO) et Bonnes pratiques — l'avis de Google en complément de l'audit local de l'admin (méthodes différentes, chiffres parfois différents, c'est normal)"},
    {t:"add", x:"Un historique des mesures Google est mémorisé (score de vitesse + accessibilité + SEO, avec l'évolution d'une mesure à l'autre)"},
    {t:"imp", x:"Reprise automatique : si Google dépasse le délai de l'hébergement de test, la mesure réessaie toute seule (le 1er passage prépare le résultat) — plus besoin de recliquer dans la plupart des cas"}
  ]},
  { v:"v0.32.2", date:"2026-07-14", title:"Performance : mesure de vitesse Google ACTIVÉE et vérifiée en ligne", items:[
    {t:"add", x:"La clé Google PageSpeed est en place : le bouton « Mesurer » renvoie désormais de VRAIES mesures Core Web Vitals de votre site, vérifiées en direct sur la préversion (score de vitesse, affichage du contenu, stabilité, réactivité)"},
    {t:"imp", x:"À savoir sur l'hébergement de test (plan gratuit) : une mesure peut afficher « trop longue » car Google prend souvent plus de 10 s — recliquez « Mesurer » et le résultat réel s'affiche (Google le garde en cache un court instant). Ce sera fluide sur l'hébergement final. Les scores PageSpeed varient d'un passage à l'autre, c'est normal"}
  ]},
  { v:"v0.32.1", date:"2026-07-14", title:"Performance : le pilier Rapidité reprend la vraie mesure Google", items:[
    {t:"imp", x:"Quand vous mesurez la vitesse réelle de l'accueil, le pilier « Rapidité » en haut affiche directement les vraies valeurs de Google (affichage du contenu principal, stabilité, réactivité) au lieu de la mention « mesure à venir » : le pilier et le bloc « Vitesse réelle » disent maintenant la même chose"}
  ]},
  { v:"v0.32.0", date:"2026-07-14", title:"Performance : la vitesse réelle de Google s'affiche dans l'admin", items:[
    {t:"add", x:"La page Performance affiche un nouveau bloc « Vitesse réelle, mesurée par Google » (Core Web Vitals : affichage du contenu principal, stabilité de la page, réactivité aux clics). Choisissez une page, « Mobile » ou « Ordinateur », puis cliquez « Mesurer » : les vraies mesures de Google apparaissent, traduites en langage clair et colorées selon les seuils officiels"},
    {t:"imp", x:"Sans clé Google PageSpeed, rien ne casse : le bloc l'indique honnêtement et votre estimation locale (référencement, lisibilité, poids) reste la référence. La dernière mesure est mémorisée d'une visite à l'autre ; une mesure trop longue pour l'hébergement de test est signalée clairement"}
  ]},
  { v:"v0.31.2", date:"2026-07-13", title:"Nettoyage technique (suite de la revue)", items:[
    {t:"imp", x:"Fiabilité serveur : le chatbot prend en compte une nouvelle publication sans redémarrage même sur un hébergement permanent (utile pour la future bascule Azure)"},
    {t:"imp", x:"Nettoyage : réglage « sujets autorisés » retiré du fichier publié (il n'était pas utilisé en ligne, restait indicatif dans l'admin) ; duplication interne des textes traduits documentée pour vos développeurs"}
  ]},
  { v:"v0.31.1", date:"2026-07-13", title:"Sécurité & fiabilité (revue de code adversariale)", items:[
    {t:"fix", x:"Faille corrigée : un nom/société saisi dans une réservation Calendly ne peut plus exécuter de code en s'affichant dans l'admin (échappement renforcé côté affichage + nettoyage côté serveur). C'était le point le plus important"},
    {t:"fix", x:"Le filtre de sujets interdits ne bloque plus une question légitime qui contient juste un mot commun (ex. « clients ») : il faut désormais tous les mots du sujet interdit"},
    {t:"fix", x:"Les vrais rendez-vous synchronisés ne remplacent plus les données de démonstration au rechargement (la démo reste intacte)"},
    {t:"fix", x:"Le message de repli personnalisé est bien utilisé par l'IA quand elle ne peut pas répondre ; le bot ne divulgue plus les codes promo en clair"},
    {t:"imp", x:"Transparence : avertissement clair dans la page Chatbot indiquant que le texte des sources est publié publiquement (ne pas y mettre de données confidentielles)"}
  ]},
  { v:"v0.31.0", date:"2026-07-13", title:"Chatbot : intelligence artificielle ACTIVÉE et vérifiée en ligne", items:[
    {t:"add", x:"L'assistant répond désormais avec une vraie IA (réponses rédigées, naturelles, en français et en anglais), ancrée sur votre contenu — vérifié en direct sur la préversion"},
    {t:"add", x:"Périmètre confirmé à l'usage : les questions hors sujet (culture générale) et les tentatives de détournement sont refusées et redirigées vers le contact — et ne coûtent rien (déviées avant l'IA)"},
    {t:"imp", x:"Coût maîtrisé : palier gratuit, réponses plafonnées, et repli automatique sans coupure si l'IA est indisponible"}
  ]},
  { v:"v0.30.0", date:"2026-07-13", title:"Chatbot : vos sources alimentent l'assistant en ligne", items:[
    {t:"add", x:"Les sources que vous ajoutez dans la page Chatbot (fiches, extraits, FAQ) nourrissent désormais l'assistant EN LIGNE : quand vous publiez, il répond aussi à partir de votre propre base de connaissances, pas seulement des infos du site intégrées d'origine. C'est le « quoi » de l'assistant, entièrement sous votre contrôle et gratuit"},
    {t:"imp", x:"Le texte des sources est publié de façon bornée (idéal pour des fiches et extraits ; les très gros documents seraient tronqués, réservés à une future indexation avancée), avec les mêmes garde-fous de sécurité que le reste du contenu"}
  ]},
  { v:"v0.29.2", date:"2026-07-13", title:"Chatbot : périmètre verrouillé (questions Chaskis uniquement)", items:[
    {t:"imp", x:"L'assistant refuse désormais explicitement tout ce qui sort du périmètre Chaskis (culture générale, autres entreprises, code, opinions) et ignore les tentatives de détournement dans le message de l'utilisateur ; il redirige vers hello@chaskis.ch. Longueur des réponses plafonnée (coût maîtrisé)."}
  ]},
  { v:"v0.29.1", date:"2026-07-13", title:"Performance : mesure de vitesse réelle prête (côté serveur)", items:[
    {t:"add", x:"La partie serveur des Core Web Vitals (vitesse perçue mesurée par Google : LCP, CLS, temps de blocage) est écrite et testée. Reste à fournir une clé Google PageSpeed (gratuite) pour l'activer ; l'audit local (référencement, lisibilité, poids) reste disponible sans compte"}
  ]},
  { v:"v0.29.0", date:"2026-07-13", title:"Chatbot : vos réglages pilotent l'assistant en ligne", items:[
    {t:"add", x:"Les réglages de l'assistant (sujets interdits, message de repli, ton, nom, instructions) définis dans l'admin sont désormais PUBLIÉS avec le contenu du site et appliqués par l'assistant en ligne : une question sur un sujet interdit est déviée vers votre message de repli, et le ton/les consignes guident les réponses rédigées"},
    {t:"add", x:"Transite par le contrat de publication existant (mêmes garde-fous anti-injection que le reste du contenu). À noter : le texte des sources est publié avec le contenu du site pour que le bot puisse le lire — n'y mettez donc pas de données confidentielles (un stockage privé serait nécessaire pour cela, prévu plus tard)"}
  ]},
  { v:"v0.28.0", date:"2026-07-13", title:"Rendez-vous : réattribution manuelle à un autre commercial", items:[
    {t:"add", x:"Dans la fiche d'un rendez-vous, un sélecteur « Commercial attribué » permet à l'admin ou au lead commercial de réassigner le rendez-vous à la main, en complément de l'attribution automatique"},
    {t:"add", x:"Ce choix manuel est mémorisé et RÉ-APPLIQUÉ à chaque synchronisation Calendly : une resynchronisation n'écrase jamais une réattribution faite à la main"}
  ]},
  { v:"v0.27.3", date:"2026-07-13", title:"Accessibilité : questions fréquentes (FAQ) annoncées comme dépliables", items:[
    {t:"fix", x:"Les questions fréquentes (accueil, mobilité, postuler) indiquent maintenant leur état ouvert/fermé aux lecteurs d'écran (aria-expanded) : une personne malvoyante sait qu'une question se déplie et si elle est ouverte"}
  ]},
  { v:"v0.27.2", date:"2026-07-13", title:"Accessibilité : navigation clavier (contenu principal et lien d'évitement)", items:[
    {t:"add", x:"Chaque page publique a un vrai « contenu principal » balisé et un lien d'évitement clavier (« Aller au contenu ») : les personnes qui naviguent au clavier ou au lecteur d'écran sautent directement au contenu"},
    {t:"fix", x:"Rafraîchissement du cache des fichiers (styles et scripts) pour que les améliorations récentes s'appliquent immédiatement, sans vieux fichiers en cache côté visiteur"}
  ]},
  { v:"v0.27.1", date:"2026-07-13", title:"Accessibilité : lecteurs d'écran (témoignages et titre animé)", items:[
    {t:"fix", x:"Page Postuler : les cartes de témoignages n'usurpent plus des rôles d'« onglets » (qui trompaient les lecteurs d'écran) ; le comportement au clic et au clavier est inchangé"},
    {t:"fix", x:"Page Mobilité : le titre animé n'énonce plus toute la liste de mots aux lecteurs d'écran, seulement le mot affiché"}
  ]},
  { v:"v0.27.0", date:"2026-07-13", title:"Rendez-vous : les vrais rendez-vous Calendly remontent dans l'admin", items:[
    {t:"add", x:"Bouton « Synchroniser Calendly » dans la vue Rendez-vous : dès qu'un accès Calendly est configuré, vos vrais rendez-vous remontent dans la liste et « le prochain rendez-vous », attribués automatiquement au commercial disponible. Synchronisation aussi automatique à l'ouverture de la vue"},
    {t:"add", x:"Repli sûr : sans accès configuré, la vue affiche les rendez-vous de démonstration comme avant (aucune régression). Un problème réseau ou de configuration n'efface jamais l'affichage"},
    {t:"imp", x:"Le filtre par personne inclut désormais tous les commerciaux (Jean-Christophe était manquant). Les statistiques agrégées (présence, conversion, équipe) restent estimées pour l'instant"}
  ]},
  { v:"v0.26.1", date:"2026-07-13", title:"Accessibilité et référencement des pages publiques", items:[
    {t:"imp", x:"Accessibilité : champs du simulateur reliés à leur libellé, boutons du sélecteur de rendez-vous (Mobilité) nommés pour les lecteurs d'écran, et structure des cartes « Ils en parlent » (Postuler) corrigée"},
    {t:"imp", x:"Référencement : titre de la page d'accueil et description de la page Mobilité ramenés à une longueur optimale pour Google"},
    {t:"fix", x:"Postuler : deux photos de témoignages avaient un texte alternatif inversé (nom ne correspondant pas), et une balise manquante déséquilibrait une carte — corrigé"}
  ]},
  { v:"v0.26.0", date:"2026-07-13", title:"Rendez-vous : vrai module de réservation Calendly sur le site", items:[
    {t:"add", x:"La page d'accueil affiche désormais le vrai calendrier de réservation Calendly : un visiteur prend un rendez-vous réel, directement depuis le site (le calendrier de démonstration reste le repli quand aucun compte n'est branché)"},
    {t:"add", x:"Réglable sans toucher au code : l'adresse du calendrier vit dans un fichier de configuration ; vide = calendrier de démonstration, renseigné = vrai Calendly"}
  ]},
  { v:"v0.25.0", date:"2026-07-13", title:"Rendez-vous : moteur de connexion Calendly prêt (côté serveur)", items:[
    {t:"add", x:"La partie serveur des rendez-vous est écrite et testée : elle lit les vrais RDV d'un compte Calendly central et les prépare pour l'admin. Reste à brancher l'affichage et à fournir un accès Calendly pour l'activer"},
    {t:"add", x:"Redistribution intelligente : chaque RDV est attribué automatiquement au commercial le moins chargé (et l'attribution manuelle restera toujours possible). Un seul calendrier Calendly suffit — pas besoin de payer un abonnement par commercial"},
    {t:"add", x:"Compatible plan Calendly GRATUIT pour tester : la lecture des rendez-vous ne nécessite aucun abonnement payant (seul le temps réel, plus tard, coûtera ~10 CHF/mois)"},
    {t:"fix", x:"Suivi technique : coût Calendly corrigé pour coller à la réalité vérifiée (gratuit à tester, ~10 CHF/mois en temps réel pour une page centrale ; le cas cher ~40 CHF concerne uniquement la répartition automatique multi-commerciaux, qu'on évite)"},
    {t:"fix", x:"Robustesse (revue de code) : lecture de TOUS les rendez-vous même au-delà de 100 (pagination), garde-temps global pour ne pas dépasser la limite serveur, rendez-vous incomplets signalés plutôt que perdus, et affichage honnête de l'état de la disponibilité"}
  ]},
  { v:"v0.24.0", date:"2026-07-13", title:"Chatbot : réponses tirées du contenu réel du site", items:[
    {t:"add", x:"L'assistant du site répond désormais aux questions libres à partir des faits réels de Chaskis (offres, zones, délais, recrutement, contact) au lieu de réponses uniquement génériques : il retrouve le bon passage et en donne l'essentiel"},
    {t:"add", x:"Les tarifs affichés par l'assistant sont tirés en direct de la grille que vous publiez : quand vous changez vos prix, le chatbot suit automatiquement"},
    {t:"add", x:"Prêt pour une réponse « rédigée » plus naturelle : il suffira d'activer une clé d'intelligence artificielle (compte de test gratuit, ou Azure) — sans rien changer d'autre. Sans clé, l'assistant reste pleinement fonctionnel"},
    {t:"imp", x:"Sécurité : les réponses de l'assistant sont affichées comme du texte (aucune injection de code possible), et la démo hors-ligne conserve ses réponses guidées"}
  ]},
  { v:"v0.23.2", date:"2026-07-13", title:"Écrans de suivi alignés sur l'état réel", items:[
    {t:"imp", x:"Mise à jour des écrans de suivi : la carte « Édition du site » de l'Avancement reflète maintenant la publication réelle en ligne. Version, dates, avancement des pages et pourcentages d'intégration alignés sur l'état réel du projet"}
  ]},
  { v:"v0.23.1", date:"2026-07-13", title:"Renforcement sécurité et fiabilité (revue)", items:[
    {t:"fix", x:"Publication : la clé d'accès tolère un espace en trop de manière cohérente sur toutes les fonctions (fini le blocage 401 impossible à débloquer)"},
    {t:"fix", x:"Robustesse serveur : lecture des requêtes corrigée (plus de blocage sur un gros contenu, accents préservés) et serveur de test durci (fichiers internes non exposés)"}
  ]},
  { v:"v0.23.0", date:"2026-07-13", title:"Historique et restauration des versions en ligne", items:[
    {t:"add", x:"La page Versions affiche l'historique réel de vos publications (chaque mise en ligne = une version datée), avec un bouton « Restaurer » pour revenir à une version précédente en un clic"},
    {t:"add", x:"Rien n'est jamais perdu : restaurer crée une nouvelle version, on peut donc toujours revenir en avant"}
  ]},
  { v:"v0.22.3", date:"2026-07-13", title:"Publication fonctionnelle de bout en bout", items:[
    {t:"add", x:"Étape majeure : le bouton Publier met réellement le contenu en ligne, testé et prouvé sur l'environnement de test (la modification écrite depuis l'éditeur apparaît bien sur le site, sans toucher au site public)"}
  ]},
  { v:"v0.22.2", date:"2026-07-13", title:"Publication : clé mémorisée (une seule saisie)", items:[
    {t:"imp", x:"La clé de publication est désormais mémorisée sur votre appareil : vous ne la saisissez qu'une seule fois, au lieu d'à chaque session. Mesure d'attente : la connexion par compte (à venir) supprimera complètement cette clé"}
  ]},
  { v:"v0.22.1", date:"2026-07-13", title:"Publication : compatibilité élargie des clés d'accès", items:[
    {t:"fix", x:"La publication accepte désormais les deux formats de clé d'accès GitHub (classique et fine-grained) et tolère un espace collé par erreur, pour éviter les échecs d'authentification au moment de l'activation"}
  ]},
  { v:"v0.22.0", date:"2026-07-09", title:"Versions : recherche et épinglage de l'historique", items:[
    {t:"add", x:"Une recherche dans tout l'historique des versions (par mot, auteur ou date) pour retrouver rapidement une version précise"},
    {t:"add", x:"La possibilité d'épingler les versions clés (stables ou performantes) : un filtre « Épinglées » les regroupe pour ne jamais les perdre de vue"}
  ]},
  { v:"v0.21.4", date:"2026-07-09", title:"Performance : espacement du bloc Historique corrigé", items:[
    {t:"fix", x:"Page Performance : l'espacement autour du bloc « Historique des analyses » est rééquilibré (il était trop détaché du bilan du haut et presque collé au premier domaine)"}
  ]},
  { v:"v0.21.3", date:"2026-07-08", title:"Performance : contrôle des titres en double", items:[
    {t:"add", x:"L'analyse Performance signale désormais si deux pages partagent exactement le même titre (mauvais pour le référencement). À ce jour, vos titres sont tous distincts"}
  ]},
  { v:"v0.21.2", date:"2026-07-08", title:"Correctifs médiathèque (revue qualité)", items:[
    {t:"fix", x:"Import d'image : si l'optimisation n'allège pas le fichier (ou sur un navigateur ancien sans WebP), l'image originale valide est conservée au lieu d'être refusée à tort"},
    {t:"fix", x:"Import d'image : les images animées (WebP ou PNG animé) sont désormais conservées telles quelles, au lieu d'être aplaties en une seule image"}
  ]},
  { v:"v0.21.1", date:"2026-07-08", title:"Pages Mentions légales et CGV", items:[
    {t:"add", x:"Deux nouvelles pages légales, Mentions légales et Conditions générales, sur le modèle de la page Confidentialité (modèles à faire valider par un juriste)"},
    {t:"fix", x:"Les liens « Mentions légales » et « CGV » du pied de page, jusqu'ici inactifs, mènent désormais aux bonnes pages sur tout le site"}
  ]},
  { v:"v0.21.0", date:"2026-07-08", title:"Médiathèque : images optimisées à l'import", items:[
    {t:"add", x:"Les images importées sont maintenant redimensionnées (jusqu'à 1920 px) et compressées (WebP) directement dans le navigateur : les grandes photos passent sans souci et pèsent bien moins lourd. Les fichiers SVG et les vidéos ne sont pas modifiés"},
    {t:"imp", x:"Une photo trop lourde peut désormais être acceptée après optimisation, au lieu d'être refusée d'emblée"}
  ]},
  { v:"v0.20.0", date:"2026-07-08", title:"Statistiques : la vraie mesure démarre (sans cookie)", items:[
    {t:"add", x:"Une vraie mesure de fréquentation, sans cookie et sans outil tiers, est maintenant active sur toutes les pages du site. La page Statistiques affiche un bloc « mesuré réellement sur cet appareil » (pages vues, provenance, part mobile), en plus des données d'exemple"},
    {t:"imp", x:"Les prévisualisations de l'éditeur ne sont pas comptées, seules les vraies visites le sont. L'agrégation de tous les visiteurs viendra avec la mise en ligne"}
  ]},
  { v:"v0.19.0", date:"2026-07-08", title:"Le bouton Publier met vraiment le site en ligne", items:[
    {t:"add", x:"« Publier » envoie désormais réellement vos textes et tarifs en ligne (via une clé de publication à saisir une seule fois), en plus d'enregistrer une version locale. Messages clairs en cas de souci : clé refusée, publication concurrente, réglage manquant"},
    {t:"imp", x:"Depuis l'aperçu local, la publication reste en local avec un message explicite ; la vraie mise en ligne se fait depuis le site en ligne. Il ne reste qu'à fournir les accès (voir la fenêtre Publier)"}
  ]},
  { v:"v0.18.2", date:"2026-07-08", title:"Audit technique : couverture des nouveautés", items:[
    {t:"imp", x:"L'audit automatique du Suivi technique vérifie maintenant aussi l'analyse Performance réelle et la conformité du fichier de publication, pour repérer toute régression future"}
  ]},
  { v:"v0.18.1", date:"2026-07-08", title:"Publication : fichier prêt à mettre en ligne", items:[
    {t:"imp", x:"Dans la fenêtre Publier, « Exporter » produit désormais le fichier exact qui sera mis en ligne (vos textes et vos tarifs), déjà au format validé par le serveur ; il ne restera qu'à fournir l'accès technique pour publier en un clic"}
  ]},
  { v:"v0.18.0", date:"2026-07-08", title:"Performance : audit plus complet et historique", items:[
    {t:"add", x:"L'analyse vérifie aussi l'adaptation au téléphone, l'adresse canonique et l'aperçu de partage sur les réseaux sociaux (Open Graph), en plus du référencement et de la lisibilité"},
    {t:"add", x:"Un historique daté des analyses est conservé : vous voyez l'évolution de la note globale et de chaque domaine d'une analyse à la suivante"}
  ]},
  { v:"v0.17.0", date:"2026-07-08", title:"Performance : l'analyse devient réelle", items:[
    {t:"add", x:"Le bouton « Relancer l'analyse » lance désormais un vrai audit de votre site, sans aucun outil externe : il parcourt vos pages et mesure le référencement (titres, descriptions, données structurées, plan du site), la lisibilité (descriptions d'images, étiquettes de formulaire, ordre des titres) et le poids des pages"},
    {t:"add", x:"Les points « à améliorer », « ce qui va déjà bien » et le détail technique reflètent maintenant l'état réel de vos pages, avec la date de l'analyse"},
    {t:"imp", x:"La vitesse ressentie fine (Core Web Vitals) reste estimée pour l'instant : elle sera mesurée automatiquement à l'étape Google PageSpeed / Lighthouse"}
  ]},
  { v:"v0.16.17", date:"2026-07-08", title:"Préparation de la sauvegarde et nettoyage technique", items:[
    {t:"imp", x:"Base technique posée pour exporter/sauvegarder tout le contenu de l'admin en un seul bloc (préparera le bouton Publier et les sauvegardes)"},
    {t:"fix", x:"Retrait d'un morceau de code inutilisé dans le Suivi technique (fichier plus léger, plus fiable)"}
  ]},
  { v:"v0.16.16", date:"2026-07-08", title:"Publication : la fonction serveur d'écriture est prête", items:[
    {t:"add", x:"La partie serveur de la publication est écrite et testée : elle authentifie la demande, valide le contenu et enregistre le fichier dans le dépôt (avec gestion des conflits). Reste à relier le bouton Publier et à fournir l'accès GitHub pour l'activer réellement"}
  ]},
  { v:"v0.16.15", date:"2026-07-08", title:"Publication : lecture active sur tout le site", items:[
    {t:"imp", x:"Le contenu publié est désormais lu et appliqué sur toutes les pages publiques (accueil, mobilité, postuler, commander, tableau de bord), toujours avec repli sûr si rien n'est encore publié"}
  ]},
  { v:"v0.16.14", date:"2026-07-08", title:"Base de la publication : le site sait lire le contenu publié", items:[
    {t:"add", x:"Le site public sait désormais charger le contenu publié et l'appliquer, avec repli automatique sur les valeurs par défaut si rien n'est publié (aucun risque pour le site en ligne)"},
    {t:"imp", x:"Chantier « Publication » : la moitié « lecture » est en place et testée ; reste l'écriture réelle (le bouton Publier, qui nécessitera l'accès GitHub)"}
  ]},
  { v:"v0.16.13", date:"2026-07-08", title:"Structure : sections masquées signalées", items:[
    {t:"imp", x:"Structure et stratégie : une section masquée de l'accueil porte désormais un badge « actuellement masquée », pour voir d'un coup d'œil ce qui est retiré du site public"}
  ]},
  { v:"v0.16.12", date:"2026-07-08", title:"Copilote : fin de rendez-vous utile", items:[
    {t:"imp", x:"Copilote : « Terminer » archive le compte-rendu et le télécharge en fichier texte, au lieu de ne rien faire (plus de perte au passage à un nouveau rendez-vous)"}
  ]},
  { v:"v0.16.11", date:"2026-07-08", title:"Filtre rendez-vous complet, affichage Performance corrigé", items:[
    {t:"imp", x:"Rendez-vous : le filtre par personne liste désormais tous les commerciaux présents dans les données (plus de rendez-vous invisible)"},
    {t:"fix", x:"Performance : la liste « ce qui va déjà bien » s'affiche correctement (style corrigé)"}
  ]},
  { v:"v0.16.10", date:"2026-07-08", title:"Estimations d'avancement affinées", items:[
    {t:"imp", x:"Suivi technique : les estimations d'avancement sont rendues plus prudentes (on ne compte que ce qui est réellement avancé)"}
  ]},
  { v:"v0.16.9", date:"2026-07-08", title:"Suivi d'avancement remis à jour", items:[
    {t:"imp", x:"Avancement : l'état, la version et les nouveautés de chaque page de l'admin sont remis à jour après les récentes améliorations"},
    {t:"imp", x:"Suivi technique : le pourcentage d'intégration reflète l'avancement réel (socle serveur et contrat de publication posés, préparations côté interface), et « reste à intégrer » diminue à mesure qu'on avance"}
  ]},
  { v:"v0.16.8", date:"2026-07-08", title:"Robustesse et sécurité des rendez-vous", items:[
    {t:"fix", x:"Rendez-vous : la liste ne peut plus se bloquer si une donnée enregistrée est incomplète ou corrompue (statut inconnu géré proprement)"},
    {t:"fix", x:"Sécurité : les champs des rendez-vous (client, contact, sujet, lien, e-mail) et le formulaire de connexion d'agenda sont échappés à l'affichage (protection contre l'injection de code)"},
    {t:"fix", x:"Rendez-vous : la note saisie dans une fiche est bien conservée après un rechargement"},
    {t:"fix", x:"Une date invalide s'affiche proprement (« date inconnue ») au lieu d'un texte cassé"}
  ]},
  { v:"v0.16.7", date:"2026-07-08", title:"Rendez-vous mémorisés", items:[
    {t:"imp", x:"Rendez-vous : les changements de statut et les relances sont désormais enregistrés et conservés après un rechargement de la page"}
  ]},
  { v:"v0.16.6", date:"2026-07-08", title:"Activité récente réelle", items:[
    {t:"imp", x:"Tableau de bord : « Activité récente » reflète désormais vos vraies publications (auteur, version, changements) au lieu d'exemples fictifs"},
    {t:"fix", x:"Rendez-vous : les noms des comptes d'agenda connectés sont échappés à l'affichage (sécurité)"}
  ]},
  { v:"v0.16.5", date:"2026-07-08", title:"Chatbot testable et tuile Rendez-vous réelle", items:[
    {t:"imp", x:"Chatbot : le bac à test répond désormais à partir de vos vraies sources configurées (extrait de la source la plus pertinente), au lieu d'une réponse générique"},
    {t:"imp", x:"Tableau de bord : la tuile « Rendez-vous à venir » affiche le nombre réel au lieu d'une valeur fixe"},
    {t:"fix", x:"Chatbot : l'affichage du bac à test échappe le contenu des sources (plus de risque d'injection de code)"}
  ]},
  { v:"v0.16.4", date:"2026-07-08", title:"Plage de dates fonctionnelle et robustesse", items:[
    {t:"add", x:"Statistiques : la plage de dates personnalisée fonctionne désormais — choisir deux dates affiche la période réelle la plus proche, au lieu d'un simple message"},
    {t:"fix", x:"Performance : la date de dernière analyse ne peut plus afficher « Invalid Date » si une valeur enregistrée est corrompue"}
  ]},
  { v:"v0.16.3", date:"2026-07-08", title:"Fonctionnalités rendues opérationnelles", items:[
    {t:"imp", x:"Historique : les boutons Restaurer et Prévisualiser sont de nouveau visibles partout ; une version d'exemple affiche un message clair au lieu de vider le site"},
    {t:"add", x:"Avancement : le pourcentage global de préparation de l'interface est désormais affiché (moyenne des stades des pages)"},
    {t:"add", x:"Affiliation : les précisions saisies pour un jeu concours apparaissent maintenant sur sa carte"},
    {t:"imp", x:"Performance : la date de dernière analyse devient une vraie date, mise à jour à chaque « Relancer l'analyse »"}
  ]},
  { v:"v0.16.2", date:"2026-07-08", title:"Éditeur plus sûr et plus honnête", items:[
    {t:"fix", x:"Suppression d'un média : une confirmation est désormais demandée (fini la perte en un clic)"},
    {t:"fix", x:"Historique des versions : les versions d'exemple ne peuvent plus être restaurées par erreur (ce qui remettait le site à vide)"},
    {t:"fix", x:"Alerte si le stockage est plein à l'ajout d'un partenaire ou d'un jeu concours (fini la perte silencieuse)"},
    {t:"imp", x:"Performance et Statistiques : les données d'exemple sont clairement identifiées comme telles"},
    {t:"fix", x:"Utilisateurs : le libellé « manager » devient « administrateur »"}
  ]},
  { v:"v0.16.1", date:"2026-07-08", title:"Page Confidentialité", items:[
    {t:"add", x:"Ajout d'une page Politique de confidentialité (structurée selon la nLPD suisse), accessible depuis le pied de page de tout le site"},
    {t:"fix", x:"Le lien « Confidentialité » du pied de page ne menait nulle part : il ouvre désormais la vraie page"}
  ]},
  { v:"v0.16.0", date:"2026-07-08", title:"Fondations techniques pour la publication", items:[
    {t:"add", x:"Socle serveur posé : le site peut désormais accueillir les fonctions serveur prévues au plan (publication du contenu, statistiques, chatbot), sans surcoût"},
    {t:"add", x:"Espace d'administration rendu invisible pour les moteurs de recherche"},
    {t:"imp", x:"Règles de sécurité du contenu publié définies pour bloquer tout contenu indésirable avant sa mise en ligne"}
  ]},
  { v:"v0.15.5", date:"2026-07-04", title:"Frise d'ordre en vraie timeline", items:[
    {t:"imp", x:"Suivi technique : l'ordre conseillé redevient une frise reliée (pastilles numérotées sur un fil, titre et priorité en dessous), sans trait qui traverse le texte, et toujours compacte"}
  ]},
  { v:"v0.15.4", date:"2026-07-04", title:"Avancement pleine largeur et icônes de page", items:[
    {t:"imp", x:"Avancement : les cartes utilisent toute la largeur (jusqu'à 4 par ligne), à taille égale ; le pourcentage abstrait est remplacé par le stade de chaque page, plus clair"},
    {t:"imp", x:"Une icône rappelle la page devant chaque titre (reprise du menu), dans le vert de la marque"}
  ]},
  { v:"v0.15.3", date:"2026-07-04", title:"Performance à 4 niveaux et affiliation", items:[
    {t:"imp", x:"Performance : jauge à 4 niveaux (rouge, orange, jaune, vert) avec un seul vert comme aboutissement, fini le vert foncé"},
    {t:"fix", x:"Affiliation : les jeux concours reviennent au visuel de prompt (les photos d'illustration n'étaient pas en rapport avec le sujet)"}
  ]},
  { v:"v0.15.2", date:"2026-07-04", title:"Tableau de bord, notes de version et signalement", items:[
    {t:"imp", x:"Tableau de bord : « Voir tous » en lien discret en haut à droite (rendez-vous, avancement, utilisateurs) au lieu d'un gros bouton, plus de rendez-vous affichés, et « Utilisateurs et accès » renommé"},
    {t:"imp", x:"Notes de version : « Reste à faire » présenté en carte claire, et espacements corrigés dans la légende du haut"},
    {t:"imp", x:"« Signaler un problème » : déplacé en petite icône discrète dans l'en-tête, visible uniquement en ligne (plus le gros bouton sous le menu)"}
  ]},
  { v:"v0.15.1", date:"2026-07-04", title:"Corrections d'après vos retours du soir", items:[
    {t:"fix", x:"Édition : le bandeau promotionnel réapparaît, et le dégradé de la page d'accueil passe bien derrière la barre de navigation (les deux ensemble)"},
    {t:"imp", x:"Tableau de bord rééquilibré : « Équipe et accès » remonte à côté de « Avancement du projet », plus d'espace vide"},
    {t:"imp", x:"Suivi technique : frise d'ordre plus lisible (libellés courts, légende colorée, barre de défilement discrète, plus de ligne parasite) et en-tête plus concis"},
    {t:"imp", x:"Performance : le repère de la jauge se place selon la note, et les niveaux non atteints restent colorés en pastel (plus lisibles)"},
    {t:"imp", x:"Avancement de l'interface et intégration technique : intitulés clarifiés pour être cohérents entre eux"},
    {t:"imp", x:"Affiliation : les jeux concours affichent de vraies photos d'illustration"},
    {t:"imp", x:"Utilisateurs et accès : le bouton « Ajouter un utilisateur » est remonté dans la carte, en style discret"},
    {t:"fix", x:"Suivi technique : les icônes des étiquettes reprennent la couleur de leur texte, et la barre d'avancement passe en teal clair"}
  ]},
  { v:"v0.15.0", date:"2026-07-04", title:"Jeux concours, avancement chiffré et finitions", items:[
    {t:"add", x:"Créer un jeu concours : nouveau formulaire (visuel ou prompt d'image IA, lot, période, statut), en plus de l'ajout de partenaires"},
    {t:"imp", x:"Page Avancement repensée : cartes claires (fini le gris), pourcentage d'avancement par page et stades en langage humain (Prêt / En test / En construction)"},
    {t:"imp", x:"Suivi technique : pourcentage d'avancement par chantier et pour l'ensemble du projet, frise d'ordre de mise en oeuvre, et estimations resserrées"},
    {t:"imp", x:"Performance : barre de verdict plus lisible (le niveau actuel ressort, le repère est bien centré) et bloc « Ce qui va déjà bien » réaligné en deux colonnes"},
    {t:"imp", x:"Utilisateurs et accès : affichage en deux colonnes sur grand écran (utilisateurs à gauche, droits à droite)"},
    {t:"imp", x:"Le titre de page n'apparaît dans l'en-tête que lorsqu'on l'a dépassé au défilement, plus de doublon"},
    {t:"imp", x:"Versions : le retour à une version précédente est mis en avant ; étiquettes avec une majuscule"},
    {t:"fix", x:"Page d'accueil : le dégradé repasse derrière la barre de navigation dans l'aperçu"},
    {t:"fix", x:"Médiathèque : l'icône de type est bien posée sur la vignette, l'icône parasite en haut a disparu"},
    {t:"fix", x:"Statistiques : pastilles colorées derrière les icônes des indicateurs, comme ailleurs"},
    {t:"imp", x:"Tableau de bord : bloc « Échéances » retiré, avancement du projet remonté ; « Reste à faire » adouci dans les notes de version"}
  ]},
  { v:"v0.14.0", date:"2026-07-04", title:"Avancement, signalement de bug et finitions", items:[
    {t:"add", x:"Page « Avancement » : l'état, l'environnement et la version de chaque page, avec badges bêta et alpha sur le menu"},
    {t:"add", x:"Compteur de rendez-vous à venir sur l'entrée « Rendez-vous »"},
    {t:"add", x:"Signaler un problème : remonter un bug avec description et capture, sans passer par un ticket"},
    {t:"add", x:"Carte « Avancement du projet » sur le tableau de bord"},
    {t:"imp", x:"Suivi technique : plan de faisabilité repensé (cartes lisibles, effort en couleur, en-tête aligné, blocs Objectif et Coût groupés) et dossier d'intégration téléchargeable"},
    {t:"fix", x:"Bande sombre à droite de l'écran (ombre des tiroirs) supprimée"},
    {t:"fix", x:"Alignements et espacements des cartes corrigés"}
  ]},
  { v:"v0.13.0", date:"2026-07-03", title:"Journal de versions et plan d'intégration pour les devs", items:[
    {t:"add", x:"Journal des versions typé : badges Ajout, Correctif et Amélioration, et un bloc « Reste à faire », lisible par vos développeurs comme par votre client"},
    {t:"add", x:"Suivi technique : chaque chantier fournit un prompt à copier pour vos développeurs (contexte, objectif, contraintes, code)"},
    {t:"imp", x:"Suivi technique : plan de faisabilité plus lisible, avec hiérarchie, prérequis, étapes, recette, risques et angles morts, et ordre de mise en œuvre recommandé"},
    {t:"add", x:"Suivi technique : angles morts transverses et pastille de viabilité par chantier"}
  ]},
  { v:"v0.12.0", date:"2026-07-03", title:"Deuxième passe sur vos retours", items:[
    {t:"add", x:"Vue « Suivi technique » : plan de faisabilité, état des fonctionnalités et audit (réservée à l'équipe)"},
    {t:"add", x:"Journal des versions en timeline, avec points clés et prévisualisation d'une version"},
    {t:"add", x:"Médiathèque : zone d'import explicite (image et vidéo, glisser-déposer) et icône du type de fichier"},
    {t:"add", x:"Ajouter ou retirer un point dans les services (« Ce que ça change »)"},
    {t:"imp", x:"Page Performance : jauge à paliers marqués, couleurs distinctes et anneaux plus fins"},
    {t:"imp", x:"Police Urbanist et meilleur contraste dans l'interface d'édition"},
    {t:"imp", x:"Simulateur du copilote : plages de prix plus lisibles"},
    {t:"fix", x:"Coach de contenu fiabilisé (bon positionnement sur toute la fenêtre)"}
  ]},
  { v:"v0.10.1", date:"2026-07-03", title:"Performance, tutoriel guidé et copilote", items:[
    {t:"imp", x:"Refonte de la page Performance : verdict détaillé, cartes et hiérarchie claires"},
    {t:"add", x:"Tutoriel guidé (surbrillance) pour corriger un point depuis la page Performance"},
    {t:"add", x:"Vrai lecteur de fichier pour les sources du chatbot"},
    {t:"imp", x:"Copilote : actions en tuiles, notes agrandies et reprises dans le compte-rendu"},
    {t:"fix", x:"Scintillement de la médiathèque corrigé"}
  ]},
  { v:"v0.9.8", date:"2026-07-03", title:"Environnement, réglages et contenu structuré", items:[
    {t:"add", x:"Numéro de version et environnement (développement / en ligne) dans la barre latérale"},
    {t:"add", x:"Panneau Réglages (roue crantée) en tiroir latéral"},
    {t:"add", x:"Plusieurs bandeaux promo et modèles prêts à l'emploi"},
    {t:"add", x:"Éditeurs de contenu structuré : logos de confiance, avis clients, simulateur et tarifs, points de listes"},
    {t:"add", x:"Médiathèque enrichie : texte alternatif, renommage, format, dimensions et poids"},
    {t:"imp", x:"Meilleure lisibilité de la matrice des droits (Utilisateurs et accès)"},
    {t:"fix", x:"Bandeau promo : chevauchement avec la barre de navigation corrigé"},
    {t:"fix", x:"Équilibre du tableau de bord (Trafic du site et Prochains rendez-vous)"}
  ]},
  { v:"v0.9.0", date:"2026-07-03", title:"Rôles, structure et copilote", items:[
    {t:"add", x:"Rôles et droits par capacité (Utilisateurs et accès)"},
    {t:"add", x:"Page Structure et stratégie : le rôle de chaque page et de chaque section"},
    {t:"add", x:"Coach de contenu en direct dans l'éditeur"},
    {t:"add", x:"Copilote de rendez-vous : découverte guidée, chiffrage et compte-rendu"},
    {t:"add", x:"Pages Performance et Affiliation"},
    {t:"add", x:"Éditeur multi-pages, prévisualisation et glisser-déposer des sections"},
    {t:"imp", x:"Refonte du tableau de bord"}
  ]},
  { v:"v0.7.0", date:"2026-07-02", title:"Base de l'administration (première version)", items:[
    {t:"add", x:"Première version de l'admin sur-mesure pour éditer le site"},
    {t:"add", x:"Vue Rendez-vous (Calendly) : fiche unifiée et interlocuteur"},
    {t:"add", x:"Vue Chatbot : sources, périmètre et bac à test"}
  ]},
  { v:"v0.6.0", date:"2026-04-24", title:"Commande, recrutement et optimisation", items:[
    {t:"add", x:"Formulaire de commande en 3 étapes, avec estimation de prix et paiement (simulation)"},
    {t:"add", x:"Page « Postuler » : témoignages, photos et vidéos de chauffeurs et coursiers"},
    {t:"add", x:"Chatbot d'assistance sur le site"},
    {t:"add", x:"Bandeau FAQ dédié à Genève"},
    {t:"imp", x:"Traductions FR/EN généralisées à toutes les pages, tarifs revus en CHF"},
    {t:"imp", x:"Images converties en WebP et vidéos ré-encodées : site plus léger et plus rapide"}
  ]},
  { v:"v0.5.0", date:"2026-04-20", title:"Page Mobilité et navigation", items:[
    {t:"add", x:"Première version de la page « Mobilité » (statistiques et animations)"},
    {t:"add", x:"Lien « Livraison » ajouté à la navigation de toutes les pages"},
    {t:"fix", x:"Défilement et animations épinglées stabilisés sur les différents navigateurs"},
    {t:"fix", x:"Correction d'une image qui cassait l'affichage sur le serveur"}
  ]},
  { v:"v0.4.0", date:"2026-04-19", title:"Avis, FAQ et référencement", items:[
    {t:"add", x:"Carrousel d'avis clients"},
    {t:"add", x:"FAQ et prise de contact repensées"},
    {t:"imp", x:"Barre de navigation unifiée sur tout le site, menu de langue avec drapeau"},
    {t:"imp", x:"Référencement (SEO) complété avec données structurées"},
    {t:"fix", x:"Boucle du carrousel d'avis rendue fluide, sans à-coup"}
  ]},
  { v:"v0.3.0", date:"2026-04-16", title:"Récit d'accueil, carte et simulateur", items:[
    {t:"add", x:"Accueil raconté (cartes en relief, curseur personnalisé, sections narratives)"},
    {t:"add", x:"Carte de livraison interactive"},
    {t:"add", x:"Simulateur de prix repensé"},
    {t:"add", x:"Réservation façon Calendly"},
    {t:"imp", x:"Sous-titres et données structurées pour le référencement"}
  ]},
  { v:"v0.2.0", date:"2026-04-10", title:"Application web et multilingue", items:[
    {t:"add", x:"Version installable (PWA) et page de suivi de commande"},
    {t:"add", x:"Traductions complètes et réglage d'accessibilité"},
    {t:"imp", x:"Icônes, hero et sections partenaires finalisés"}
  ]},
  { v:"v0.1.0", date:"2026-04-08", title:"Naissance de Chaskis", items:[
    {t:"add", x:"Identité de marque (plusieurs itérations)"},
    {t:"add", x:"Première version du site multi-pages (accueil, tableau de bord, animations)"}
  ]}
];
const KNOWN_TODO=[
  {t:"wip", x:"Édition du grand titre d'accueil mot par mot, à rendre plus souple"},
  {t:"todo", x:"Publication réelle vers le site en ligne (aujourd'hui les changements restent dans votre navigateur)"},
  {t:"wip", x:"Chatbot : répond déjà à partir du contenu réel du site ; restent la réponse rédigée par IA (activer une clé) et l'indexation de vos propres documents importés"},
  {t:"todo", x:"Rendez-vous : connexion réelle à Calendly"},
  {t:"todo", x:"Statistiques et provenance des visiteurs réelles (sans cookie)"},
  {t:"todo", x:"Page Performance branchée sur une vraie mesure de vitesse et de référencement"},
  {t:"todo", x:"Comptes et connexion sécurisés (authentification réelle)"},
  {t:"todo", x:"Autres éditeurs de contenu : offres, FAQ, secteurs d'activité"}
];
function relDate(d){ const p=String(d).split("-"); if(p.length<3) return String(d); return parseInt(p[2],10)+" "+(REL_MONTHS[parseInt(p[1],10)-1]||"")+" "+p[0]; }
function relBadge(t){ const d=REL_TYPES[t]||REL_TYPES.add; return '<span class="rel-badge '+d.c+'"><i data-lucide="'+d.ic+'"></i>'+d.lbl+'</span>'; }
function relCounts(items){ const c={add:0,fix:0,imp:0}; items.forEach(i=>{ if(c[i.t]!=null) c[i.t]++; }); return c; }
function renderReleaseLog(){ const host=document.getElementById("relLog"); if(!host) return;
  const tot={add:0,fix:0,imp:0}; RELEASE_LOG.forEach(r=>{ const c=relCounts(r.items); tot.add+=c.add; tot.fix+=c.fix; tot.imp+=c.imp; });
  const legend='<div class="rel-legend"><span class="rel-leg">'+relBadge("add")+'<b>'+tot.add+'</b></span><span class="rel-leg">'+relBadge("fix")+'<b>'+tot.fix+'</b></span><span class="rel-leg">'+relBadge("imp")+'<b>'+tot.imp+'</b></span></div>';
  const todoLines=KNOWN_TODO.map(k=>{ const wip=k.t==="wip"; return '<div class="rel-line"><span class="rel-badge '+(wip?"bug":"todo")+'"><i data-lucide="'+(wip?"loader":"circle-dashed")+'"></i>'+(wip?"En cours":"À développer")+'</span><span class="rel-line-x">'+escHtml(k.x)+'</span></div>'; }).join("");
  const todo='<div class="rel-todo"><div class="rel-todo-h"><span class="rel-todo-ic"><i data-lucide="list-todo"></i></span>Reste à faire<span class="rel-todo-n">'+KNOWN_TODO.length+'</span></div><div class="rel-todo-sub">Ce qui n\'est pas encore branché sur le réel ou en cours de finition. Le détail technique est dans la vue Suivi technique.</div><div class="rel-todo-list">'+todoLines+'</div></div>';
  const order={add:0,fix:1,imp:2};
  let tl='<div class="vtl">';
  RELEASE_LOG.forEach(r=>{ const c=relCounts(r.items), parts=[];
    if(c.add) parts.push(c.add+" ajout"+(c.add>1?"s":"")); if(c.fix) parts.push(c.fix+" correctif"+(c.fix>1?"s":"")); if(c.imp) parts.push(c.imp+" amélioration"+(c.imp>1?"s":""));
    const sorted=r.items.slice().sort((a,b)=>(order[a.t]-order[b.t]));
    tl+='<div class="vtl-item"><div class="vtl-rail"><span class="vtl-dot'+(r.cur?" live":"")+'"></span></div><div class="vtl-card"><div class="rel-hd"><span class="rel-v">'+escHtml(r.v)+'</span>'+(r.cur?'<span class="rel-cur">version actuelle</span>':'')+'<span class="vtl-sp"></span><span class="rel-date">'+relDate(r.date)+'</span></div><div class="rel-title">'+escHtml(r.title)+'</div>'+(parts.length?'<div class="rel-counts">'+parts.join(" · ")+'</div>':'')+'<div class="rel-lines">'+sorted.map(it=>'<div class="rel-line">'+relBadge(it.t)+'<span class="rel-line-x">'+escHtml(it.x)+'</span></div>').join("")+'</div></div></div>';
  });
  tl+='</div>';
  host.innerHTML=legend+todo+tl; refreshIcons();
}
// Le journal des versions vit dans sa propre vue #view-notes (nav « Notes de version »), rendu par renderReleaseLog().
/* ============================================================
   Suivi d'avancement : etat par page (environnement + stade + version),
   badges de nav (beta / compteur RDV), signalement de bug. Vue #view-progress.
   ============================================================ */
const APP_ENV={dev:{lbl:"Développement",c:"#6B4CC4"},preprod:{lbl:"Pré-production (test)",c:"#C7891B"},prod:{lbl:"En production",c:"#0E7D48"}};
const APP_STAGE={stable:{lbl:"Stable",c:"#0E7D48"},beta:{lbl:"Bêta",c:"#C7891B"},alpha:{lbl:"Alpha",c:"#B4632A"}};
const PROGRESS=[
  {view:"dashboard",name:"Tableau de bord",env:"preprod",stage:"beta",version:"0.17.1",recent:["Demandes reçues : le consentement « actualités » donné à la commande s'affiche (tag « newsletter ok »)","Demandes du site (formulaire « Commander ») visibles et recontactables en un clic","Activité récente tirée des vraies publications"]},
  {view:"editor",name:"Édition du site",env:"preprod",stage:"beta",version:"0.14.0",recent:["Les images remplacées apparaissent sur le site en ligne après publication","Publication organisée par page (chaque page ne reçoit que ses propres textes ; le commun s'applique partout)","Publication réelle en ligne depuis le bouton Publier"]},
  {view:"structure",name:"Structure & stratégie",env:"preprod",stage:"beta",version:"0.6.1",recent:["Badge « actuellement masquée » sur les sections de l'accueil","Rôle de chaque page et section"]},
  {view:"media",name:"Médiathèque",env:"preprod",stage:"beta",version:"1.2.0",recent:["Stockage réel des fichiers en ligne (URL permanente au lieu du navigateur)","Compression et redimensionnement des images à l'import","Confirmation avant suppression d'un média"]},
  {view:"versions",name:"Versions",env:"preprod",stage:"beta",version:"0.9.0",recent:["Historique réel des publications en ligne","Restauration d'une version en un clic","Recherche et épinglage"]},
  {view:"notes",name:"Notes de version",env:"preprod",stage:"beta",version:"0.3.0",recent:["Journal typé ajout / correctif","Bloc reste à faire adouci"]},
  {view:"chatbot",name:"Chatbot",env:"prod",stage:"stable",version:"1.4.0",recent:["Réponses en direct au fil de l'eau (streaming, mot après mot)","Mémoire de conversation : l'assistant suit le fil des questions de suivi","IA générative ancrée FR/EN, périmètre strict, coût maîtrisé (repli sans coupure)"]},
  {view:"clients",name:"Clients",env:"preprod",stage:"beta",version:"0.10.0",recent:["Fenêtre Filtres : listes Commercial/Secteur recherchables à cocher (tiennent à l'échelle) + plage de dates du/au précise","Filtrer par statut (multiple), offre, et raccourcis métier (à relancer, RDV à venir, sans commercial, avec compte-rendu)","Fiche : relance intégrée (modèles), résumé, suivi qui/quand ; menu de statut aligné sur les badges"]},
  {view:"rdv",name:"Rendez-vous",env:"prod",stage:"stable",version:"1.3.0",recent:["Rédiger ou modifier le compte-rendu d'un rendez-vous depuis sa fiche, même sans le copilote (RDV sur place / après coup)","Tableau de l'équipe : rendez-vous et présence calculés sur vos vrais rendez-vous dès que Calendly est connecté ; Jean-Christophe inclus","Le taux de conversion est marqué « exemple » (pas calculable sans les abonnements du back-office)"]},
  {view:"copilot",name:"Copilote RDV",env:"preprod",stage:"beta",version:"0.8.0",recent:["Cycle complet : préparer depuis un RDV → piloter → compte-rendu rattaché au rendez-vous","Comptes-rendus récents consultables (relire / re-télécharger)","Actions plaquette/offre = email pré-rempli au prospect"]},
  {view:"stats",name:"Statistiques",env:"preprod",stage:"beta",version:"0.8.0",recent:["Audience réelle agrégée de tous les visiteurs (collecteur maison, sans cookie)","Visiteurs uniques anonymisés + filtrage des robots","Vraie mesure sans cookie (cet appareil) en repli"]},
  {view:"perf",name:"Performance",env:"preprod",stage:"beta",version:"0.11.0",recent:["Mesure automatique planifiée (tous les jours, sans clic) + historique conservé côté serveur","Google note aussi Accessibilité, SEO et Bonnes pratiques (en plus de la vitesse)","Vraies mesures Core Web Vitals, historique et reprise automatique"]},
  {view:"affiliation",name:"Affiliation",env:"preprod",stage:"beta",version:"0.5.0",recent:["Précisions du concours affichées","Alerte si stockage plein"]},
  {view:"users",name:"Utilisateurs & accès",env:"preprod",stage:"beta",version:"0.7.0",recent:["Droits vérifiés côté serveur : un rôle sans la capacité voulue est refusé (403), pas seulement masqué","Attribution d'un rôle à un compte par simple réglage (sans développement)","Libellé de rôle corrigé"]},
  {view:"progress",name:"Avancement",env:"preprod",stage:"beta",version:"0.4.0",recent:["Vrai pourcentage d'avancement de l'interface"]}
];
function rdvUpcomingCount(){ try{ if(typeof rdvData!=="undefined"&&Array.isArray(rdvData)){ const n=rdvData.filter(r=>{ const s=(r.st||r.status||"").toString().toLowerCase(); return s==="avenir"||s==="à venir"||s==="a venir"; }).length; if(n) return n; } }catch(e){} return 3; }
function applyProgressBadges(){
  // Plus de pastilles de maturité (A/B) sur CHAQUE élément du menu : c'était du bruit visuel.
  // L'état par page reste consultable dans la vue « Avancement ». On ne garde dans le menu que le
  // compteur de rendez-vous à venir (info utile, pas un marqueur de dev).
  document.querySelectorAll("#navlist .nav-i[data-view]").forEach(b=>{
    b.querySelectorAll(".nav-badge,.nav-count").forEach(x=>x.remove());
    if(b.dataset.view==="rdv"){ const c=document.createElement("span"); c.className="nav-count"; c.textContent=rdvUpcomingCount(); c.title="Rendez-vous à venir"; b.appendChild(c); }
  });
}
const APP_STAGE_H={stable:{lbl:"Prêt",pct:100,c:"#0E7D48"},beta:{lbl:"En test",pct:60,c:"#C7891B"},alpha:{lbl:"En construction",pct:30,c:"#B4632A"}};
function renderProgress(){ const el=document.getElementById("progressBody"); if(!el) return;
  const byEnv={prod:[],preprod:[],dev:[]}; PROGRESS.forEach(p=>{ (byEnv[p.env]||byEnv.preprod).push(p); });
  const total=PROGRESS.length||1;
  const pct=Math.round(PROGRESS.reduce((s,p)=>s+((APP_STAGE_H[p.stage]||APP_STAGE_H.beta).pct),0)/total);
  const cnt={prod:byEnv.prod.length,preprod:byEnv.preprod.length,dev:byEnv.dev.length};
  const sumEnvs='<div class="av-sum-envs">'+["prod","preprod","dev"].map(k=>'<span class="av-sum-env"><span class="av-dot" style="background:'+APP_ENV[k].c+'"></span><b>'+cnt[k]+'</b>'+APP_ENV[k].lbl+'</span>').join("")+'</div>';
  let h='<div class="av-wrap">';
  h+='<div class="av-sum"><div class="av-sum-l"><div class="av-sum-t">Interface d\'administration</div><div class="av-sum-cap"><b style="color:var(--teal)">'+pct+' % prêt en moyenne</b> · '+total+' pages, réparties par environnement. Le degré d\'intégration technique (mise en ligne réelle) se suit dans « Suivi technique ».</div></div><div class="av-sum-r">'+sumEnvs+'</div></div>';
  ["prod","preprod","dev"].forEach(env=>{ const list=byEnv[env]; if(!list||!list.length) return; const e=APP_ENV[env];
    h+='<div class="av-group"><div class="av-group-h"><span class="av-dot" style="background:'+e.c+'"></span>'+e.lbl+'<span class="av-group-n">'+list.length+'</span></div><div class="av-grid">'
      +list.map(p=>{ const st=APP_STAGE_H[p.stage]||APP_STAGE_H.beta;
        return '<div class="av-card"><div class="av-card-top"><span class="av-name">'+techEsc(p.name)+'</span><span class="av-ver">v'+techEsc(p.version)+'</span></div>'
          +'<div class="av-meta"><span class="av-stage" style="color:'+st.c+';background:'+st.c+'18">'+st.lbl+'</span></div>'
          +'<div class="av-detail-k">Nouveautés récentes</div><ul class="av-recent">'+(p.recent||[]).map(r=>'<li>'+techEsc(r)+'</li>').join("")+'</ul>'
          +'<button type="button" class="btn ghost sm av-open" data-goto="'+p.view+'"><i data-lucide="arrow-right"></i>Ouvrir la page</button></div>'; }).join("")
      +'</div></div>';
  });
  h+='<div class="av-key"><span class="av-key-t">Ce que veulent dire les stades</span>'
    +'<span class="av-key-i"><span class="av-key-dot" style="background:'+APP_STAGE_H.stable.c+'"></span><b>Prêt</b> utilisable en confiance</span>'
    +'<span class="av-key-i"><span class="av-key-dot" style="background:'+APP_STAGE_H.beta.c+'"></span><b>En test</b> fonctionnel, en cours de fiabilisation</span>'
    +'<span class="av-key-i"><span class="av-key-dot" style="background:'+APP_STAGE_H.alpha.c+'"></span><b>En construction</b> première ébauche, à approfondir</span></div>';
  h+='</div>';
  el.innerHTML=h;
  el.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",(ev)=>{ ev.stopPropagation(); showView(b.dataset.goto); }));
  refreshIcons();
}

const BUG_KEY="chaskis_bug_reports";
function openBugReport(){
  const old=document.getElementById("bugOv"); if(old) old.remove();
  const cur=(typeof TITLES!=="undefined"&&TITLES[loadUI().view])?TITLES[loadUI().view]:"la page actuelle";
  const ov=document.createElement("div"); ov.id="bugOv"; ov.className="thm-ov";
  ov.innerHTML='<div class="thm" role="dialog" aria-modal="true"><button class="thm-x" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
    +'<div class="thm-hd"><span class="thm-ic" style="background:#FBE4E4;color:#CF3B3B"><i data-lucide="bug"></i></span><div><div class="thm-t">Signaler un problème</div><div class="thm-s">Sur : '+techEsc(cur)+'</div></div></div>'
    +'<div class="bug-f"><label class="bug-l">Que se passe-t-il ?</label><textarea id="bugDesc" class="bug-ta" rows="4" placeholder="Décrivez le problème : ce que vous faisiez, ce qui ne va pas..."></textarea></div>'
    +'<div class="bug-f"><label class="bug-l">Capture d\'écran (optionnel)</label><label class="bug-drop" id="bugDrop"><i data-lucide="image-plus"></i><span id="bugDropTx">Cliquez pour joindre une image</span><input type="file" id="bugFile" accept="image/*" hidden></label></div>'
    +'<p class="tp-mini-note">Démo : le signalement est enregistré localement. Une fois le back-end en place, il créera un ticket pour l\'équipe (sans Jira).</p>'
    +'<div class="thm-acts"><button type="button" class="btn primary sm" id="bugSend"><i data-lucide="send"></i>Envoyer le signalement</button><button type="button" class="btn ghost sm" id="bugCancel">Annuler</button></div></div>';
  document.body.appendChild(ov);
  const close=()=>{ ov.remove(); document.removeEventListener("keydown",esc); };
  const esc=e=>{ if(e.key==="Escape") close(); };
  ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  ov.querySelector(".thm-x").addEventListener("click",close);
  ov.querySelector("#bugCancel").addEventListener("click",close);
  document.addEventListener("keydown",esc);
  let fileName="";
  const fi=ov.querySelector("#bugFile");
  ov.querySelector("#bugDrop").addEventListener("click",()=>fi.click());
  fi.addEventListener("change",()=>{ fileName=(fi.files&&fi.files[0])?fi.files[0].name:""; const tx=ov.querySelector("#bugDropTx"); if(tx) tx.textContent=fileName||"Cliquez pour joindre une image"; });
  ov.querySelector("#bugSend").addEventListener("click",()=>{
    const desc=(ov.querySelector("#bugDesc").value||"").trim();
    if(!desc){ toast("Décrivez le problème avant d'envoyer"); return; }
    let stamp; try{ stamp=new Date().toLocaleString("fr-CH"); }catch(e){ stamp=""; }
    let arr=[]; try{ arr=JSON.parse(localStorage.getItem(BUG_KEY))||[]; }catch(e){}
    arr.unshift({ page:cur, desc:desc, screenshot:fileName, at:stamp });
    try{ localStorage.setItem(BUG_KEY, JSON.stringify(arr)); }catch(e){}
    close(); toast("Signalement envoyé, merci !");
  });
  refreshIcons();
}
function initBugButton(){ const btn=document.getElementById("bugBtn"); if(!btn||btn.dataset.wired) return; btn.dataset.wired="1"; btn.addEventListener("click",openBugReport); try{ applyEnvNav(); }catch(e){} }
/* Icône de la page devant son titre : on reprend l'icône de la nav (même vue), en vert de marque. */
const VIEW_ICON={dashboard:"layout-dashboard",editor:"square-pen",structure:"route",media:"image",versions:"history",notes:"scroll-text",progress:"activity",chatbot:"bot",rdv:"calendar",copilot:"compass",stats:"bar-chart-3",perf:"gauge",affiliation:"handshake",users:"users",tech:"terminal-square"};
function decoratePageTitles(){ document.querySelectorAll(".views .view[id^='view-']").forEach(function(v){ const name=v.id.replace("view-",""); const ic=VIEW_ICON[name]; if(!ic) return; const h=v.querySelector(".pg-h"); if(!h||h.dataset.icd) return; h.dataset.icd="1"; const s=document.createElement("span"); s.className="pg-h-ic"; s.innerHTML='<i data-lucide="'+ic+'"></i>'; h.insertBefore(s,h.firstChild); }); try{ refreshIcons(); }catch(e){} }
(function(){ function _pgInit(){ try{ applyProgressBadges(); }catch(e){} try{ initBugButton(); }catch(e){} try{ decoratePageTitles(); }catch(e){} } if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",_pgInit); else _pgInit(); })();
function nextVersionId(){ const n=versions.reduce((m,x)=>Math.max(m, parseInt(String(x.id||"v0").replace(/\D/g,""))||0),0)+1; return "v"+n; }
function restoreVersion(id){ const v=versions.find(x=>x.id===id); if(!v) return false;
  if(!v.snapshot||Object.keys(v.snapshot).length===0){ toast("Version d'exemple : la restauration réelle sera disponible après votre première publication."); return false; }
  if(!confirm("Restaurer "+id+" ("+fmtShort(v.date)+") ? Vos modifications non publiées seront remplacées.")) return false;
  // Sortie de l'aperçu AVANT de persister : sinon save() est en lecture seule (garde _verPreview)
  // et l'ANNULATION du confirm laisserait le brouillon réel écrasé. On ne quitte que si confirmé.
  _verPreview=null; const bb=document.getElementById("verPreviewBar"); if(bb) bb.style.display="none";
  draft=Object.assign(blankDraft(), JSON.parse(JSON.stringify(v.snapshot||{}))); save(true);
  toast(id+" restaurée"); reloadIframe("Restauration de "+id+"…");
  renderVersions(); updateDashboard(); return true; }
function publishVersion(){ const v={ id:nextVersionId(), date:new Date().toISOString(), author:((currentUser()||{}).name||"—"), summary:humanSummary(draft), changes:humanChanges(draft), snapshot:JSON.parse(JSON.stringify(draft)) };
  versions.unshift(v); saveVersions();
  toast("Version "+v.id+" publiée"); renderVersions(); updateDashboard(); }
function previewVersion(id){ const v=versions.find(x=>x.id===id); if(!v) return;
  if(!v.snapshot||Object.keys(v.snapshot).length===0){ toast("Version d'exemple : aucun contenu à prévisualiser (disponible après votre première publication)."); return; }
  if(!_verPreview) _verPreview={ backup:JSON.parse(JSON.stringify(draft)) };
  _verPreview.id=id;
  draft=Object.assign(blankDraft(), JSON.parse(JSON.stringify(v.snapshot||{})));
  showView("editor"); reloadIframe("Aperçu de "+id+"…"); showVerPreviewBar(id); }
function showVerPreviewBar(id){ let bar=document.getElementById("verPreviewBar"); if(!bar){ bar=document.createElement("div"); bar.id="verPreviewBar"; bar.className="ver-preview-bar"; document.body.appendChild(bar); }
  bar.innerHTML='<span class="vpb-l"><i data-lucide="eye"></i>Aperçu de la version <b>'+id+'</b> · lecture seule</span><span class="vpb-r"><button class="btn ghost sm" id="vpbRestore"><i data-lucide="rotate-ccw"></i>Restaurer cette version</button><button class="btn primary sm" id="vpbExit">Quitter l\'aperçu</button></span>';
  bar.style.display="flex";
  document.getElementById("vpbExit").addEventListener("click",()=>exitVerPreview());
  document.getElementById("vpbRestore").addEventListener("click",()=>{ restoreVersion(id); }); /* restoreVersion ne quitte l'aperçu QUE si le confirm est validé (backup préservé sinon) */
  refreshIcons(); }
function exitVerPreview(){ const bar=document.getElementById("verPreviewBar"); if(bar) bar.style.display="none";
  if(_verPreview){ draft=_verPreview.backup; _verPreview=null; save(true); reloadIframe("Retour au brouillon…"); showView("versions"); } }

/* ============================================================
   Suivi technique (vue DEV, masquée en prod) : plan de faisabilité,
   état des fonctionnalités, et audit lançable (tests type unitaires).
   ============================================================ */
const TECH_EFFORT={S:"quelques heures à 1 jour", M:"1 à 3 jours", L:"3 à 6 jours"};
const TECH_VIA={ viable:{c:"ok",w:"Intégrable"}, viable_avec_reserves:{c:"warn",w:"Intégrable avec réserves"}, bloquant:{c:"ko",w:"Bloquant"} };
const TECH_PLAN=(window.CHASKIS_ADMIN||{}).TECH_PLAN||[];
const TECH_CROSS=(window.CHASKIS_ADMIN||{}).TECH_CROSS||[];
const TECH_ORDER_IDS=["host","publish","analytics","calendly","auth","perf","media","chatbot"];
const TECH_ORDER_WHY="Fondations d'abord (host pose le socle /api + SW exclu + admin sorti de Google, puis publish etablit le contrat JSON, le SHA anti-concurrence et l'allowlist anti-PII dont dependent media et chatbot). Ensuite les gains rapides reellement gratuits et a faible risque (analytics sans cookie, calendly en lecture). auth se place avant perf/chatbot pour fermer la fenetre des endpoints publics exposes. On finit par les deux plus lourds : media (Blob, upload binaire, dedup par page) et chatbot (RAG, vector store, streaming Edge), qui presupposent tous deux publish et un secret serveur sain.";
const TECH_ST={ ok:{w:"Fonctionne",c:"#0E7D48",bg:"#E3F4EA",ic:"check"}, wip:{w:"En cours",c:"#C7891B",bg:"#FBF0DD",ic:"loader"}, ko:{w:"À corriger",c:"#CF3B3B",bg:"#FBE4E4",ic:"alert-triangle"}, todo:{w:"À développer",c:"#4E77C0",bg:"#E9F0FB",ic:"circle-dashed"} };
const TECH_FEATURES=[
  { group:"Édition du site", items:[
    {n:"Édition texte / image en place (multi-pages)", s:"ok"},
    {n:"Sections : masquer, réordonner, repères stratégiques", s:"ok"},
    {n:"Contenus structurés : logos, avis, simulateur, listes", s:"ok"},
    {n:"Tutoriel guidé (spotlight)", s:"ok"},
    {n:"Édition du titre d'accueil (mot par mot, à assouplir)", s:"wip"},
    {n:"Publication réelle (JSON + redeploy)", s:"todo"} ]},
  { group:"Médiathèque", items:[
    {n:"Import image / vidéo, métadonnées, texte alternatif", s:"ok"},
    {n:"Stockage serveur des imports (aujourd'hui dataURL)", s:"todo"} ]},
  { group:"Chatbot", items:[
    {n:"Builder : sources, périmètre, comportement, bac à test", s:"ok"},
    {n:"Lecteur de fichier des sources", s:"ok"},
    {n:"Réponses en flux (streaming) + mémoire de conversation", s:"ok"},
    {n:"Moteur RAG réel (indexation + LLM)", s:"todo"} ]},
  { group:"Rendez-vous & Copilote", items:[
    {n:"Vue Rendez-vous (liste, fiche, relance)", s:"ok"},
    {n:"Copilote RDV (découverte, simulateur, compte-rendu)", s:"ok"},
    {n:"Connexion Calendly réelle (API)", s:"todo"} ]},
  { group:"Statistiques & Performance", items:[
    {n:"Vues Statistiques / Performance (démo)", s:"ok"},
    {n:"Sources de trafic + analytics réels", s:"todo"},
    {n:"Performance branchée sur PageSpeed / Lighthouse", s:"ok"},
    {n:"Mesure planifiée automatique + historique serveur", s:"ok"} ]},
  { group:"Comptes & accès", items:[
    {n:"Rôles / capacités (modèle + matrice)", s:"ok"},
    {n:"Authentification réelle (connexion Clerk)", s:"ok"},
    {n:"Droits vérifiés côté serveur (can() par capacité)", s:"ok"} ]}
];
const TECH_AUDIT=[
  {n:"Les 14 vues existent dans le DOM", fn:()=>["dashboard","editor","structure","media","versions","notes","progress","chatbot","rdv","copilot","stats","perf","affiliation","users"].every(v=>!!document.getElementById("view-"+v))},
  {n:"Navigation entre toutes les vues sans erreur", fn:()=>{ const cur=(document.querySelector(".view.on")||{}).id; ["dashboard","media","versions","notes","progress","chatbot","rdv","copilot","stats","perf","structure","affiliation","users"].forEach(v=>showView(v)); showView("tech"); return true; }},
  {n:"Tarifs : source unique partagée (paliers + zones)", fn:()=>{ const p=getPricing(); return Array.isArray(p.tiers)&&p.tiers.length>=1&&Array.isArray(p.zones)&&p.zones.length>=1; }},
  {n:"Copilote : le simulateur calcule une offre cohérente", fn:()=>{ const c=copSimCalc(); return c&&c.final>0&&c.payPer>0&&c.flex>0; }},
  {n:"Bandeaux : au moins un bandeau actif + presets", fn:()=>{ ensureBanners(); return draft.banners.length>=1&&!!activeBanner()&&BANNER_PRESETS.length>=1; }},
  {n:"Médiathèque : lecture des métadonnées (format, poids)", fn:()=>{ return mediaFormat({name:"x.webp"})==="WEBP"&&fmtBytes(238000).indexOf("Ko")>0; }},
  {n:"Droits : un administrateur a bien accès à tout", fn:()=>{ const admin=adminUsers.find(u=>u.role==="admin"); return !!admin&&can("users.manage",admin)&&can("editor.publish",admin); }},
  {n:"Droits : un éditeur peut modifier mais pas publier (distinction serveur)", fn:()=>{ const ed=adminUsers.find(u=>u.role==="editor"); return !!ed&&can("editor.edit",ed)&&!can("editor.publish",ed); }},
  {n:"Versions : un historique est disponible", fn:()=>Array.isArray(versions)&&versions.length>=1},
  {n:"Tutoriel guidé disponible et générique", fn:()=>typeof startCoach==="function"&&typeof coachTargetRect==="function"},
  {n:"Config pricing sérialisable (prête à publier)", fn:()=>{ JSON.parse(JSON.stringify(getPricing())); return true; }},
  {n:"Lecteur de fichier : pagination d'un document", fn:()=>fvPaginate("a\n\nb\n\nc").length>=1},
  {n:"Environnement dev/prod cohérent", fn:()=>{ const e=getEnv(); return e==="dev"||e==="prod"; }},
  {n:"Performance : l'analyse réelle est prête", fn:()=>typeof perfAnalyzeReal==="function"&&typeof perfBuildModel==="function"&&typeof perfAuditDoc==="function"},
  {n:"Performance : l'affichage Core Web Vitals est prêt", fn:()=>typeof cwvMeasure==="function"&&typeof renderPerfCwv==="function"&&cwvStat("lcp",1000)==="good"&&cwvStat("lcp",5000)==="bad"},
  {n:"Performance : historique serveur des mesures planifiées prêt", fn:()=>typeof cwvServerHistHtml==="function"&&typeof cwvLoadServerHist==="function"&&cwvServerHistHtml([{ts:"2026-01-01T06:00:00Z",page:"/",score:80,a11y:90,seo:100}]).indexOf("Mesures automatiques")>=0},
  {n:"Publication : le fichier à publier respecte le contrat", fn:()=>{ const c=buildSiteContent(); if(!c||c.schemaVersion!==1) return false; const allow=["schemaVersion","version","updatedAt","updatedBy","pricing","testimonials","logos","pages","chatbot"]; if(Object.keys(c).some(k=>allow.indexOf(k)<0)) return false; if(c.pricing){ const pk=["days","tiers","zones","flexMonthly","flexIncluded","express","promos"]; if(Object.keys(c.pricing).some(k=>pk.indexOf(k)<0)) return false; } if(c.pages){ const ok=["accueil","mobilite","recrutement","commander","suivi","dashboard"]; if(Object.keys(c.pages).some(k=>ok.indexOf(k)<0)) return false; } return true; }},
  {n:"Publication : le brouillon multi-pages est réparti par page", fn:()=>{
    // clé propre à une page → seulement cette page ; clé partagée → toutes les pages ; clé inconnue → toutes (repli)
    const r=bucketI18n({fr:{"m.hero.h1":"A","hero.h1":"B","foot.tag":"C","x.orphan":"D"}}, {"m.hero.h1":"mobilite","hero.h1":"accueil","foot.tag":"shared"});
    if(!r.mobilite||r.mobilite.i18n.fr["m.hero.h1"]!=="A"||r.mobilite.i18n.fr["hero.h1"]!==undefined) return false;
    if(!r.accueil||r.accueil.i18n.fr["hero.h1"]!=="B") return false;
    if(r.mobilite.i18n.fr["foot.tag"]!=="C"||r.accueil.i18n.fr["foot.tag"]!=="C") return false; // partagée partout
    if(r.commander.i18n.fr["x.orphan"]!=="D"||r.accueil.i18n.fr["x.orphan"]!=="D") return false; // inconnue → toutes
    if(r.mobilite.i18n.fr["x.orphan"]!=="D") return false;
    return true;
  }}
];
let techTab="plan";
function renderTech(){ const tabs=document.getElementById("techTabs"), body=document.getElementById("techBody"); if(!tabs||!body) return;
  const T=[["plan","Plan de faisabilité","route"],["status","État des fonctionnalités","list-checks"],["audit","Audit","flask-conical"]];
  tabs.innerHTML=T.map(t=>'<button class="tech-tab'+(t[0]===techTab?" on":"")+'" data-t="'+t[0]+'"><i data-lucide="'+t[2]+'"></i>'+t[1]+'</button>').join("");
  tabs.querySelectorAll("[data-t]").forEach(b=>b.addEventListener("click",()=>{ techTab=b.dataset.t; renderTech(); }));
  if(techTab==="plan") renderTechPlan(body); else if(techTab==="status") renderTechStatus(body); else renderTechAudit(body);
  refreshIcons();
}
function techEsc(s){ return escHtml(String(s==null?"":s)); }
const TECH_UPDATED="21 juillet 2026";
const TECH_EFF_LBL={S:"Rapide",M:"Moyen",L:"Long"};
const TECH_ASSIGN={host:"Youcef",publish:"Paul",versioning:"Paul",analytics:"Arthur",calendly:"Paul",auth:"Youcef",perf:"Arthur",media:"Arthur",chatbot:"Youcef"};
const TECH_ASSIGN_COL={Youcef:"#0F6E56",Paul:"#6B4CC4",Arthur:"#B4632A"};
const TECH_EFF_DAYS={S:[0.5,1],M:[1.5,2.5],L:[3,4]};
/* Avancement réaliste par chantier (0 à 100), calé sur l'état décrit dans chaque « Aujourd'hui ». À réviser au fil du développement : le total doit monter. */
// % = « développé & fonctionnel » (avec un compte de TEST branchable). Le passage aux comptes
// DÉFINITIFS et à l'hébergement final (Azure) est de la CONFIGURATION, suivie à part — pas du dev.
const TECH_DONE={host:92,publish:95,versioning:85,analytics:88,calendly:68,auth:88,perf:90,media:90,chatbot:90};
/* Niveaux de priorité de la frise d'ordre de mise en oeuvre (distincts des numéros de carte). */
const TECH_PRIO_TIERS=[{k:"now",w:"Prioritaire",c:"#0F6E56",bg:"#E4F4EC"},{k:"soon",w:"Important",c:"#6B5BCC",bg:"#EEEBFB"},{k:"later",w:"Plus tard",c:"#8a8c89",bg:"#F0F1F0"}];
/* Libellés courts pour la frise d'ordre (les titres de carte sont trop longs pour la timeline). */
const TECH_FLOW_SHORT={host:"Fondations Vercel",publish:"Publication réelle",versioning:"Historique et sauvegardes",analytics:"Analytics et trafic",calendly:"Rendez-vous",auth:"Authentification",perf:"Performance",media:"Médias",chatbot:"Chatbot"};
function techPrioOf(i,n){ if(i<Math.ceil(n/3)) return TECH_PRIO_TIERS[0]; if(i<Math.ceil(2*n/3)) return TECH_PRIO_TIERS[1]; return TECH_PRIO_TIERS[2]; }
function techDoneOf(b){ return (typeof TECH_DONE!=="undefined"&&TECH_DONE[b.id]!=null)?TECH_DONE[b.id]:0; }
const TECH_COST_SHORT={host:"Gratuit",publish:"Gratuit",versioning:"Gratuit",auth:"Gratuit",analytics:"Gratuit",perf:"Gratuit",chatbot:"0 à 15 CHF/mois",calendly:"Gratuit à tester · ~10 CHF/mois en temps réel",media:"Gratuit"};
const TECH_PLAN_EXTRA=[
  { id:"versioning", t:"Historique et sauvegardes du site", ic:"history", cost:"Gratuit (l'historique vit dans Git).", effort:"M", via:"viable",
    summary:"Garder l'historique des publications pour revenir à n'importe quelle version, même ancienne.",
    today:"L'admin liste quelques versions récentes en mémoire du navigateur ; rien n'est vraiment sauvegardé côté serveur, et une vieille version peut disparaître de la liste.",
    target:"Chaque publication est archivée durablement. On peut revenir à n'importe quelle version (même d'il y a un an) et épingler les versions stables ou performantes.",
    approach:"Chaque publication devient un commit Git du fichier de contenu : l'historique complet est conservé pour toujours, comparable et réversible (revenir en arrière = un revert). L'admin montre les versions récentes, une recherche dans tout l'historique, et permet d'épingler les versions clés pour qu'elles ne se perdent jamais. Aucune base de données à payer : tout vit dans Git.",
    fit:"Ça réutilise exactement le mécanisme de la publication (un commit du JSON de contenu). Git conserve tout par nature, donc rien n'est jamais perdu, même après des dizaines de publications. Le site reste statique, on ne stocke que du texte versionné.",
    prereq:["Le chantier « Publication réelle » en place (commit du contenu)","Un dépôt Git (déjà le cas)"],
    steps:["À la publication, committer le fichier de contenu (un commit = une version).","Lister les versions récentes + une recherche dans tout l'historique.","Restaurer une version = un revert Git, avec prévisualisation avant.","Permettre d'épingler des versions clés (stables ou performantes) pour les garder toujours en avant."],
    done:["On peut restaurer une version d'il y a plusieurs mois.","Les versions épinglées restent visibles quoi qu'il arrive.","Chaque version indique sa date, son auteur et un résumé."],
    risks:[{r:"Une liste de versions trop longue devient illisible.",m:"Afficher les récentes + une recherche + les épinglées, pas tout à plat."},{r:"Un mauvais retour arrière casse le site.",m:"Prévisualiser avant de restaurer et valider le contenu au moment de publier."}],
    blind:["Ne pas se limiter aux 3 dernières versions : l'historique Git complet est gratuit, autant tout garder.","Versionner TOUT le contenu éditable via un seul fichier de contenu, pas seulement index.html."],
    prompt:"Contexte. Site statique (HTML/CSS/JS vanilla, sans build) hébergé sur Vercel, déploiement auto depuis Git. Un chantier « publication » écrit déjà le contenu éditable dans un fichier site-content.json committé via l'API GitHub depuis une Function /api/publish. Objectif. Ajouter un historique de versions robuste : chaque publication = un commit ; pouvoir lister, prévisualiser et restaurer n'importe quelle version, y compris ancienne ; pouvoir « épingler » des versions clés. Contraintes. Pas de base de données (l'historique vit dans les commits Git du fichier de contenu). Secrets (token GitHub) uniquement côté serveur. Demande. Donne-moi : la stratégie Git (un commit par publication, message = résumé + auteur + date), une Function /api/history (liste paginée des commits du fichier via l'API GitHub, avec message et date), /api/restore (crée un commit qui remet le contenu d'un commit choisi = revert propre, jamais de réécriture d'historique), le stockage des versions épinglées (un petit fichier pins.json ou des tags Git), et l'UI admin (liste récente + recherche + épingles + prévisualisation avant restauration). Précise les pièges : pagination de l'API GitHub, quotas, validation du JSON avant restauration, et concurrence si deux personnes publient en même temps." }
];
const TECH_BRIEF={
  host:{ sum:"Poser le socle serveur qui rend tout le reste possible.",
    today:"Le site est en ligne, mais sans « côté serveur » pour héberger les fonctions et les clés.",
    goal:"Un petit espace serveur en place, les clés au bon endroit, et l'admin invisible pour Google.",
    cost:"Gratuit. Inclus dans l'hébergement actuel.", note:"",
    steps:["Créer un petit dossier de « fonctions » serveur à côté du site.","Y ranger les clés secrètes, jamais dans la partie visible.","Empêcher Google d'indexer la page admin.","Vérifier en ligne que tout répond."],
    src:[{t:"Vercel, tarifs",u:"https://vercel.com/pricing"}] },
  publish:{ sum:"Faire que le bouton Publier mette vraiment à jour le site en ligne.",
    today:"Les modifications restent dans le navigateur : elles n'atteignent pas encore le site public.",
    goal:"Publier enregistre le contenu durablement et le site se met à jour tout seul.",
    cost:"Gratuit. Aucune base de données à payer.", note:"",
    steps:["Définir un fichier unique qui contient tout le contenu éditable.","Le bouton Publier enregistre ce fichier de façon durable, avec un historique.","Le site se redéploie tout seul avec le nouveau contenu.","Prévoir un retour arrière simple en cas d'erreur."],
    src:[{t:"Vercel, tarifs",u:"https://vercel.com/pricing"},{t:"API GitHub (gratuite)",u:"https://docs.github.com/rest"}] },
  versioning:{ sum:"Garder l'historique des publications pour revenir à n'importe quelle version, même ancienne.",
    today:"L'admin liste quelques versions récentes en mémoire du navigateur ; une vieille version peut disparaître.",
    goal:"Chaque publication est archivée pour toujours. On restaure n'importe quelle version et on épingle les stables.",
    cost:"Gratuit. L'historique vit dans Git, aucune base à payer.", note:"",
    steps:["Chaque publication est enregistrée comme une version durable (jamais écrasée).","Garder les versions récentes accessibles en un clic.","Chercher et restaurer n'importe quelle version ancienne.","Épingler les versions stables ou performantes pour les retrouver toujours."],
    src:[{t:"Git (versionnage, gratuit)",u:"https://git-scm.com/"},{t:"API GitHub",u:"https://docs.github.com/rest"}] },
  auth:{ sum:"Mettre une vraie porte d'entrée devant l'admin, avec comptes et rôles.",
    today:"N'importe qui avec le lien peut entrer : les rôles ne sont qu'un affichage.",
    goal:"Chacun se connecte avec son compte, et les droits sont revérifiés côté serveur.",
    cost:"Gratuit jusqu'à un grand nombre de comptes.", note:"",
    steps:["Choisir un service de connexion clé en main (comptes et mots de passe gérés pour vous).","Mettre la page admin derrière cette connexion.","Associer chaque personne à son rôle.","Revérifier les droits côté serveur, pas seulement à l'écran."],
    src:[{t:"Clerk, tarifs",u:"https://clerk.com/pricing"}] },
  analytics:{ sum:"Savoir d'où viennent les visiteurs et combien de temps ils restent.",
    today:"La page Statistiques affiche des chiffres d'exemple.",
    goal:"De vraies statistiques de visites et de provenance, conformes au droit suisse.",
    cost:"Gratuit.",
    note:"L'approche « sans cookie » est justement la plus rentable en data : sans bannière, il n'y a rien à refuser, donc on garde 100 % des visites (aggrégées). Le contraire (cookies façon Google Analytics) impose une bannière et fait perdre tous ceux qui refusent. Si un besoin précis exigeait des cookies, on pourra les ajouter, mais par défaut le sans-cookie donne plus de données et zéro friction légale.",
    steps:["Ajouter un petit outil de mesure sans cookie sur toutes les pages.","Repérer d'où viennent les visiteurs (liens, réseaux, recherche).","Brancher la page Statistiques sur ces vraies données.","Ajouter une ligne dans la politique de confidentialité."],
    src:[{t:"Umami, tarifs",u:"https://umami.is/pricing"},{t:"Plausible, tarifs",u:"https://plausible.io/#pricing"}] },
  perf:{ sum:"Mesurer pour de vrai la vitesse et le référencement du site.",
    today:"Le référencement, la lisibilité et le contenu sont mesurés pour de vrai dans l'admin (bouton « Relancer l'analyse », sans outil externe). La vitesse fine (Core Web Vitals via Google PageSpeed) est ACTIVÉE et vérifiée en ligne : le bouton « Mesurer » renvoie les vraies mesures (score, LCP, stabilité, réactivité) plus les quatre notes Google (Vitesse, Accessibilité, SEO, Bonnes pratiques), par page et par appareil, avec historique et reprise automatique si l'hébergement de test coupe. Limite de l'hébergement de test (plan gratuit, coupure ~10 s) : un 1er passage prépare la mesure, un second clic peut être nécessaire ; fluide sur l'hébergement final. Reste du confort : mesure automatique planifiée à intervalle régulier.",
    goal:"Une vraie mesure de vitesse et de référencement, mise à jour automatiquement.",
    cost:"Gratuit.", note:"",
    steps:["Utiliser l'outil de mesure gratuit de Google.","Mesurer les pages clés automatiquement, à intervalle régulier.","Traduire les scores en langage clair, avec une action par point."],
    src:[{t:"Google PageSpeed API (gratuite)",u:"https://developers.google.com/speed/docs/insights/v5/get-started"}] },
  chatbot:{ sum:"Rendre le chatbot vraiment intelligent à partir de vos propres documents.",
    today:"L'assistant répond en ligne avec une VRAIE IA (réponses rédigées FR/EN), ancrée sur votre contenu et vos sources publiées, dans un périmètre strict (hors-sujet et détournements refusés), à coût maîtrisé (palier gratuit + repli sans coupure). Vérifié en direct. Restent surtout du confort : indexation de très gros documents (base vectorielle), réponses en flux (streaming), mémoire de conversation et analyse des questions sans réponse.",
    goal:"Il répond à partir de vos documents, en restant dans le périmètre autorisé.",
    cost:"0 à 15 CHF par mois selon le volume, avec un plafond.",
    note:"C'est le chantier le plus long. Le coût dépend du nombre de messages, il reste borné, et la version simple actuelle reste le filet de sécurité gratuit.",
    steps:["Lire et indexer vos documents une seule fois, à leur ajout.","À chaque question, retrouver les bons passages et répondre dans le périmètre autorisé.","Garder la version simple actuelle comme filet gratuit.","Plafonner le budget pour éviter toute surprise."],
    src:[{t:"Groq, tarifs",u:"https://groq.com/pricing"},{t:"Upstash Vector, tarifs",u:"https://upstash.com/pricing"}] },
  calendly:{ sum:"Brancher les vrais rendez-vous Calendly dans l'admin.",
    today:"Le site prend de vrais rendez-vous via le calendrier Calendly embarqué, et l'admin les fait remonter (bouton « Synchroniser Calendly ») dans la liste et « le prochain rendez-vous », attribués automatiquement au commercial disponible. La réattribution manuelle (persistée) est en place. Restent : les statistiques agrégées réelles, la remontée en temps réel (webhook), et les créneaux du site basés sur la disponibilité combinée des agendas (calendrier agrégé, Phase 2).",
    goal:"La prise de rendez-vous passe par Calendly, et les rendez-vous remontent dans l'admin.",
    cost:"Réservation gratuite, ET lecture des rendez-vous dans l'admin gratuite aussi (l'API de lecture Calendly marche sur le plan gratuit) : 0 CHF pour tester. Seul le temps réel (webhook) demande ~10 CHF/mois, pour une seule page de réservation centrale.",
    note:"Les personnes qui utilisent l'admin ne paient rien. Un seul calendrier central suffit : la redistribution entre commerciaux se fait dans l'admin, donc pas besoin du round-robin de Calendly (qui, lui, coûterait le plan Teams, ~40-48 CHF/mois pour 3 sièges). Tester coûte 0 CHF ; on ne passe au plan payant (~10 CHF/mois) que pour la remontée en temps réel.",
    steps:["Mettre le module de réservation Calendly sur le site (gratuit).","Brancher l'admin sur Calendly pour récupérer les rendez-vous.","Garder la clé Calendly côté serveur uniquement.","Option : recevoir les rendez-vous en temps réel."],
    optionsTitle:"Plusieurs commerciaux : deux pistes à étudier en interne",
    options:[
      {t:"Option A, la native (zéro développement, mais par siège)",d:"Calendly répartit tout seul les rendez-vous vers un commercial disponible (fonction « round robin »), en lisant l'agenda connecté de chacun. Le plus fiable. Coût : un siège payant par commercial qui reçoit des rendez-vous (environ 16 CHF par siège)."},
      {t:"Option B, économique (une page centrale, on répartit nous-mêmes)",d:"Un seul abonnement Calendly (~12 CHF). L'admin attribue le rendez-vous selon vos règles. Pour la disponibilité : soit un petit module d'absences dans l'admin (gratuit), soit brancher l'agenda Google de chacun (gratuit) pour n'attribuer qu'à quelqu'un de réellement libre."}
    ],
    src:[{t:"Calendly, tarifs",u:"https://calendly.com/pricing"},{t:"Calendly, webhooks",u:"https://calendly.com/help/webhooks-overview"}] },
  media:{ sum:"Stocker vraiment les images et vidéos importées, côté serveur.",
    today:"Les imports vivent dans le navigateur et ne tiennent pas en production.",
    goal:"Les fichiers sont stockés proprement et servis rapidement sur le site.",
    cost:"Gratuit pour un petit volume.", note:"",
    steps:["Envoyer les fichiers vers un vrai stockage, pas le navigateur.","Compresser et redimensionner les images à l'envoi.","Garder des chemins de fichiers propres, réutilisables sur le site."],
    src:[{t:"Vercel Blob, tarifs",u:"https://vercel.com/docs/storage/vercel-blob"}] }
};
function techAllBricks(){ return TECH_PLAN.concat(typeof TECH_PLAN_EXTRA!=="undefined"?TECH_PLAN_EXTRA:[]); }
function techPlanOrdered(){
  const all=techAllBricks();
  let order=(typeof TECH_ORDER_IDS!=="undefined"&&TECH_ORDER_IDS.length)?TECH_ORDER_IDS.slice():all.map(b=>b.id);
  all.forEach(b=>{ if(order.indexOf(b.id)<0){ if(b.id==="versioning"&&order.indexOf("publish")>=0) order.splice(order.indexOf("publish")+1,0,b.id); else order.push(b.id); } });
  return order.map(id=>all.find(b=>b.id===id)).filter(Boolean);
}
function techGlobalEstimate(){ let mn=0,mx=0; techPlanOrdered().forEach(b=>{ const d=TECH_EFF_DAYS[b.effort]||[1,3], rem=Math.max(0,1-(techDoneOf(b)/100)); mn+=d[0]*rem; mx+=d[1]*rem; }); return { pmin:Math.round(mn), pmax:Math.round(mx), pmed:Math.round((mn+mx)/2) }; }
/* Avancement global du projet : moyenne pondérée par la charge (jours médians) de chaque chantier, pour qu'un gros chantier pèse plus qu'un petit. */
function techGlobalDone(){ let num=0,den=0; techPlanOrdered().forEach(b=>{ const d=TECH_EFF_DAYS[b.effort]||[1,3], w=(d[0]+d[1])/2; num+=w*techDoneOf(b); den+=w; }); return den?Math.round(num/den):0; }
function renderTechPlan(body){
  const plan=techPlanOrdered(), est=techGlobalEstimate();
  const wk=n=>Math.max(1,Math.round(n/5)), solo=[wk(est.pmin),wk(est.pmax)], team=[wk(est.pmin/2),wk(est.pmax/2)];
  const gdone=techGlobalDone();
  let h='<div class="tp-top hb"><div class="hb-lead"><div class="tp-gdone"><div class="tp-gdone-ring" style="background:conic-gradient(var(--teal) '+(gdone*3.6)+'deg,#E7E9E7 0)"><span>'+gdone+'<i>%</i></span></div><div class="tp-gdone-tx"><div class="tp-gdone-k">Intégration technique</div><div class="tp-gdone-s">des chantiers réalisés, au '+techEsc(TECH_UPDATED)+'</div></div></div><div class="hb-stats"><div class="hb-st"><div class="hb-k">Reste à intégrer</div><div class="hb-v">environ '+est.pmed+' j</div></div><div class="hb-st"><div class="hb-k">Un dev senior seul</div><div class="hb-v">'+solo[0]+' à '+solo[1]+' sem</div></div><div class="hb-st"><div class="hb-k">En équipe</div><div class="hb-v">'+team[0]+' à '+team[1]+' sem</div></div></div></div><div class="tphx-btns"><button type="button" class="btn primary sm tphx-dl"><i data-lucide="download"></i>Télécharger le dossier d\'intégration</button><button type="button" class="btn sec-b sm tphx-md"><i data-lucide="file-code-2"></i>Version Markdown</button></div></div>';
  h+='<div class="tp-flow"><div class="tp-flow-h"><i data-lucide="route"></i>Ordre conseillé de mise en oeuvre<span class="tp-flow-leg">'+TECH_PRIO_TIERS.map(function(t){ return '<span class="tp-flow-lg" style="color:'+t.c+';background:'+t.bg+'">'+t.w+'</span>'; }).join('')+'</span></div><div class="tp-flow-track">'+plan.map(function(b,i){ var pr=techPrioOf(i,plan.length); return '<button type="button" class="tp-fstep" data-goto="'+b.id+'" style="--prc:'+pr.c+'"><span class="tp-fstep-n">'+(i+1)+'</span><span class="tp-fstep-tx"><span class="tp-fstep-t">'+techEsc(TECH_FLOW_SHORT[b.id]||b.t)+'</span><span class="tp-fstep-p" style="color:'+pr.c+';background:'+pr.bg+'">'+pr.w+'</span></span></button>'; }).join('')+'</div></div>';
  h+='<div class="tech-plan">'+plan.map((b,i)=>{
    const brief=(typeof TECH_BRIEF!=="undefined"&&TECH_BRIEF[b.id])?TECH_BRIEF[b.id]:{sum:b.summary,today:b.today,goal:b.target,cost:b.cost,note:"",steps:b.steps||[],src:[]};
    const costS=(typeof TECH_COST_SHORT!=="undefined"&&TECH_COST_SHORT[b.id])?TECH_COST_SHORT[b.id]:"";
    const effW=(typeof TECH_EFF_LBL!=="undefined"&&TECH_EFF_LBL[b.effort])?TECH_EFF_LBL[b.effort]:b.effort;
    const effE=TECH_EFFORT[b.effort]||"";
    const src=(brief.src||[]).map(s=>'<a class="tp-src-a" href="'+techEsc(s.u)+'" target="_blank" rel="noopener">'+techEsc(s.t)+'</a>').join('<span class="tp-src-sep">·</span>');
    return '<div class="tp-card" id="tb-'+b.id+'">'
      +'<div class="tp-card-hd"><span class="tp-num2">'+(i+1)+'</span><span class="tp-card-ic"><i data-lucide="'+b.ic+'"></i></span><span class="tp-card-t">'+techEsc(b.t)+'</span></div>'
      +'<div class="tp-card-meta"><span class="tp-chip ok"><i data-lucide="check"></i>Intégrable</span><span class="tp-chip cost"><i data-lucide="wallet"></i>'+techEsc(costS)+'</span><span class="tp-chip time eff-'+b.effort+'"><i data-lucide="clock"></i>'+techEsc(effW)+' · '+techEsc(effE)+'</span></div>'
      +(function(){ var dn=techDoneOf(b); return '<div class="tp-prog"><div class="tp-prog-top"><span class="tp-prog-k">Avancement</span><span class="tp-prog-v">'+dn+'%</span></div><div class="tp-prog-bar"><span style="width:'+dn+'%"></span></div></div>'; })()
      +'<div class="tp-card-brief">'+techEsc(brief.sum)+'</div>'
      +'<div class="tpk-box tpk-now"><div class="tpk-kv"><span class="tpk-k">Aujourd\'hui</span><span class="tpk-v">'+techEsc(brief.today)+'</span></div></div>'
      +'<div class="tpk-box tpk-goal"><div class="tpk-kv"><span class="tpk-k">Objectif</span><span class="tpk-v">'+techEsc(brief.goal)+'</span></div>'
      +'<div class="tpk-kv"><span class="tpk-k">Coût</span><span class="tpk-v">'+techEsc(brief.cost).replace(/^([^.]*\.)/,'<b>$1</b>')+'</span></div>'+(src?'<div class="tpk-src">Sources : '+src+'</div>':'')+'</div>'
      +(brief.note?'<div class="tp-notew"><button type="button" class="tp-note-t" data-note="'+b.id+'"><i data-lucide="info"></i>À savoir<svg class="tech-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div class="tp-note-b" id="note-'+b.id+'" hidden>'+techEsc(brief.note)+'</div></div>':'')
      +'<div class="tp-cardbottom">'+(TECH_ASSIGN[b.id]?'<div class="tp-assign"><span class="tp-assign-av" style="background:'+(TECH_ASSIGN_COL[TECH_ASSIGN[b.id]]||"#2C2052")+'">'+techEsc(TECH_ASSIGN[b.id].charAt(0))+'</span><span>Suggéré&nbsp;: <b>'+techEsc(TECH_ASSIGN[b.id])+'</b></span></div>':'')+'<div class="tp-card-foot"><button type="button" class="tp-how" data-how="'+b.id+'"><i data-lucide="list-checks"></i>Comment le mettre en place</button><button type="button" class="btn sec-b sm tp-copy" data-copy="'+b.id+'"><i data-lucide="copy"></i>Copier le prompt</button></div></div>'
      +'</div>';
  }).join("")+'</div>';
  body.innerHTML=h;
  body.querySelectorAll(".tp-how").forEach(btn=>btn.addEventListener("click",()=>openTechHow(btn.dataset.how)));
  body.querySelectorAll(".tp-copy").forEach(btn=>btn.addEventListener("click",()=>{ const b=techAllBricks().find(x=>x.id===btn.dataset.copy); if(!b) return; const t=b.prompt||""; if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(()=>toast("Prompt copié · "+b.t),()=>toast("Copie indisponible")); } else toast("Copie indisponible"); }));
  body.querySelectorAll(".tp-note-t").forEach(btn=>btn.addEventListener("click",()=>{ const nb=document.getElementById("note-"+btn.dataset.note); if(nb){ nb.hidden=!nb.hidden; btn.classList.toggle("on",!nb.hidden); } }));
  body.querySelectorAll(".tphx-dl").forEach(function(b){ b.addEventListener("click",downloadTechDocHtml); });
  body.querySelectorAll(".tphx-md").forEach(function(b){ b.addEventListener("click",downloadTechDoc); });
  body.querySelectorAll(".tp-fstep").forEach(function(b){ b.addEventListener("click",function(){ var c=document.getElementById("tb-"+b.dataset.goto); if(c){ c.scrollIntoView({behavior:"smooth",block:"center"}); c.classList.add("tp-card-flash"); setTimeout(function(){ c.classList.remove("tp-card-flash"); },900); } }); });
  refreshIcons();
}
function openTechHow(id){
  const b=techAllBricks().find(x=>x.id===id), br=(TECH_BRIEF[id]||{}); if(!b) return;
  const old=document.getElementById("techHowOv"); if(old) old.remove();
  const ov=document.createElement("div"); ov.id="techHowOv"; ov.className="thm-ov";
  let inner='<div class="thm" role="dialog" aria-modal="true"><button class="thm-x" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
    +'<div class="thm-hd"><span class="thm-ic"><i data-lucide="'+b.ic+'"></i></span><div><div class="thm-t">'+techEsc(b.t)+'</div><div class="thm-s">Comment le mettre en place</div></div></div>'
    +((b.prereq&&b.prereq.length)?'<div class="thm-sec"><div class="thm-sec-k">Avant de commencer</div><ul class="thm-list">'+b.prereq.slice(0,3).map(p=>'<li>'+techEsc(p)+'</li>').join("")+'</ul></div>':'')+'<div class="thm-sec"><div class="thm-sec-k">Les étapes</div><ol class="tp-steps2 thm-steps">'+(br.steps||[]).map(s=>'<li>'+techEsc(s)+'</li>').join("")+'</ol></div>'+((b.done&&b.done.length)?'<div class="thm-sec"><div class="thm-sec-k">C\'est fait quand</div><ul class="thm-list chk">'+b.done.slice(0,3).map(d=>'<li>'+techEsc(d)+'</li>').join("")+'</ul></div>':'');
  if(br.options&&br.options.length){ inner+='<div class="thm-opts"><div class="thm-opts-h"><i data-lucide="git-fork"></i>'+techEsc(br.optionsTitle||"À étudier")+'</div>'+br.options.map(o=>'<div class="thm-opt"><b>'+techEsc(o.t)+'</b><span>'+techEsc(o.d)+'</span></div>').join("")+'</div>'; }
  inner+='<p class="tp-mini-note">Étapes techniques détaillées, code et risques : dans le dossier à télécharger.</p>';
  inner+='<div class="thm-acts"><button type="button" class="btn primary sm" id="thmCopy"><i data-lucide="copy"></i>Copier le prompt</button><button type="button" class="btn ghost sm" id="thmDl"><i data-lucide="download"></i>Télécharger le dossier</button></div></div>';
  ov.innerHTML=inner; document.body.appendChild(ov);
  const close=()=>{ ov.remove(); document.removeEventListener("keydown",esc); };
  const esc=e=>{ if(e.key==="Escape") close(); };
  ov.addEventListener("click",e=>{ if(e.target===ov) close(); });
  ov.querySelector(".thm-x").addEventListener("click",close);
  document.addEventListener("keydown",esc);
  ov.querySelector("#thmCopy").addEventListener("click",()=>{ const t=b.prompt||""; if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(()=>toast("Prompt copié · "+b.t),()=>toast("Copie indisponible")); else toast("Copie indisponible"); });
  ov.querySelector("#thmDl").addEventListener("click",downloadTechDocHtml);
  refreshIcons();
}
function techDownload(name,content,mime){
  try{ const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1500); toast("Dossier téléchargé"); }
  catch(e){ toast("Téléchargement indisponible"); }
}
function downloadTechDoc(){
  const plan=techPlanOrdered(), est=techGlobalEstimate(); const L=[];
  L.push("# Chaskis, dossier d'intégration technique"); L.push("");
  L.push("Mis à jour le "+TECH_UPDATED+". Estimation avec assistance IA : environ "+est.pmin+" à "+est.pmax+" jours-personne pour tout intégrer."); L.push("");
  L.push("Objectif : gratuit ou le moins cher possible, véloce, solide. Le site reste statique et servi par CDN, la donnée éditable est un JSON versionné dans Git, tout secret vit côté serveur."); L.push("");
  L.push("## Ordre de mise en oeuvre recommandé"); L.push("");
  plan.forEach((b,i)=>L.push((i+1)+". "+b.t));
  if(typeof TECH_ORDER_WHY!=="undefined"&&TECH_ORDER_WHY){ L.push(""); L.push("> "+TECH_ORDER_WHY); }
  L.push("");
  if(typeof TECH_CROSS!=="undefined"&&TECH_CROSS.length){ L.push("## Angles morts transverses"); TECH_CROSS.forEach(c=>{ L.push(""); L.push("- **"+c.title+"** "+c.detail); }); L.push(""); }
  plan.forEach((b,i)=>{
    L.push(""); L.push("---"); L.push(""); L.push("## "+(i+1)+". "+b.t); L.push("");
    L.push("- **Coût** : "+b.cost); L.push("- **Effort (avec IA)** : "+(TECH_EFFORT[b.effort]||b.effort)); L.push("");
    L.push("**En bref.** "+b.summary); L.push(""); L.push("**Aujourd'hui.** "+b.today); L.push(""); L.push("**Cible.** "+b.target); L.push("");
    L.push("**Comment on s'y prend.** "+b.approach); L.push(""); L.push("**Pourquoi c'est intégrable.** "+b.fit);
    if(b.prereq&&b.prereq.length){ L.push(""); L.push("**Prérequis.**"); L.push(""); b.prereq.forEach(p=>L.push("- "+p)); }
    L.push(""); L.push("**Étapes.**"); L.push(""); b.steps.forEach((s,j)=>L.push((j+1)+". "+s));
    if(b.done&&b.done.length){ L.push(""); L.push("**C'est fait quand.**"); L.push(""); b.done.forEach(d=>L.push("- "+d)); }
    if(b.risks&&b.risks.length){ L.push(""); L.push("**Risques et parades.**"); L.push(""); b.risks.forEach(r=>L.push("- "+r.r+" Parade : "+r.m)); }
    if(b.blind&&b.blind.length){ L.push(""); L.push("**Angles morts.**"); L.push(""); b.blind.forEach(x=>L.push("- "+x)); }
    L.push(""); L.push("**Prompt à copier pour vos développeurs.**"); L.push(""); L.push("```"); L.push(b.prompt); L.push("```");
  });
  techDownload("chaskis-dossier-integration.md", L.join("\n"), "text/markdown;charset=utf-8");
}
function downloadTechDocHtml(){
  const plan=techPlanOrdered(), est=techGlobalEstimate(); const e=s=>techEsc(s);
  let H='<section class="doc"><h1>Chaskis, dossier d\'intégration technique</h1>';
  H+='<p class="lead">Comment brancher l\'admin sur du réel, brique par brique. Objectif : gratuit ou le moins cher possible, véloce, solide.</p>';
  H+='<p class="muted">Mis à jour le '+e(TECH_UPDATED)+'.</p>';
  H+='<div class="box"><b>Estimation avec assistance IA :</b> environ '+est.pmin+' à '+est.pmax+' jours-personne pour tout intégrer.</div>';
  H+='<h2>Ordre de mise en oeuvre recommandé</h2><ol class="order">'+plan.map(b=>'<li>'+e(b.t)+'</li>').join("")+'</ol>';
  if(typeof TECH_ORDER_WHY!=="undefined"&&TECH_ORDER_WHY) H+='<p class="muted">'+e(TECH_ORDER_WHY)+'</p>';
  if(typeof TECH_CROSS!=="undefined"&&TECH_CROSS.length){ H+='<h2>Angles morts transverses</h2><ul class="cross">'+TECH_CROSS.map(c=>'<li><b>'+e(c.title)+'.</b> '+e(c.detail)+'</li>').join("")+'</ul>'; }
  plan.forEach((b,i)=>{
    const br=TECH_BRIEF[b.id]||{};
    H+='<article class="chap"><h2><span class="cn">'+(i+1)+'</span>'+e(b.t)+'</h2>';
    H+='<div class="meta"><span class="m ok">Intégrable</span><span class="m">'+e(b.cost)+'</span><span class="m">Effort : '+e(TECH_EFFORT[b.effort]||b.effort)+'</span></div>';
    H+='<p class="brief">'+e(br.sum||b.summary)+'</p>';
    H+='<div class="two"><div><h4>Aujourd\'hui</h4><p>'+e(b.today)+'</p></div><div><h4>Cible</h4><p>'+e(b.target)+'</p></div></div>';
    H+='<h4>Comment on s\'y prend</h4><p>'+e(b.approach)+'</p><h4>Pourquoi c\'est intégrable</h4><p>'+e(b.fit)+'</p>';
    if(b.prereq&&b.prereq.length){ H+='<h4>Prérequis</h4><ul>'+b.prereq.map(p=>'<li>'+e(p)+'</li>').join("")+'</ul>'; }
    H+='<h4>Étapes</h4><ol>'+b.steps.map(s=>'<li>'+e(s)+'</li>').join("")+'</ol>';
    if(b.done&&b.done.length){ H+='<h4>C\'est fait quand</h4><ul class="chk">'+b.done.map(d=>'<li>'+e(d)+'</li>').join("")+'</ul>'; }
    if(b.risks&&b.risks.length){ H+='<h4>Risques et parades</h4><ul class="risks">'+b.risks.map(r=>'<li><b>'+e(r.r)+'</b><br><span class="par">Parade : '+e(r.m)+'</span></li>').join("")+'</ul>'; }
    if(b.blind&&b.blind.length){ H+='<h4>Angles morts</h4><ul>'+b.blind.map(x=>'<li>'+e(x)+'</li>').join("")+'</ul>'; }
    H+='<h4>Prompt pour vos développeurs</h4><pre><code>'+e(b.prompt)+'</code></pre></article>';
  });
  H+='</section>';
  const css='body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#221a3d;background:#f6f5fb;margin:0;padding:32px 16px;line-height:1.6}.doc{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e7e4f0;border-radius:16px;padding:40px 44px;box-shadow:0 8px 30px rgba(40,32,60,.06)}h1{font-size:26px;margin:0 0 6px}.lead{font-size:15px;color:#4a4363;margin:0 0 4px}.muted{color:#8a84a0;font-size:13px}h2{font-size:19px;margin:34px 0 10px;padding-bottom:8px;border-bottom:2px solid #efedf7}h2 .cn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#2C2052;color:#fff;font-size:14px;margin-right:10px;vertical-align:middle}h4{font-size:12px;color:#6b4cc4;margin:18px 0 5px}.box{background:#eef7f4;border:1px solid #c9ebe3;border-radius:10px;padding:12px 14px;margin:14px 0;font-size:14px}.chap{border-top:1px solid #efedf7;padding-top:6px;margin-top:24px}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}.meta .m{font-size:12px;font-weight:600;background:#f1eff9;color:#4a4363;border-radius:20px;padding:3px 11px}.meta .m.ok{background:#e1f5ee;color:#0f6e56}.brief{font-size:15px;font-weight:600}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:620px){.two{grid-template-columns:1fr}}.order li,.cross li{margin-bottom:5px}.risks li{margin-bottom:9px}.risks .par{color:#0f6e56}.chk{padding-left:0}.chk li{list-style:none;position:relative;padding-left:20px}.chk li::before{content:"\\2713";position:absolute;left:0;color:#0f6e56;font-weight:700}pre{background:#14112b;color:#dcd8f2;border-radius:12px;padding:16px 18px;overflow:auto;font-size:12.5px;line-height:1.55}code{font-family:ui-monospace,Menlo,Consolas,monospace}a{color:#6b4cc4}';
  const full='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chaskis, dossier d\'intégration technique</title><style>'+css+'</style></head><body>'+H+'</body></html>';
  techDownload("chaskis-dossier-integration.html", full, "text/html;charset=utf-8");
}
function renderTechStatus(body){
  const all=TECH_FEATURES.reduce((a,g)=>a.concat(g.items),[]), by=s=>all.filter(x=>x.s===s).length;
  const legend=["ok","wip","ko","todo"].map(s=>{ const st=TECH_ST[s]; return '<span class="tech-leg"><span class="tech-leg-dot" style="background:'+st.c+'"></span>'+st.w+' <b>'+by(s)+'</b></span>'; }).join("");
  body.innerHTML='<div class="tech-intro"><i data-lucide="list-checks"></i><div>État réel de chaque fonctionnalité, pour que l\'équipe sache d\'un coup d\'œil ce qui tourne, ce qui reste à faire, et les bugs.</div></div>'
    +'<div class="tech-legend">'+legend+'</div>'
    +TECH_FEATURES.map(g=>'<div class="tech-fgroup"><div class="tech-fgroup-t">'+g.group+'</div>'+g.items.map(it=>{ const st=TECH_ST[it.s]; return '<div class="tech-frow"><span class="tech-fic" style="background:'+st.bg+';color:'+st.c+'"><i data-lucide="'+st.ic+'"></i></span><span class="tech-fn">'+escHtml(it.n)+'</span><span class="tech-fs" style="color:'+st.c+';background:'+st.bg+'">'+st.w+'</span></div>'; }).join("")+'</div>').join("");
}
function renderTechAudit(body){
  body.innerHTML='<div class="tech-intro"><i data-lucide="flask-conical"></i><div>Vérifie automatiquement que les fonctionnalités clés répondent (façon tests unitaires). À lancer après chaque changement pour repérer une régression.</div></div>'
    +'<button class="btn primary" id="techRunAudit"><i data-lucide="play"></i>Lancer l\'audit</button>'
    +'<div id="techAuditOut" class="tech-audit-out"><p class="hint" style="margin:14px 0 0">'+TECH_AUDIT.length+' vérifications prêtes. Cliquez « Lancer l\'audit ».</p></div>';
  const run=document.getElementById("techRunAudit"); if(run) run.addEventListener("click",runTechAudit);
}
function runTechAudit(){ if(!document.getElementById("techAuditOut")) return;
  const t0=(window.performance&&performance.now)?performance.now():0;
  const results=TECH_AUDIT.map(c=>{ let pass=false, err=""; try{ pass=!!c.fn(); }catch(e){ pass=false; err=e.message||String(e); } return {n:c.n, pass, err}; });
  const okN=results.filter(r=>r.pass).length, ms=Math.round(((window.performance&&performance.now)?performance.now():0)-t0);
  const out=document.getElementById("techAuditOut"); if(!out) return; /* re-query : un test navigue entre les vues et peut avoir re-rendu l'onglet */
  out.innerHTML='<div class="ta-sum '+(okN===results.length?"ok":"fail")+'"><span class="ta-sum-n">'+okN+' / '+results.length+'</span> vérifications réussies · '+ms+' ms</div>'
    +results.map(r=>'<div class="ta-row '+(r.pass?"pass":"fail")+'"><span class="ta-ic"><i data-lucide="'+(r.pass?"check":"x")+'"></i></span><span class="ta-n">'+escHtml(r.n)+'</span>'+(r.err?'<span class="ta-err">'+escHtml(r.err)+'</span>':'<span class="ta-ok-lbl">OK</span>')+'</div>').join("");
  refreshIcons(); toast(okN===results.length?"Audit : tout est vert ("+okN+"/"+results.length+")":"Audit : "+okN+"/"+results.length+" réussis"); }

/* ============================================================
   Performance (ébauche : scores d'exemple, à brancher sur PageSpeed / Lighthouse)
   ============================================================ */
/* Performance en langage non-initié : le sens d'abord, le terme technique en second (détail repliable). */
const PF_C={good:{c:"#0F6E56",bg:"#E1F5EE",w:"Bon"},warn:{c:"#C7891B",bg:"#FBF0DD",w:"À améliorer"},bad:{c:"#B23B3B",bg:"#FBE4E4",w:"Problème"}};
function pfStat(st){ return PF_C[st]||PF_C.good; }
/* échelle granulaire par score (vert -> rouge), pour ne pas afficher un 82 en marron. */
/* Échelle à 4 niveaux : rouge / orange / jaune / vert (le vert = finalité, un seul vert, pas de vert foncé). */
const PF_SCALE=[
  {min:80, c:"#2AA45C", bg:"#E4F5EC", w:"Bon"},
  {min:60, c:"#D2A00C", bg:"#FAF2CF", w:"Correct"},
  {min:40, c:"#E07B22", bg:"#FCEAD7", w:"À surveiller"},
  {min:0,  c:"#D23B3B", bg:"#FBE1E1", w:"Critique"}
];
function pfScore(score){ for(let i=0;i<PF_SCALE.length;i++){ if(score>=PF_SCALE[i].min) return PF_SCALE[i]; } return PF_SCALE[PF_SCALE.length-1]; }
const GAMMA="Gamma Project";
/* anneau de score réutilisable (global + par pilier) */
function perfRing(score, size, col, sw){ const s=Math.max(0,Math.min(100,score)), w=sw||(size<50?4:6), r=(size-w-3)/2, cx=size/2, c=2*Math.PI*r, off=c*(1-s/100);
  return '<div class="pring" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'"><circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="#ECEAF1" stroke-width="'+w+'"/>'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 '+cx+' '+cx+')"/></svg>'
    +'<span class="pring-v" style="color:'+col+';font-size:'+Math.round(size*0.33)+'px">'+score+'</span></div>'; }
function perfFix(a){ const fx=a.fix||{}; if(!fx.goto) return; showView(fx.goto);
  if(fx.goto==="editor" && fx.target){ startCoach([{sel:fx.target, title:fx.coachTitle||"À modifier ici", text:fx.coachText||fx.guide||""}]); }
  else if(fx.guide){ setTimeout(()=>toast(fx.guide),380); } }
function perfSignalGamma(){ toast("Point signalé à "+GAMMA+" (démo)"); }
/* ---- Tutoriel guidé (spotlight) : met en avant l'élément à modifier, sans presser ---- */
let _coach=null;
function coachTargetRect(step, doScroll){
  let el=null;
  if(step.sel){ if(!DOC) return null; el=DOC.querySelector(step.sel); }
  else if(step.parentSel){ el=document.querySelector(step.parentSel); }
  if(!el) return null;
  if(doScroll){ try{ el.scrollIntoView({block:"center"}); }catch(e){} }
  const er=el.getBoundingClientRect(); if(er.width===0 && er.height===0) return null;
  if(step.sel){ const ir=iframe.getBoundingClientRect(); return {left:ir.left+er.left, top:ir.top+er.top, width:er.width, height:er.height}; }
  return {left:er.left, top:er.top, width:er.width, height:er.height};
}
function startCoach(steps){ endCoach(); if(!steps||!steps.length) return;
  _coach={steps, i:0};
  const hole=document.createElement("div"); hole.className="coach-hole"; hole.id="coachHole";
  const pop=document.createElement("div"); pop.className="coach-pop"; pop.id="coachPop";
  document.body.appendChild(hole); document.body.appendChild(pop);
  _coach.hole=hole; _coach.pop=pop;
  window.addEventListener("resize", coachReposition);
  window.addEventListener("keydown", coachKey, true);
  showCoachStep(0);
}
function showCoachStep(i){ if(!_coach) return; _coach.i=i; const step=_coach.steps[i]; let tries=0;
  const attempt=()=>{ if(!_coach) return; const r=coachTargetRect(step, true);
    if(!r){ if(tries++<40){ _coach._t=setTimeout(attempt,120); return; } endCoach(); return; }
    if(DOC && !DOC.__coachScroll){ DOC.__coachScroll=1; DOC.addEventListener("scroll", coachReposition, true); }
    renderCoachPop(step); positionCoach(r);
    requestAnimationFrame(()=>{ if(_coach){ _coach.hole.classList.add("show"); _coach.pop.classList.add("show"); } });
    /* le layout bouge après coup (repli auto de la sidebar, scroll) : on recale à plusieurs reprises pour rester aligné quelle que soit la taille de fenêtre */
    [90,260,520,900].forEach(d=>setTimeout(()=>{ if(_coach) coachReposition(); }, d));
    /* sélectionne tout le texte de la cible une fois qu'elle est éditable (après initEditMode) : on voit ce qui va changer et on peut retaper */
    setTimeout(()=>{ if(_coach) selectCoachTarget(step); }, 320);
  };
  attempt();
}
function renderCoachPop(step){ const pop=_coach.pop, n=_coach.steps.length, last=_coach.i>=n-1;
  pop.innerHTML='<button class="coach-pop-x" id="coachX" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
    +'<div class="coach-pop-step">'+(n>1?("Étape "+(_coach.i+1)+" / "+n):'<span class="coach-pop-badge"><i data-lucide="wand-2"></i>Guide pas à pas</span>')+'</div>'
    +'<div class="coach-pop-t">'+step.title+'</div><div class="coach-pop-b">'+step.text+'</div>'
    +'<div class="coach-pop-cta">'+(last?'<button class="btn sm primary" id="coachDone">Compris</button>':'<button class="btn ghost sm" id="coachSkip">Passer</button><button class="btn sm primary" id="coachNext">Suivant</button>')+'</div>';
  const x=pop.querySelector("#coachX"); if(x) x.addEventListener("click",endCoach);
  const d=pop.querySelector("#coachDone"); if(d) d.addEventListener("click",endCoach);
  const sk=pop.querySelector("#coachSkip"); if(sk) sk.addEventListener("click",endCoach);
  const nx=pop.querySelector("#coachNext"); if(nx) nx.addEventListener("click",()=>showCoachStep(_coach.i+1));
  refreshIcons();
}
function positionCoach(r){ if(!_coach) return; const pad=7, gap=12, hole=_coach.hole, pop=_coach.pop;
  hole.style.left=(r.left-pad)+"px"; hole.style.top=(r.top-pad)+"px"; hole.style.width=(r.width+2*pad)+"px"; hole.style.height=(r.height+2*pad)+"px";
  const pr=pop.getBoundingClientRect(), vw=innerWidth, vh=innerHeight;
  let top=r.top+r.height+pad+gap; if(top+pr.height>vh-12) top=r.top-pad-gap-pr.height; if(top<12) top=12;
  let left=r.left+r.width/2-pr.width/2; left=Math.max(12, Math.min(vw-pr.width-12, left));
  pop.style.top=top+"px"; pop.style.left=left+"px";
}
function coachReposition(){ if(!_coach) return; const r=coachTargetRect(_coach.steps[_coach.i], false); if(r) positionCoach(r); }
function selectCoachTarget(step){ if(!step||!step.sel||!DOC||typeof WIN==="undefined"||!WIN) return; try{ const el=DOC.querySelector(step.sel); if(!el||!el.isContentEditable) return;
  /* pour un élément éditable d'un bloc (paragraphe), on donne le focus + on sélectionne tout : prêt à retaper. Le titre est découpé en mots, on se contente du spotlight. */
  el.focus(); const rng=DOC.createRange(); rng.selectNodeContents(el); const sel=WIN.getSelection(); sel.removeAllRanges(); sel.addRange(rng); }catch(e){} }
function coachKey(e){ if(e.key==="Escape"){ e.preventDefault(); endCoach(); } }
function endCoach(){ if(!_coach) return; if(_coach._t) clearTimeout(_coach._t);
  window.removeEventListener("resize", coachReposition); window.removeEventListener("keydown", coachKey, true);
  if(DOC && DOC.__coachScroll){ DOC.removeEventListener("scroll", coachReposition, true); DOC.__coachScroll=0; }
  if(_coach.hole) _coach.hole.remove(); if(_coach.pop) _coach.pop.remove(); _coach=null;
}
const PERF_PILLARS=[
  { key:"speed", icon:"zap", title:"Rapidité", status:"good", score:90,
    plain:"Votre site s'affiche vite",
    benefit:"Vos visiteurs voient la page presque tout de suite. Un site lent, et beaucoup repartent avant même d'avoir vu votre offre.",
    detail:[
      {k:"Affichage du contenu principal", tech:"LCP", v:"2,1 s", st:"good"},
      {k:"Réactivité quand on clique", tech:"INP", v:"180 ms", st:"good"},
      {k:"La page ne saute pas au chargement", tech:"CLS", v:"0,12", st:"warn"},
      {k:"Temps de réponse du serveur", tech:"TTFB", v:"0,6 s", st:"good"}
    ] },
  { key:"seo", icon:"search", title:"Référencement", status:"warn", score:74,
    plain:"Google vous trouve et vous comprend",
    benefit:"C'est ce qui amène des clients depuis Google sans payer de publicité. Bien réglé, vous remontez dans les résultats.",
    detail:[
      {k:"Titre et description de chaque page", tech:"balises title / meta", v:"complets", st:"good"},
      {k:"Plan du site fourni à Google", tech:"sitemap.xml", v:"présent", st:"good"},
      {k:"Fiche d'infos pour Google (avis, horaires…)", tech:"données structurées", v:"manque sur 3 pages", st:"warn"},
      {k:"Liens qui ne mènent nulle part", tech:"erreurs 404", v:"aucun", st:"good"},
      {k:"Adapté au téléphone", tech:"responsive", v:"oui", st:"good"}
    ] },
  { key:"a11y", icon:"eye", title:"Lisibilité pour tous", status:"warn", score:82,
    plain:"Votre site est lisible par le plus grand nombre",
    benefit:"Un site lisible par tous, y compris les personnes âgées ou malvoyantes, c'est plus de clients, et Google le récompense.",
    detail:[
      {k:"Contraste des textes", tech:"ratio 4.5:1", v:"2 zones justes", st:"warn"},
      {k:"Descriptions des images", tech:"attribut alt", v:"3 manquantes", st:"warn"},
      {k:"Navigation au clavier", tech:"focus", v:"complète", st:"good"},
      {k:"Étiquettes des formulaires", tech:"labels", v:"toutes présentes", st:"good"},
      {k:"Ordre des titres", tech:"H1 puis H2, H3", v:"cohérent", st:"good"}
    ] }
];
const PF_IMPACT={fort:{c:"#B23B3B",bg:"#FBE4E4",w:"Priorité forte"},moyen:{c:"#9A6A15",bg:"#FBF0DD",w:"Priorité moyenne"},leger:{c:"#2F6FE0",bg:"#E6F1FB",w:"Petit plus"}};
const PF_IMPACT_ORDER={fort:0,moyen:1,leger:2};
/* fix.mode : "self" = corrigeable soi-même (bouton qui emmène au bon endroit + guide) ; "gamma" = à confier à Gamma Project. */
const PERF_ACTIONS=[
  { title:"Le titre de la page d'accueil est un peu court", impact:"moyen", area:"Référencement", icon:"heading",
    why:"Le grand titre est ce que Google lit en premier, et ce qui donne envie de rester. Trop court ou trop vague, votre message ne passe pas.",
    fix:{mode:"self", goto:"editor", label:"Modifier le titre", target:".hero h1",
      coachTitle:"Votre titre principal", coachText:"Cliquez ce titre pour le modifier. En quelques mots clairs, dites ce que vous apportez et pour qui : c'est la première chose que lisent vos visiteurs et Google.",
      guide:"Dans l'éditeur, cliquez le grand titre en haut de la page et reformulez-le en disant clairement ce que vous apportez."} },
  { title:"Une page manque un peu de texte", impact:"moyen", area:"Référencement", icon:"file-text",
    why:"Google a besoin de mots pour comprendre le sujet de la page et bien vous classer. Une page presque vide est difficile à référencer.",
    fix:{mode:"self", goto:"editor", label:"Étoffer le texte", target:".hero-sub",
      coachTitle:"Le texte d'introduction", coachText:"Cliquez ce texte pour l'enrichir. Ajoutez une phrase avec les mots de vos clients (livraison, coursier, Genève…) : plus de contenu utile aide Google à bien vous classer.",
      guide:"Dans l'éditeur, ajoutez un ou deux paragraphes qui décrivent votre service avec les mots de vos clients."} },
  { title:"3 images n'ont pas de description", impact:"moyen", area:"Référencement et lisibilité", icon:"image",
    why:"Une description aide Google à comprendre l'image, et permet aux personnes malvoyantes de savoir ce qu'elle montre.",
    fix:{mode:"gamma", note:"L'ajout d'une description d'image arrive bientôt dans l'éditeur. En attendant, "+GAMMA+" peut le faire pour vous."} },
  { title:"La fiche d'infos Google manque sur 3 pages", impact:"moyen", area:"Référencement", icon:"tag",
    why:"Cette fiche permet à Google d'afficher vos avis, horaires ou prix directement dans les résultats.",
    fix:{mode:"gamma", note:"C'est un réglage technique, "+GAMMA+" s'en occupe. Rien à faire de votre côté."} },
  { title:"2 textes sont un peu clairs sur fond blanc", impact:"leger", area:"Lisibilité", icon:"contrast",
    why:"Un gris trop clair est dur à lire, surtout au soleil sur un téléphone ou pour une personne âgée.",
    fix:{mode:"gamma", note:"La couleur des textes fait partie du design, "+GAMMA+" l'ajuste."} }
];
const PERF_GOOD=[
  {t:"Votre site s'affiche vite, vos visiteurs n'attendent pas.", cat:"Rapidité"},
  {t:"Le titre et la description de vos pages sont complets.", cat:"Référencement"},
  {t:"Google a le plan de votre site et le parcourt bien.", cat:"Référencement"},
  {t:"Aucun lien cassé sur le site.", cat:"Référencement"},
  {t:"Votre site s'adapte au téléphone.", cat:"Rapidité"},
  {t:"On peut naviguer entièrement au clavier.", cat:"Lisibilité"},
  {t:"Vos formulaires sont bien étiquetés.", cat:"Lisibilité"}
];
const PERF_CONTENT_INTRO="Vos textes parlent à Google autant qu'à vos visiteurs. Quand vous ou votre équipe modifiez un texte, ces points peuvent bouger. Gardez-les au vert pour ne pas perdre en visibilité.";
const PERF_CONTENT=[
  {k:"Un grand titre clair par page", st:"good", plain:"Chaque page a un titre principal unique qui dit tout de suite de quoi elle parle.", tip:"Un seul grand titre par page, court et parlant."},
  {k:"Une description qui donne envie", st:"good", plain:"Le petit texte affiché sous votre lien dans Google est rempli.", tip:"120 à 160 caractères, donnez envie de cliquer."},
  {k:"Assez de texte sur la page", st:"good", plain:"Vos pages ont assez de contenu pour que Google comprenne le sujet.", tip:"Ne videz pas une page de son texte, Google a besoin de mots pour vous classer."},
  {k:"Les mots que cherchent vos clients", st:"warn", plain:"Les termes que tapent vos clients (livraison, coursier, Genève…) doivent apparaître dans vos textes.", tip:"Écrivez avec les mots de vos clients, pas du jargon interne."},
  {k:"Des images décrites", st:"warn", plain:"Chaque image porte une courte description, utile à Google comme aux malvoyants.", tip:"Une phrase qui dit ce qu'on voit."}
];
/* ============================================================
   Analyse Performance RÉELLE (aucune API externe, 100% navigateur).
   Récupère les pages publiques, parse leur HTML et mesure des signaux
   vérifiables : Référencement (title, meta, H1, données structurées,
   langue, sitemap), Lisibilité (alt d'images, étiquettes de champs,
   ordre des titres) et Contenu. La vitesse fine (Core Web Vitals) reste
   estimée jusqu'à l'étape Lighthouse ; on affiche le poids réel des pages.
   Repli : si la récupération échoue, on garde les données d'exemple (démo).
   Les valeurs par défaut (PERF_PILLARS/ACTIONS/GOOD/CONTENT) restent la
   démo tant qu'aucune analyse réelle n'a tourné (perfLive === null).
   ============================================================ */
const PERF_PAGES=[
  {file:"index.html",label:"Accueil"},
  {file:"mobilite.html",label:"Mobilité"},
  {file:"postuler.html",label:"Recrutement"},
  {file:"commander.html",label:"Commander"},
  {file:"dashboard.html",label:"Tableau de bord"}
];
const PERF_LIVE_KEY="chaskis_perf_live";
let perfLive=null;
try{ var _perfRaw=localStorage.getItem(PERF_LIVE_KEY); if(_perfRaw) perfLive=JSON.parse(_perfRaw); }catch(e){ perfLive=null; }
function perfPillars(){ return (perfLive&&perfLive.pillars)||PERF_PILLARS; }
function perfActs(){ return (perfLive&&perfLive.actions)||PERF_ACTIONS; }
function perfGoods(){ return (perfLive&&perfLive.good)||PERF_GOOD; }
function perfConts(){ return (perfLive&&perfLive.content)||PERF_CONTENT; }
function perfClone(o){ return JSON.parse(JSON.stringify(o)); }
function perfAuditDoc(doc){
  var qa=function(s){ return Array.prototype.slice.call(doc.querySelectorAll(s)); };
  var tEl=doc.querySelector("title"), title=tEl?(tEl.textContent||"").trim():"";
  var dEl=doc.querySelector('meta[name="description"]'), desc=dEl?(dEl.getAttribute("content")||"").trim():"";
  var imgs=qa("img"), imgsNoAlt=imgs.filter(function(im){ return !im.hasAttribute("alt"); }).length;
  var levels=qa("h1,h2,h3,h4,h5,h6").map(function(h){ return +h.tagName.charAt(1); });
  var skip=false, prev=0; levels.forEach(function(l){ if(prev&&l>prev+1) skip=true; prev=l; });
  var fields=qa("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea");
  var fieldsNoLabel=fields.filter(function(el){
    if(el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")) return false;
    var id=el.getAttribute("id");
    if(id){ try{ if(doc.querySelector('label[for="'+((window.CSS&&CSS.escape)?CSS.escape(id):id)+'"]')) return false; }catch(e){} }
    if(el.closest&&el.closest("label")) return false;
    return true;
  }).length;
  var body=doc.body?doc.body.cloneNode(true):null;
  if(body){ Array.prototype.slice.call(body.querySelectorAll("script,style,noscript,template")).forEach(function(n){ n.remove(); }); }
  var txt=body?(body.textContent||"").replace(/\s+/g," ").trim():"";
  return { title:title, titleLen:title.length, desc:desc, descLen:desc.length,
    h1:qa("h1").length, imgs:imgs.length, imgsNoAlt:imgsNoAlt,
    jsonld:qa('script[type="application/ld+json"]').length,
    lang:(doc.documentElement.getAttribute("lang")||"").trim(),
    skip:skip, fields:fields.length, fieldsNoLabel:fieldsNoLabel,
    words:txt?txt.split(" ").filter(Boolean).length:0,
    viewport:!!doc.querySelector('meta[name="viewport"]'),
    canonical:!!doc.querySelector('link[rel="canonical"]'),
    og:(!!doc.querySelector('meta[property="og:title"]')||!!doc.querySelector('meta[property="og:image"]')),
    assetRefs:qa("script[src]").length+qa('link[rel="stylesheet"]').length+imgs.length };
}
function perfBuildModel(pages,sitemap){
  var n=pages.length, sum=function(f){ return pages.reduce(function(a,p){ return a+f(p); },0); };
  var names=function(pred){ return pages.filter(pred).map(function(p){ return p.label; }); };
  var join=function(a){ return a.join(", "); };
  var noTitle=names(function(p){ return !p.titleLen; }), badTitle=names(function(p){ return p.titleLen&&(p.titleLen<20||p.titleLen>70); });
  var noDesc=names(function(p){ return !p.descLen; }), longDesc=names(function(p){ return p.descLen>170; }), shortDesc=names(function(p){ return p.descLen&&p.descLen<70; });
  var noH1=names(function(p){ return p.h1===0; }), multiH1=names(function(p){ return p.h1>1; });
  var noLang=names(function(p){ return !p.lang; }), noJsonld=names(function(p){ return p.jsonld===0; });
  var noViewport=names(function(p){ return !p.viewport; }), noCanonical=names(function(p){ return !p.canonical; }), noOg=names(function(p){ return !p.og; });
  var titleMap={}, descMap={};
  pages.forEach(function(p){ var t=(p.title||"").trim().toLowerCase(); if(t){ (titleMap[t]=titleMap[t]||[]).push(p.label); } var d=(p.desc||"").trim().toLowerCase(); if(d){ (descMap[d]=descMap[d]||[]).push(p.label); } });
  var dupTitle=Object.keys(titleMap).filter(function(k){ return titleMap[k].length>1; }).length;
  var dupDesc=Object.keys(descMap).filter(function(k){ return descMap[k].length>1; }).length;
  var seo=100-(noTitle.length*15+badTitle.length*4+noDesc.length*12+longDesc.length*4+shortDesc.length*3+noH1.length*10+multiH1.length*4+noLang.length*10+noJsonld.length*3+(sitemap?0:6)+noCanonical.length*3+noOg.length*2+dupTitle*4+dupDesc*3);
  seo=Math.max(0,Math.min(100,Math.round(seo)));
  var totNoAlt=sum(function(p){ return p.imgsNoAlt; }), totNoLabel=sum(function(p){ return p.fieldsNoLabel; });
  var skips=names(function(p){ return p.skip; });
  var a11y=100-(Math.min(30,totNoAlt*3)+Math.min(20,totNoLabel*3)+skips.length*5+noLang.length*8);
  a11y=Math.max(0,Math.min(100,Math.round(a11y)));
  var avgKb=Math.round(sum(function(p){ return p.bytes||0; })/n/1024), avgReq=Math.round(sum(function(p){ return p.assetRefs; })/n);
  var speed=100; if(avgKb>120) speed-=16; else if(avgKb>70) speed-=6; if(avgReq>40) speed-=10; else if(avgReq>25) speed-=4;
  speed=Math.max(45,Math.min(94,speed));
  var st=function(sc){ return sc>=80?"good":sc>=60?"warn":"bad"; };
  var base=perfClone(PERF_PILLARS), P={}; base.forEach(function(p){ P[p.key]=p; });
  P.seo.score=seo; P.seo.status=st(seo);
  P.seo.detail=[
    {k:"Titre et description de chaque page", tech:"title / meta", v:(noTitle.length||noDesc.length)?"à compléter":"complets", st:(noTitle.length||noDesc.length)?"warn":"good"},
    {k:"Longueur des descriptions", tech:"meta description", v:(longDesc.length||shortDesc.length)?((longDesc.length?(longDesc.length+" trop longue"+(longDesc.length>1?"s":"")):"")+(longDesc.length&&shortDesc.length?", ":"")+(shortDesc.length?(shortDesc.length+" trop courte"+(shortDesc.length>1?"s":"")):"")):"optimales", st:(longDesc.length||shortDesc.length)?"warn":"good"},
    {k:"Un seul titre principal par page", tech:"balise H1", v:noH1.length?("manque sur "+noH1.length):(multiH1.length?("plusieurs sur "+multiH1.length):"oui"), st:(noH1.length||multiH1.length)?"warn":"good"},
    {k:"Fiche d'infos pour Google", tech:"données structurées", v:noJsonld.length?("manque sur "+noJsonld.length+" page"+(noJsonld.length>1?"s":"")):"présentes", st:noJsonld.length?"warn":"good"},
    {k:"Plan du site fourni à Google", tech:"sitemap.xml", v:sitemap?"présent":"absent", st:sitemap?"good":"warn"},
    {k:"Adapté au téléphone", tech:"balise viewport", v:noViewport.length?("à revoir sur "+noViewport.length):"oui", st:noViewport.length?"warn":"good"},
    {k:"Aperçu lors du partage", tech:"Open Graph", v:noOg.length?("manque sur "+noOg.length+" page"+(noOg.length>1?"s":"")):"complet", st:noOg.length?"warn":"good"},
    {k:"Titres uniques par page", tech:"balise title", v:dupTitle?(dupTitle+" en double"):"tous distincts", st:dupTitle?"warn":"good"}
  ];
  P.a11y.score=a11y; P.a11y.status=st(a11y);
  P.a11y.detail=[
    {k:"Descriptions des images", tech:"attribut alt", v:totNoAlt?(totNoAlt+" manquante"+(totNoAlt>1?"s":"")):"toutes présentes", st:totNoAlt?"warn":"good"},
    {k:"Étiquettes des formulaires", tech:"labels", v:totNoLabel?(totNoLabel+" champ"+(totNoLabel>1?"s":"")+" sans étiquette"):"toutes présentes", st:totNoLabel?"warn":"good"},
    {k:"Langue de la page déclarée", tech:"attribut lang", v:noLang.length?(noLang.length+" page"+(noLang.length>1?"s":"")+" sans langue"):"oui, partout", st:noLang.length?"warn":"good"},
    {k:"Ordre des titres", tech:"H1 puis H2, H3", v:skips.length?("à revoir sur "+skips.length):"cohérent", st:skips.length?"warn":"good"}
  ];
  P.speed.score=speed; P.speed.status=st(speed);
  P.speed.detail=[
    {k:"Poids moyen d'une page", tech:"HTML", v:avgKb+" Ko", st:avgKb>120?"warn":"good"},
    {k:"Éléments chargés par page", tech:"estimation", v:String(avgReq), st:avgReq>40?"warn":"good"},
    {k:"Vitesse ressentie", tech:"LCP / INP / CLS", v:"mesure fine à venir (Lighthouse)", st:"warn"}
  ];
  var acts=[];
  if(noH1.length) acts.push({ title:"Titre principal (H1) manquant sur "+join(noH1), impact:"fort", area:"Référencement", icon:"heading", why:"Le titre principal (H1) indique à Google le sujet de la page. Sans lui, la page est plus difficile à référencer.", fix:{mode:"gamma", note:"Ajouter un titre principal est un réglage de structure, "+GAMMA+" s'en occupe."} });
  if(!sitemap) acts.push({ title:"Le plan du site (sitemap.xml) est absent", impact:"fort", area:"Référencement", icon:"map", why:"Le plan du site aide Google à découvrir toutes vos pages rapidement.", fix:{mode:"gamma", note:GAMMA+" peut générer et publier le plan du site."} });
  if(longDesc.length) acts.push({ title:"Description trop longue sur "+join(longDesc), impact:"moyen", area:"Référencement", icon:"text", why:"Au-delà d'environ 160 caractères, Google coupe la description dans les résultats : votre phrase d'accroche est tronquée.", fix:{mode:"gamma", note:"L'ajustement des descriptions arrive bientôt dans l'éditeur. En attendant, "+GAMMA+" peut les raccourcir."} });
  if(noJsonld.length) acts.push({ title:"Fiche d'infos Google manquante sur "+noJsonld.length+" page"+(noJsonld.length>1?"s":""), impact:"moyen", area:"Référencement", icon:"tag", why:"Cette fiche permet à Google d'afficher vos avis, horaires ou prix directement dans les résultats.", fix:{mode:"gamma", note:"C'est un réglage technique, "+GAMMA+" s'en occupe."} });
  if(totNoAlt) acts.push({ title:totNoAlt+" image"+(totNoAlt>1?"s":"")+" sans description", impact:"moyen", area:"Référencement et lisibilité", icon:"image", why:"Une description aide Google à comprendre l'image et permet aux personnes malvoyantes de savoir ce qu'elle montre.", fix:{mode:"gamma", note:"L'ajout d'une description d'image arrive bientôt dans l'éditeur. En attendant, "+GAMMA+" peut le faire."} });
  if(totNoLabel) acts.push({ title:totNoLabel+" champ"+(totNoLabel>1?"s":"")+" de formulaire sans étiquette", impact:"moyen", area:"Lisibilité", icon:"form-input", why:"Ces champs s'appuient seulement sur le texte gris d'exemple (placeholder), qui disparaît dès qu'on écrit et n'est pas lu de façon fiable par les lecteurs d'écran. Une étiquette visible aide tout le monde à savoir quoi remplir.", fix:{mode:"gamma", note:"Ajouter les étiquettes de formulaire est un réglage de gabarit, "+GAMMA+" s'en occupe."} });
  if(shortDesc.length) acts.push({ title:"Description un peu courte sur "+join(shortDesc), impact:"leger", area:"Référencement", icon:"text", why:"Une description trop courte n'exploite pas toute la place offerte par Google pour donner envie de cliquer.", fix:{mode:"gamma", note:GAMMA+" peut étoffer ces descriptions."} });
  if(skips.length) acts.push({ title:"Ordre des titres à revoir sur "+join(skips), impact:"leger", area:"Lisibilité", icon:"list", why:"Un saut de niveau (par exemple un H3 sans H2 avant) gêne les lecteurs d'écran et la lecture par Google.", fix:{mode:"gamma", note:GAMMA+" peut réordonner les titres."} });
  if(noOg.length) acts.push({ title:"Aperçu de partage manquant sur "+join(noOg), impact:"leger", area:"Référencement", icon:"share-2", why:"Sans ces informations, un lien de votre site partagé sur les réseaux ou par messagerie s'affiche sans titre ni image, et donne beaucoup moins envie de cliquer.", fix:{mode:"gamma", note:GAMMA+" peut ajouter l'aperçu de partage (Open Graph)."} });
  if(dupTitle) acts.push({ title:"Des pages partagent le même titre", impact:"moyen", area:"Référencement", icon:"copy", why:"Deux pages avec un titre identique se font concurrence dans Google et sèment la confusion. Chaque page gagne à avoir un titre unique et parlant.", fix:{mode:"gamma", note:GAMMA+" peut différencier les titres des pages concernées."} });
  var good=[];
  if(!totNoAlt) good.push({t:"Toutes vos images ont une description.", cat:"Lisibilité"});
  if(!noLang.length) good.push({t:"Chaque page déclare sa langue.", cat:"Lisibilité"});
  if(sitemap) good.push({t:"Google a le plan de votre site.", cat:"Référencement"});
  if(!noTitle.length&&!noDesc.length) good.push({t:"Chaque page a un titre et une description.", cat:"Référencement"});
  if(!noH1.length&&!multiH1.length) good.push({t:"Un seul titre principal par page.", cat:"Référencement"});
  if(!totNoLabel) good.push({t:"Vos formulaires sont bien étiquetés.", cat:"Lisibilité"});
  if(avgKb<=120) good.push({t:"Vos pages sont légères ("+avgKb+" Ko de HTML en moyenne).", cat:"Rapidité"});
  if(!noViewport.length) good.push({t:"Vos pages s'adaptent au téléphone.", cat:"Rapidité"});
  if(!noOg.length) good.push({t:"L'aperçu de partage sur les réseaux est configuré.", cat:"Référencement"});
  var lowText=names(function(p){ return p.words<80; });
  var content=[
    {k:"Un grand titre clair par page", st:(noH1.length||multiH1.length)?"warn":"good", plain:"Chaque page a un titre principal unique qui dit tout de suite de quoi elle parle.", tip:"Un seul grand titre par page, court et parlant."},
    {k:"Une description qui donne envie", st:(noDesc.length||longDesc.length||shortDesc.length)?"warn":"good", plain:"Le petit texte affiché sous votre lien dans Google est rempli et bien dimensionné.", tip:"120 à 160 caractères, donnez envie de cliquer."},
    {k:"Assez de texte sur la page", st:lowText.length?"warn":"good", plain:"Vos pages ont assez de contenu pour que Google comprenne le sujet.", tip:"Ne videz pas une page de son texte, Google a besoin de mots pour vous classer."},
    {k:"Des images décrites", st:totNoAlt?"warn":"good", plain:"Chaque image porte une courte description, utile à Google comme aux malvoyants.", tip:"Une phrase qui dit ce qu'on voit."}
  ];
  return { pillars:[P.speed,P.seo,P.a11y], actions:acts, good:good, content:content };
}
async function perfAnalyzeReal(){
  var btn=document.getElementById("perfRun");
  if(btn){ if(btn.dataset.busy==="1") return; btn.dataset.busy="1"; btn.disabled=true; btn.innerHTML='<i data-lucide="refresh-cw"></i>Analyse en cours…'; refreshIcons(); }
  var pages=[];
  for(var i=0;i<PERF_PAGES.length;i++){
    var p=PERF_PAGES[i];
    try{
      var res=await fetch("/"+p.file,{cache:"no-store"});
      var html=await res.text();
      var doc=new DOMParser().parseFromString(html,"text/html");
      var a=perfAuditDoc(doc); a.file=p.file; a.label=p.label; a.status=res.status;
      try{ a.bytes=new Blob([html]).size; }catch(e){ a.bytes=html.length; }
      pages.push(a);
    }catch(e){}
  }
  var sitemap=false; try{ var sm=await fetch("/sitemap.xml",{cache:"no-store"}); sitemap=sm.ok; }catch(e){}
  if(btn){ btn.dataset.busy="0"; btn.disabled=false; btn.innerHTML='<i data-lucide="refresh-cw"></i>Relancer l\'analyse'; refreshIcons(); }
  if(!pages.length){ toast("Analyse impossible (pages non accessibles). Données d'exemple conservées."); return; }
  perfLive=perfBuildModel(pages,sitemap); perfLive.at=Date.now(); perfLive.n=pages.length;
  try{ localStorage.setItem(PERF_LIVE_KEY,JSON.stringify(perfLive)); localStorage.setItem("chaskis_perf_last",String(perfLive.at)); }catch(e){}
  perfPushHistory(perfLive);
  toast("Analyse réelle terminée : "+pages.length+" pages mesurées"); renderPerf();
}
function perfUpdateNote(){ var el=document.getElementById("perfDraftNote"); if(!el) return;
  if(perfLive&&perfLive.at){ el.innerHTML="Analyse réelle du "+escHtml(new Date(perfLive.at).toLocaleString("fr-CH",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"}))+" : référencement, lisibilité et contenu mesurés sur vos "+(perfLive.n||0)+" pages. La vitesse fine (Core Web Vitals) sera mesurée à l'étape Lighthouse."; }
  else{ el.innerHTML="Ébauche : les résultats affichés sont des exemples. Cliquez « Relancer l'analyse » pour lancer un audit réel de votre site (référencement, lisibilité, contenu). La vitesse fine (Core Web Vitals) arrivera avec l'étape Lighthouse."; }
}
const PERF_HIST_KEY="chaskis_perf_hist";
function perfHistory(){ try{ var h=JSON.parse(localStorage.getItem(PERF_HIST_KEY)); return Array.isArray(h)?h:[]; }catch(e){ return []; } }
function perfPushHistory(model){ if(!model||!model.pillars) return; var by={}; model.pillars.forEach(function(p){ by[p.key]=p.score; }); var ov=Math.round(model.pillars.reduce(function(a,p){ return a+p.score; },0)/model.pillars.length); var h=perfHistory(); h.unshift({at:model.at, overall:ov, speed:by.speed, seo:by.seo, a11y:by.a11y}); h=h.slice(0,12); try{ localStorage.setItem(PERF_HIST_KEY,JSON.stringify(h)); }catch(e){} }
function renderPerfHistory(){ var w=document.getElementById("perfHistory"); if(!w) return; var h=perfHistory();
  if(h.length<2){ w.innerHTML=""; w.style.display="none"; return; } w.style.display="";
  var rows=h.slice(0,6).map(function(e,i){ var prev=h[i+1]; var d=prev?(e.overall-prev.overall):0; var darr=d>0?("+"+d):(d<0?String(d):"="); var dc=d>0?"#0E7D48":(d<0?"#B23B3B":"#8a8c89");
    var dt=new Date(e.at).toLocaleString("fr-CH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    return '<div style="display:flex;align-items:center;gap:12px;padding:9px 2px;border-top:1px solid #EEF0EE;font-size:14px">'
      +'<span style="color:var(--muted,#6b6f6b);min-width:132px">'+escHtml(dt)+'</span>'
      +'<span style="font-weight:700;color:var(--ink,#1a1a1a)">'+e.overall+'<small style="font-weight:500;color:var(--muted,#8a8c89)">/100</small></span>'
      +'<span style="font-weight:600;color:'+dc+';min-width:34px">'+darr+'</span>'
      +'<span style="color:var(--muted,#6b6f6b);margin-left:auto;font-size:13px">Réf. '+(e.seo!=null?e.seo:"–")+' · Lis. '+(e.a11y!=null?e.a11y:"–")+' · Rap. '+(e.speed!=null?e.speed:"–")+'</span></div>';
  }).join("");
  w.innerHTML='<div class="dpan"><div class="pan-head"><h4><span class="hic teal"><i data-lucide="history"></i></span> Historique des analyses</h4><span class="hint" style="margin:0">'+h.length+' analyse'+(h.length>1?"s":"")+' enregistrée'+(h.length>1?"s":"")+'</span></div><div>'+rows+'</div></div>';
  refreshIcons();
}
function renderPerf(){
  const last=document.getElementById("perfLast"); if(last){ let _pl=null; try{ _pl=localStorage.getItem("chaskis_perf_last"); }catch(e){} const _n=_pl!=null?+_pl:NaN; last.textContent=Number.isFinite(_n)?("Dernière analyse : "+new Date(_n).toLocaleString("fr-CH",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"})):"Analyse pas encore lancée"; }
  perfUpdateNote();
  const scores=perfPillars().map(p=>p.score), overall=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  renderPerfVerdict(overall); renderPerfHistory();
  renderPerfPillars(); renderPerfActions(); renderPerfGood(); renderPerfContent();
  wirePerfCwv(); renderPerfCwv(); cwvLoadServerHist();
  refreshIcons();
}
/* ============================================================
   Core Web Vitals RÉELS (vitesse mesurée par Google via /api/perf).
   L'audit local ci-dessus mesure référencement / lisibilité / poids ;
   la vitesse fine (LCP, stabilité, réactivité) ne peut venir que d'une
   mesure externe. Cet endpoint la fournit dès qu'une clé PageSpeed
   (gratuite) est configurée côté hébergement ; sinon on l'annonce
   honnêtement et l'estimation locale reste affichée. Repli SILENCIEUX :
   pas de clé de publication / endpoint absent / erreur -> aucun plantage,
   la démo et l'audit local restent intacts.
   ============================================================ */
const PERF_CWV_KEY="chaskis_perf_cwv";
let perfCwv=null; try{ var _cwvRaw=localStorage.getItem(PERF_CWV_KEY); if(_cwvRaw) perfCwv=JSON.parse(_cwvRaw); }catch(e){ perfCwv=null; }
let cwvPage="index.html", cwvStrategy="mobile", perfCwvWired=false;
/* Seuils officiels Google (bon / à améliorer / mauvais). */
const CWV_TH={ lcp:{g:2500,w:4000}, cls:{g:0.1,w:0.25}, tbt:{g:200,w:600}, fcp:{g:1800,w:3000}, si:{g:3400,w:5800} };
const CWV_METRICS=[
  {k:"lcp", plain:"Affichage du contenu principal", tech:"LCP", hint:"Temps avant que l'élément principal (grande image ou titre) soit visible."},
  {k:"cls", plain:"Stabilité de la page", tech:"CLS", hint:"La page ne « saute » pas pendant le chargement."},
  {k:"tbt", plain:"Réactivité aux clics", tech:"TBT", hint:"Temps pendant lequel la page ne répond pas aux interactions."},
  {k:"fcp", plain:"Premier affichage", tech:"FCP", hint:"Temps avant le tout premier élément visible."},
  {k:"si", plain:"Vitesse d'affichage globale", tech:"Speed Index", hint:"Rapidité de remplissage visuel de la page."}
];
/* Les 4 domaines notés par Google (Lighthouse) dans le même passage — l'avis de Google,
   en complément de l'audit local de l'admin (méthodes différentes, chiffres différents). */
const CWV_CATS=[
  {k:"performance", plain:"Vitesse"},
  {k:"accessibility", plain:"Accessibilité"},
  {k:"seo", plain:"Référencement"},
  {k:"bestPractices", plain:"Bonnes pratiques"}
];
const PERF_CWV_HIST_KEY="chaskis_perf_cwv_hist";
function cwvHistory(){ try{ var h=JSON.parse(localStorage.getItem(PERF_CWV_HIST_KEY)); return Array.isArray(h)?h:[]; }catch(e){ return []; } }
function cwvPushHistory(c){ if(!c||c.status!=="ok") return; var cat=c.categories||{};
  var h=cwvHistory(); h.unshift({at:c.at, page:c.page, label:c.label, strategy:c.strategy, score:(c.score!=null?c.score:null), a11y:(cat.accessibility!=null?cat.accessibility:null), seo:(cat.seo!=null?cat.seo:null)});
  h=h.slice(0,10); try{ localStorage.setItem(PERF_CWV_HIST_KEY,JSON.stringify(h)); }catch(e){} }
function cwvStat(k,v){ if(v==null||!isFinite(v)) return "warn"; var t=CWV_TH[k]; if(!t) return "warn"; return v<=t.g?"good":(v<=t.w?"warn":"bad"); }
function cwvVal(metrics,k){ var m=(metrics&&metrics[k])||{}; var num=(k==="cls")?m.value:m.ms; if(num==null||!isFinite(num)) return {num:null,disp:"–"};
  var disp=m.display; if(!disp){ disp=(k==="cls")?String(Math.round(num*100)/100):(num>=1000?(Math.round(num/100)/10+" s"):(Math.round(num)+" ms")); } return {num:num,disp:disp}; }
function persistCwv(){ try{ if(perfCwv&&perfCwv.status!=="measuring") localStorage.setItem(PERF_CWV_KEY,JSON.stringify(perfCwv)); }catch(e){} }
function wirePerfCwv(){ if(perfCwvWired) return; perfCwvWired=true;
  var sel=document.getElementById("perfCwvPage");
  if(sel){ sel.innerHTML=PERF_PAGES.map(function(p){ return '<option value="'+p.file+'">'+escHtml(p.label)+'</option>'; }).join("");
    sel.value=cwvPage; sel.addEventListener("change",function(e){ cwvPage=e.target.value; }); enhanceSelect(sel); }
  var seg=document.getElementById("perfCwvStrat");
  if(seg){ seg.querySelectorAll("button[data-s]").forEach(function(b){ b.addEventListener("click",function(){ cwvStrategy=b.dataset.s; seg.querySelectorAll("button").forEach(function(x){ x.classList.toggle("on",x===b); }); }); }); }
  var btn=document.getElementById("perfCwvRun"); if(btn) btn.addEventListener("click",cwvMeasure);
}
function cwvDelay(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
async function cwvOneFetch(url,key){
  var res=await fetch("/api/perf?url="+encodeURIComponent(url)+"&strategy="+encodeURIComponent(cwvStrategy),{ headers:{ "Authorization":"Bearer "+key }, cache:"no-store" });
  var data=null; try{ data=await res.json(); }catch(e){}
  if(res.ok&&data&&data.ok) return {status:"ok", score:data.score, categories:data.categories, metrics:data.metrics};
  if(res.status===501) return {status:"not-activated"};
  if(res.status===401) return {status:"bad-key"};
  if(res.status===429) return {status:"quota"};
  if(res.status===504) return {status:"timeout"};
  return {status:"error", msg:(data&&data.error)||("échec de la mesure ("+res.status+")")};
}
async function cwvMeasure(){
  var btn=document.getElementById("perfCwvRun");
  var key=getStoredPublishKey();
  var page=cwvPage||"index.html";
  var lbl=(PERF_PAGES.filter(function(p){ return p.file===page; })[0]||{}).label||page;
  if(!key){ perfCwv={status:"need-key", page:page, label:lbl, strategy:cwvStrategy, at:Date.now()}; persistCwv(); renderPerfCwv(); toast("Clé de publication requise (page Publier) pour mesurer la vitesse."); return; }
  if(btn){ if(btn.dataset.busy==="1") return; btn.dataset.busy="1"; btn.disabled=true; btn.innerHTML='<i data-lucide="loader-2"></i>Mesure en cours…'; refreshIcons(); }
  /* Le 1er passage « amorce » souvent le cache Google (délai dépassé sur hébergement de test) ;
     un 2e/3e essai dans la foulée récupère le résultat en cache. On reprend AUTOMATIQUEMENT
     sur un délai dépassé pour éviter à l'utilisateur de recliquer. Seul le timeout est réessayé. */
  var url=location.origin+"/"+page, out=null, maxTries=3;
  for(var attempt=1; attempt<=maxTries; attempt++){
    perfCwv={status:"measuring", page:page, label:lbl, strategy:cwvStrategy, at:Date.now(), attempt:attempt, maxTries:maxTries}; renderPerfCwv();
    try{ out=await cwvOneFetch(url,key); }catch(e){ out={status:"error", msg:"réseau indisponible"}; }
    if(out.status!=="timeout") break;      // seul un délai dépassé justifie une reprise
    if(attempt<maxTries) await cwvDelay(1800);
  }
  out.at=Date.now(); out.page=page; out.label=lbl; out.strategy=cwvStrategy; out.url=url;
  perfCwv=out; persistCwv();
  if(out.status==="ok") cwvPushHistory(out);
  if(btn){ btn.dataset.busy="0"; btn.disabled=false; btn.innerHTML='<i data-lucide="gauge"></i>Mesurer'; refreshIcons(); }
  renderPerfPillars(); renderPerfCwv();
  if(out.status==="ok") toast("Vitesse mesurée : "+lbl+" ("+(cwvStrategy==="mobile"?"mobile":"ordinateur")+")");
  else if(out.status==="not-activated") toast("Mesure Google non activée (clé PageSpeed manquante) — estimation locale conservée.");
  else if(out.status==="timeout") toast("Google a dépassé le délai de l'hébergement de test. Recliquez « Mesurer ».");
}
function cwvNote(icon,html,tone){ var t=tone||"info"; return '<div class="cwv-msg cwv-'+t+'"><i data-lucide="'+icon+'"></i><div>'+html+'</div></div>'; }
function renderPerfCwv(){ var w=document.getElementById("perfCwv"); if(!w) return; var c=perfCwv;
  if(!c||!c.status){ w.innerHTML=cwvNote("gauge",'Cliquez <b>« Mesurer »</b> pour obtenir la vitesse réelle d\'une page, mesurée par Google (Core Web Vitals). Nécessite une clé PageSpeed gratuite côté hébergement — sinon l\'estimation locale ci-dessus reste votre référence.'); refreshIcons(); return; }
  if(c.status==="measuring"){ var att=(c.attempt&&c.attempt>1)?(' <b>(nouvelle tentative '+c.attempt+'/'+(c.maxTries||3)+')</b>'):''; w.innerHTML=cwvNote("loader-2",'Mesure de <b>'+escHtml(c.label||"")+'</b> en cours…'+att+' Google analyse la page ('+(c.strategy==="mobile"?"mobile":"ordinateur")+'). Cela peut prendre plusieurs secondes.'); refreshIcons(); return; }
  if(c.status==="need-key"){ w.innerHTML=cwvNote("key-round",'Une <b>clé de publication</b> est nécessaire pour lancer la mesure (elle protège votre quota Google). Renseignez-la depuis le bouton <b>Publier</b>, puis revenez ici.',"warn"); refreshIcons(); return; }
  if(c.status==="bad-key"){ w.innerHTML=cwvNote("key-round",'La clé de publication n\'a pas été acceptée par le serveur. Vérifiez-la depuis le bouton <b>Publier</b>.',"warn"); refreshIcons(); return; }
  if(c.status==="not-activated"){ w.innerHTML=cwvNote("info",'La <b>mesure de vitesse Google</b> n\'est pas encore activée : il manque une clé PageSpeed (gratuite) côté hébergement. Tant qu\'elle n\'est pas là, l\'<b>estimation locale ci-dessus</b> reste votre référence. Une fois la clé ajoutée, cliquez « Mesurer ».'); refreshIcons(); return; }
  if(c.status==="timeout"){ w.innerHTML=cwvNote("clock",'Google a pris trop de temps pour l\'hébergement de test (plan gratuit, coupure ~10 s) — <b>plusieurs tentatives automatiques</b> ont déjà été faites. Le 1er passage prépare la mesure : <b>recliquez « Mesurer »</b> et le résultat s\'affiche généralement. Ce sera fluide sur l\'hébergement final.',"warn"); refreshIcons(); return; }
  if(c.status==="quota"){ w.innerHTML=cwvNote("info",'Le quota gratuit Google PageSpeed est momentanément atteint. Réessayez dans quelques minutes.',"warn"); refreshIcons(); return; }
  if(c.status==="error"){ w.innerHTML=cwvNote("triangle-alert",'La mesure n\'a pas abouti ('+escHtml(c.msg||"erreur")+'). L\'estimation locale ci-dessus reste affichée.',"warn"); refreshIcons(); return; }
  /* status ok */
  var b=pfScore(c.score!=null?c.score:0), col=b.c;
  var dt=""; try{ dt=new Date(c.at).toLocaleString("fr-CH",{day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"}); }catch(e){}
  var head='<div class="cwv-head">'+(c.score!=null?perfRing(c.score,64,col):'')
    +'<div class="cwv-head-tx"><div class="cwv-head-t">Note de vitesse Google : '+(c.score!=null?c.score:"–")+'<small style="font-weight:600;color:var(--muted)">/100</small></div>'
    +'<div class="cwv-head-s">'+escHtml(c.label||"")+' · '+(c.strategy==="mobile"?"vue mobile":"vue ordinateur")+(dt?(' · mesuré le '+escHtml(dt)):'')+'</div>'
    +'<span class="cwv-band" style="color:'+col+';background:'+b.bg+'"><i data-lucide="gauge"></i>'+b.w+'</span></div></div>';
  var tiles=CWV_METRICS.map(function(mt){ var v=cwvVal(c.metrics,mt.k); var s=pfStat(v.num!=null?cwvStat(mt.k,v.num):"warn"); if(v.num==null) s=PF_C.warn;
    return '<div class="cwv-tile"><div class="cwv-tile-top"><span class="cwv-dot" style="background:'+s.c+'"></span><span class="cwv-tile-k">'+mt.plain+'<span class="cwv-tile-tech"> · '+mt.tech+'</span></span></div>'
      +'<div class="cwv-tile-v" style="color:'+s.c+'">'+escHtml(v.disp)+'</div><div class="cwv-tile-hint">'+mt.hint+'</div></div>'; }).join("");
  w.innerHTML=head+cwvCatsHtml(c.categories)+'<div class="cwv-grid">'+tiles+'</div>'+cwvHistHtml(); refreshIcons();
}
/* Bande des 4 notes Google (Lighthouse) — l'avis de Google, distinct de l'audit local de l'admin. */
function cwvCatsHtml(categories){ if(!categories) return '';
  var any=CWV_CATS.some(function(cat){ return categories[cat.k]!=null; }); if(!any) return '';
  var cells=CWV_CATS.map(function(cat){ var sc=categories[cat.k]; var b=pfScore(sc!=null?sc:0);
    var ring=(sc!=null)?perfRing(sc,42,b.c,4):'<div class="pring" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-weight:800">–</div>';
    return '<div class="cwv-cat">'+ring+'<span class="cwv-cat-k">'+cat.plain+'</span></div>'; }).join("");
  return '<div class="cwv-cats-wrap"><div class="cwv-cats-h">Notes Google (Lighthouse) · l\'avis de Google, en complément de l\'audit local ci-dessus</div><div class="cwv-cats">'+cells+'</div></div>';
}
/* Historique des mesures Google mémorisées (score de vitesse + accessibilité + SEO). */
function cwvHistHtml(){ var h=cwvHistory(); if(h.length<2) return '';
  var rows=h.slice(0,6).map(function(e,i){ var prev=h[i+1]; var d=(prev&&e.score!=null&&prev.score!=null)?(e.score-prev.score):0; var darr=d>0?("+"+d):(d<0?String(d):"="); var dc=d>0?"#0E7D48":(d<0?"#B23B3B":"#8a8c89");
    var dt=""; try{ dt=new Date(e.at).toLocaleString("fr-CH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }catch(x){}
    return '<div class="cwv-hist-row"><span class="cwv-hist-dt">'+escHtml(dt)+'</span><span class="cwv-hist-pg">'+escHtml(e.label||e.page||"")+' · '+(e.strategy==="mobile"?"mob.":"ord.")+'</span>'
      +'<span class="cwv-hist-sc">'+(e.score!=null?e.score:"–")+'<small>/100</small></span><span class="cwv-hist-d" style="color:'+dc+'">'+darr+'</span>'
      +'<span class="cwv-hist-cats">Acc. '+(e.a11y!=null?e.a11y:"–")+' · SEO '+(e.seo!=null?e.seo:"–")+'</span></div>'; }).join("");
  return '<div class="cwv-hist"><div class="cwv-hist-h"><i data-lucide="history"></i>Historique des mesures Google <span class="hint" style="margin:0">'+h.length+' enregistrée'+(h.length>1?"s":"")+'</span></div>'+rows+'</div>';
}
/* Historique SERVEUR (mesures planifiées) : partagé entre appareils, alimenté par le cron
   /api/perf-history?run=1. Repli SILENCIEUX : pas de clé / endpoint absent / vide -> rien affiché (l'historique
   local ci-dessus reste la référence). Distinct de l'historique local « cet appareil ». */
let perfServerHist=null, perfServerHistLoading=false;
function cwvServerHistHtml(entries){
  if(!Array.isArray(entries)||!entries.length) return '';
  var recent=entries.slice(-8).reverse();
  var rows=recent.map(function(e){
    var dt=""; try{ dt=new Date(e.ts).toLocaleString("fr-CH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }catch(x){}
    return '<div class="cwv-hist-row"><span class="cwv-hist-dt">'+escHtml(dt)+'</span>'
      +'<span class="cwv-hist-pg">'+escHtml(e.page||"/")+' · '+(e.strategy==="desktop"?"ord.":"mob.")+'</span>'
      +'<span class="cwv-hist-sc">'+(e.score!=null?e.score:"–")+'<small>/100</small></span>'
      +'<span class="cwv-hist-cats">Acc. '+(e.a11y!=null?e.a11y:"–")+' · SEO '+(e.seo!=null?e.seo:"–")+'</span></div>'; }).join("");
  return '<div class="cwv-hist" style="margin-top:12px"><div class="cwv-hist-h"><i data-lucide="calendar-clock"></i>Mesures automatiques (serveur) <span class="hint" style="margin:0">planifiées · '+entries.length+' enregistrée'+(entries.length>1?"s":"")+'</span></div>'+rows+'</div>';
}
async function cwvLoadServerHist(){
  var w=document.getElementById("perfCwvServer"); if(!w) return;
  if(perfServerHistLoading) return; perfServerHistLoading=true;
  try{
    var key=getStoredPublishKey();
    if(!key){ w.innerHTML=''; return; }
    var r=await fetch("/api/perf-history",{headers:{Authorization:"Bearer "+key}});
    if(!r.ok){ w.innerHTML=''; return; }
    var j=await r.json();
    perfServerHist=(j&&Array.isArray(j.entries))?j.entries:[];
    w.innerHTML=cwvServerHistHtml(perfServerHist); refreshIcons();
  }catch(e){ /* silencieux : la démo/historique local reste intacte */ }
  finally{ perfServerHistLoading=false; }
}
const PF_MARKS=[["Critique",0],["À surveiller",40],["Correct",60],["Bon",80]];
function renderPerfVerdict(overall){ const w=document.getElementById("perfVerdict"); if(!w) return;
  const b=pfScore(overall), col=b.c;
  const heads={ Excellent:{ic:"check-circle-2", t:"Votre site est en excellente santé"}, Bon:{ic:"check-circle-2", t:"Votre site est en bonne santé"}, Correct:{ic:"sparkles", t:"Votre site va bien, quelques réglages à peaufiner"}, "À surveiller":{ic:"alert-triangle", t:"Quelques points sont à surveiller"}, Critique:{ic:"alert-triangle", t:"Des points importants sont à corriger"} };
  const m=heads[b.w]||heads.Bon;
  const goodN=perfPillars().filter(p=>p.score>=80).length, actN=perfActs().length;
  const sub=goodN+" domaine"+(goodN>1?"s":"")+" au vert sur "+perfPillars().length+", "+actN+" point"+(actN>1?"s":"")+" à améliorer, expliqués et guidés plus bas.";
  w.className="perf-verdict";
  const scaleDesc=PF_SCALE.slice().reverse();
  w.innerHTML='<div class="pv-gauge">'+perfRing(overall,66,col)+'<span class="pv-cap">note globale<br>sur 100</span></div>'
    +'<div class="pv-main"><div class="pv-title"><span class="pv-dot" style="color:'+col+'"><i data-lucide="'+m.ic+'"></i></span>'+m.t+'<span class="pv-band" style="color:'+col+';background:'+b.bg+'">'+b.w+'</span></div>'
    +'<div class="pv-sub">'+sub+'</div>'
    +'<div class="pv-scale"><div class="pv-steps">'
      +scaleDesc.map(function(bd,j){ const on=bd.w===b.w; var dot=''; if(on){ var mx=(j<scaleDesc.length-1?scaleDesc[j+1].min:100); var fr=(mx>bd.min)?(overall-bd.min)/(mx-bd.min):0.5; fr=Math.max(0.1,Math.min(0.9,fr)); dot='<span class="pv-step-dot" style="background:'+bd.c+';left:'+(fr*100).toFixed(1)+'%"></span>'; } return '<div class="pv-step'+(on?" on":" dim")+'" style="background:'+(on?bd.c:bd.bg)+'">'+dot+'</div>'; }).join("")
      +'</div><div class="pv-scale-lbls">'+scaleDesc.map(bd=>'<span'+(bd.w===b.w?' class="on" style="color:'+bd.c+'"':'')+'>'+bd.w+'</span>').join("")+'</div></div></div>';
}
/* Quand une mesure Google réelle existe pour l'accueil, elle remplace la ligne
   « Vitesse ressentie » estimée du pilier Rapidité par les vraies valeurs (LCP / CLS
   / TBT), pour que le pilier et le bloc « Vitesse réelle » ci-dessous soient cohérents.
   Clone défensif : ne mute jamais PERF_PILLARS / perfLive. */
function cwvPatchSpeedDetail(detail){
  var c=(typeof perfCwv!=="undefined"&&perfCwv&&perfCwv.status==="ok"&&perfCwv.page==="index.html")?perfCwv:null;
  if(!c) return (detail||[]);
  /* on retire les lignes de vitesse estimées (démo : LCP/INP/CLS/TTFB ; audit local :
     « Vitesse ressentie ») pour les remplacer par la vraie mesure Google, sans doublon.
     On garde les lignes que Google ne couvre pas (poids, nombre d'éléments). */
  var DROP_TECH={"LCP":1,"INP":1,"CLS":1,"TTFB":1,"LCP / INP / CLS":1};
  var kept=(detail||[]).filter(function(d){ return d.k!=="Vitesse ressentie" && !DROP_TECH[d.tech]; });
  var lcp=cwvVal(c.metrics,"lcp"), cls=cwvVal(c.metrics,"cls"), tbt=cwvVal(c.metrics,"tbt");
  return kept.concat([
    {k:"Affichage du contenu principal", tech:"LCP · Google", v:lcp.disp, st:cwvStat("lcp",lcp.num)},
    {k:"Stabilité de la page", tech:"CLS · Google", v:cls.disp, st:cwvStat("cls",cls.num)},
    {k:"Réactivité (temps de blocage)", tech:"TBT · Google", v:tbt.disp, st:cwvStat("tbt",tbt.num)}
  ]);
}
function renderPerfPillars(){ const w=document.getElementById("perfPillars"); if(!w) return; w.innerHTML="";
  perfPillars().forEach(p=>{ const b=pfScore(p.score); const el=document.createElement("div"); el.className="pcard";
    const detail=(p.key==="speed")?cwvPatchSpeedDetail(p.detail):p.detail;
    el.innerHTML='<div class="pcard-top"><span class="pcard-ic" style="background:'+b.bg+';color:'+b.c+'"><i data-lucide="'+p.icon+'"></i></span><span class="pcard-t">'+p.title+'</span>'+perfRing(p.score,36,b.c,4)+'</div>'
      +'<div class="pcard-plain">'+p.plain+'</div>'
      +'<span class="pf-pill pcard-pill" style="color:'+b.c+';background:'+b.bg+'">'+b.w+'</span>'
      +'<div class="pcard-benefit">'+p.benefit+'</div>'
      +'<button type="button" class="pcard-toggle">Voir le détail technique <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>'
      +'<div class="pcard-detail">'+detail.map(d=>{ const ds=pfStat(d.st); return '<div class="pdet-row"><span class="pdet-dot" style="background:'+ds.c+'"></span><span class="pd-k">'+d.k+'<span class="pd-tech"> · '+d.tech+'</span></span><span class="pd-v" style="color:'+ds.c+'">'+d.v+'</span></div>'; }).join("")+'</div>';
    el.querySelector(".pcard-toggle").addEventListener("click",()=>el.classList.toggle("open"));
    w.appendChild(el); }); }
function renderPerfActions(){ const w=document.getElementById("perfActions"); if(!w) return; const hint=document.getElementById("perfActionsHint");
  const acts=perfActs().slice().sort((a,b)=>(PF_IMPACT_ORDER[a.impact]-PF_IMPACT_ORDER[b.impact]));
  if(hint) hint.textContent=acts.length+" point"+(acts.length>1?"s":"");
  w.className="perf-acts";
  if(!acts.length){ w.innerHTML='<div class="perf-allgood"><span class="pg-chk"><i data-lucide="check"></i></span><span>Rien à corriger, tout est au vert.</span></div>'; refreshIcons(); return; }
  w.innerHTML="";
  acts.forEach(a=>{ const im=PF_IMPACT[a.impact]||PF_IMPACT.moyen, fx=a.fix||{mode:"gamma",note:""}; const el=document.createElement("div"); el.className="pa-card";
    let sub, cta;
    if(fx.mode==="self"){
      sub='<div class="pa-sub self"><div class="pa-sub-h"><i data-lucide="lightbulb"></i>Comment faire</div><div class="pa-sub-b">'+fx.guide+'</div></div>';
      cta='<div class="pa-cta"><button class="btn sm primary" data-fix="self"><i data-lucide="wand-2"></i>'+(fx.label||"Corriger")+'</button><span class="pa-self"><i data-lucide="check"></i>à votre portée</span></div>';
    } else {
      sub='<div class="pa-sub gamma"><div class="pa-sub-h"><i data-lucide="life-buoy"></i>À confier à '+GAMMA+'</div><div class="pa-sub-b">'+fx.note+'</div></div>';
      cta='<div class="pa-cta"><button class="btn sm" data-fix="gamma"><i data-lucide="send"></i>Le signaler à '+GAMMA+'</button></div>';
    }
    el.innerHTML='<div class="pa-card-hd"><span class="pa-ic" style="background:'+im.bg+';color:'+im.c+'"><i data-lucide="'+(a.icon||"triangle-alert")+'"></i></span><span class="pa-impact" style="color:'+im.c+';background:'+im.bg+'">'+im.w+'</span><span class="pa-area">'+a.area+'</span></div>'
      +'<div class="pa-title">'+a.title+'</div><div class="pa-why">'+a.why+'</div>'+sub+cta;
    const fb=el.querySelector("[data-fix]"); if(fb){ if(fx.mode==="self") fb.addEventListener("click",()=>perfFix(a)); else fb.addEventListener("click",perfSignalGamma); }
    w.appendChild(el); }); refreshIcons(); }
function renderPerfGood(){ const w=document.getElementById("perfGood"); if(!w) return; w.className="perf-good-list";
  w.innerHTML=perfGoods().map(g=>'<div class="perf-good-item"><span class="pg-chk"><i data-lucide="check"></i></span><span class="pg-t">'+escHtml(g.t)+'</span><span class="pg-cat">'+escHtml(g.cat)+'</span></div>').join(""); refreshIcons(); }
let perfContentMode="simple";
function renderPerfContent(){ const w=document.getElementById("perfContent"); if(!w) return; const detailed=perfContentMode==="detailed";
  const warnN=perfConts().filter(c=>c.st!=="good").length;
  let h='<div class="pc-top"><div class="pc-intro">Ce que vos textes changent pour Google et vos visiteurs. '+(warnN?('<b>'+warnN+' point'+(warnN>1?"s":"")+' à revoir.</b>'):'Tout est au point.')+'</div>'
    +'<div class="seg pc-toggle" id="pcToggle"><button data-m="simple" class="'+(detailed?"":"on")+'">Simple</button><button data-m="detailed" class="'+(detailed?"on":"")+'">Détaillé</button></div></div>';
  const ordered=perfConts().slice().sort((a,b)=>(a.st==="good"?1:0)-(b.st==="good"?1:0));
  h+='<div class="pc-list">'+ordered.map(c=>{ const s=pfStat(c.st), ok=c.st==="good", ic=ok?"check":"alert-triangle";
    return '<div class="pc-item"><span class="pc-chk" style="background:'+s.bg+';color:'+s.c+'"><i data-lucide="'+ic+'"></i></span><div class="pc-body"><div class="pc-krow"><span class="pc-k">'+c.k+'</span><span class="pc-status" style="color:'+s.c+'">'+(ok?"Au point":"À revoir")+'</span></div>'
      +(detailed?('<div class="pc-plain">'+c.plain+'</div><div class="pc-tip"><i data-lucide="lightbulb"></i><span>'+c.tip+'</span></div>'):'')
      +'</div></div>'; }).join("")+'</div>';
  w.innerHTML=h;
  w.querySelectorAll("#pcToggle button").forEach(b=>b.addEventListener("click",()=>{ perfContentMode=b.dataset.m; renderPerfContent(); }));
  refreshIcons(); }

/* ============================================================
   Structure & stratégie : expliquer le rôle de chaque section
   du site (le tunnel de conversion) pour que le client n'enlève
   pas une section clé sans en mesurer l'importance.
   ============================================================ */
const STRUCT_PHASES=[
  {key:"capter", label:"Capter l'attention", col:"#2F6FE0", bg:"#E6F1FB"},
  {key:"convaincre", label:"Convaincre", col:"#7C5CD6", bg:"#EEEBFB"},
  {key:"rassurer", label:"Rassurer", col:"#0E9AA0", bg:"#E2F4F5"},
  {key:"chiffrer", label:"Chiffrer", col:"#C7891B", bg:"#FBF0DD"},
  {key:"convertir", label:"Convertir", col:"#147D54", bg:"#E3F4EA"}
];
/* dans l'ordre RÉEL de index.html : hero -> diff -> feat -> testi -> sim -> offres -> booking -> faq */
const STRUCT_SECTIONS=[
  { name:"Bandeau promotionnel", phase:"capter", icon:"megaphone", keySec:false,
    role:"Une offre visible dès la première seconde (créneaux, remise) qui crée un sentiment d'opportunité.",
    why:"Tout en haut, avant même le logo : c'est ce qui accroche celui qui hésite encore.",
    risk:"En le retirant, vous perdez ce petit déclic d'urgence qui pousse à explorer la suite." },
  { name:"Accroche (hero)", phase:"capter", icon:"sparkles", keySec:true,
    role:"Votre promesse en une phrase : livraison pro en Suisse romande, coursiers salariés, tarifs fixes. Plus les premiers boutons d'action.",
    why:"C'est la première chose vue. En 3 secondes, le visiteur doit savoir ce que vous faites et pour qui.",
    risk:"Sans accroche claire, une bonne moitié des visiteurs repart sans avoir compris votre métier." },
  { name:"Ce qui vous différencie", phase:"convaincre", icon:"badge-check", keySec:false,
    role:"La livraison pro « sans les compromis habituels » : ce qui vous distingue d'un simple livreur.",
    why:"Juste après l'accroche, on répond au « pourquoi vous plutôt qu'un autre ? ».",
    risk:"Sans ça, vous devenez interchangeable et on vous compare au moins cher." },
  { name:"Tout est inclus (services)", phase:"convaincre", icon:"package-check", keySec:false,
    role:"Ce que le client obtient concrètement : coursiers salariés, traçabilité, suivi en direct.",
    why:"Une fois l'intérêt créé, on rend la valeur tangible pour justifier le prix à venir.",
    risk:"Sans le détail, l'offre reste abstraite et le prix paraît élevé." },
  { name:"Témoignages", phase:"rassurer", icon:"quote", keySec:false,
    role:"La preuve par les clients : d'autres l'ont fait, ça marche.",
    why:"Avant de parler d'argent, on installe la confiance avec des voix qui ne sont pas la vôtre.",
    risk:"Sans preuve sociale, votre discours n'est que votre parole, et la confiance chute." },
  { name:"Simulateur de coût", phase:"chiffrer", icon:"calculator", keySec:true,
    role:"Le visiteur estime en 10 secondes ce que lui coûtent vraiment ses livraisons, et voit l'offre recommandée.",
    why:"Juste avant les prix : on crée la prise de conscience du coût actuel, donc le besoin.",
    risk:"C'est souvent LA section qui déclenche le contact. Sans elle, le visiteur ne mesure pas son problème et votre prix n'a aucun point de comparaison." },
  { name:"Offres & tarifs", phase:"convertir", icon:"tags", keySec:true,
    role:"Vos formules Flex et Dédié, sans engagement, avec les prix.",
    why:"Le besoin étant chiffré, on propose la solution et son prix, sans détour.",
    risk:"Cacher le prix ne le rend pas plus acceptable, ça fait fuir : la plupart n'osent pas demander et partent comparer ailleurs." },
  { name:"Prise de rendez-vous", phase:"convertir", icon:"calendar-check", keySec:true,
    role:"Le passage à l'acte : réserver une consultation offerte, avec calendrier et créneaux.",
    why:"Le point d'arrivée de tout le parcours. Tout ce qui précède mène ici.",
    risk:"C'est votre caisse enregistreuse. Sans un moment d'action clair, tout votre trafic ne devient jamais des clients." },
  { name:"Questions fréquentes (FAQ)", phase:"rassurer", icon:"help-circle", keySec:false,
    role:"Les réponses aux dernières objections, plus vos coordonnées et adresses.",
    why:"En bas, pour lever le dernier doute de celui qui hésite encore juste avant de vous contacter.",
    risk:"Sans FAQ, les hésitants restent avec leur question sans réponse, et abandonnent." }
];
/* Un site = plusieurs pages, chacune avec sa "portante" (son rôle dans le parcours global).
   Pages marketing = carte des sections ; pages transactionnelles = portante + principe. */
const STRUCT_PAGES=[
  { key:"accueil", name:"Accueil", icon:"home",
    role:"Le cœur commercial du site : transformer une entreprise qui découvre Chaskis en demande de contact.",
    audience:"Entreprises de Suisse romande qui cherchent un partenaire de livraison fiable.",
    goal:"Décrocher une consultation (prise de rendez-vous).",
    sections:STRUCT_SECTIONS },
  { key:"mobilite", name:"Mobilité", icon:"car-front",
    role:"Vendre la seconde offre : chauffeur privé et transferts, y compris pour vos pièces et documents sensibles.",
    audience:"Entreprises et cadres qui ont besoin d'un transport de personnes ou de valeurs.",
    goal:"Générer une demande de trajet.",
    sections:[
      {name:"Accroche (hero)", phase:"capter", icon:"sparkles", keySec:true, role:"La promesse chauffeur privé en une phrase, avec la première action.", why:"Première chose vue : elle doit dire à qui s'adresse ce service et pourquoi.", risk:"Sans accroche nette, le visiteur ne comprend pas que vous faites aussi du transport de personnes."},
      {name:"Ils nous font confiance", phase:"rassurer", icon:"shield-check", keySec:false, role:"Les entreprises qui vous font déjà confiance.", why:"Tout en haut, la preuve installe la crédibilité avant l'argumentaire.", risk:"Sans preuve, votre sérieux ne repose que sur votre parole."},
      {name:"Un chauffeur pour chaque besoin", phase:"convaincre", icon:"users", keySec:false, role:"Les cas d'usage : trajets, transferts, événements.", why:"On aide le visiteur à se reconnaître dans une situation concrète.", risk:"Sans ça, il ne voit pas que le service est pour lui."},
      {name:"Trois raisons de choisir Chaskis", phase:"convaincre", icon:"badge-check", keySec:false, role:"Vos arguments différenciants.", why:"Répond au « pourquoi vous plutôt qu'un autre ».", risk:"Sans différenciation, on vous compare au moins cher."},
      {name:"Transport de pièces sensibles", phase:"convaincre", icon:"gem", keySec:false, role:"L'offre haut de gamme : documents et objets de valeur.", why:"Cible un besoin premium, à plus forte marge.", risk:"La retirer, c'est renoncer à vos clients les plus rentables."},
      {name:"Comment ça marche", phase:"rassurer", icon:"route", keySec:false, role:"Le parcours, de la demande au trajet.", why:"Lève la crainte que ce soit compliqué.", risk:"Sans ça, le visiteur doute que ce soit simple et remet à plus tard."},
      {name:"Témoignages", phase:"rassurer", icon:"quote", keySec:false, role:"La preuve par les clients.", why:"On installe la confiance avant l'action.", risk:"Sans preuve sociale, la confiance chute."},
      {name:"Demander un trajet (formulaire)", phase:"convertir", icon:"calendar-check", keySec:true, role:"Le passage à l'acte : demander un trajet.", why:"C'est le but de la page, tout y mène.", risk:"C'est votre prise de contact. Sans elle, aucune demande ne rentre."},
      {name:"FAQ", phase:"rassurer", icon:"help-circle", keySec:false, role:"Les dernières objections, plus le contact.", why:"Lève le dernier doute juste avant de vous écrire.", risk:"Les hésitants restent sans réponse et abandonnent."}
    ] },
  { key:"recrutement", name:"Recrutement", icon:"user-plus",
    role:"L'autre versant du modèle : attirer et recruter les coursiers et chauffeurs. Sans eux, pas de service.",
    audience:"Candidats coursiers et chauffeurs en Suisse romande.",
    goal:"Faire candidater (télécharger l'app, postuler).",
    sections:[
      {name:"Accroche (hero)", phase:"capter", icon:"sparkles", keySec:true, role:"La promesse employeur en une phrase.", why:"Dire tout de suite ce qu'on gagne à rejoindre Chaskis.", risk:"Sans accroche, le candidat ne voit pas son intérêt et referme."},
      {name:"Ce que vous y gagnez", phase:"convaincre", icon:"badge-check", keySec:false, role:"Les avantages du poste (salariat, matériel, cadre).", why:"Répond au « qu'est-ce que j'y gagne ».", risk:"Sans avantages clairs, le candidat va voir la concurrence."},
      {name:"Choisissez votre mode", phase:"convaincre", icon:"list-checks", keySec:false, role:"Les types d'activité ou de contrat.", why:"Chacun se projette dans son cas.", risk:"Sans ça, l'offre paraît rigide et exclut des profils."},
      {name:"Ils en parlent", phase:"rassurer", icon:"quote", keySec:false, role:"La preuve par les coursiers actuels.", why:"On rassure sur l'ambiance et le sérieux avant de postuler.", risk:"Sans témoignages d'équipe, le candidat doute."},
      {name:"FAQ", phase:"rassurer", icon:"help-circle", keySec:false, role:"Les questions des candidats (horaires, matériel, paie).", why:"Lève les freins concrets à la candidature.", risk:"Sans réponses, le candidat n'ose pas se lancer."},
      {name:"Candidater / télécharger l'app", phase:"convertir", icon:"download", keySec:true, role:"L'action : télécharger l'app et postuler.", why:"C'est le but de la page.", risk:"Sans appel à l'action clair, aucune candidature."}
    ] },
  { key:"commander", name:"Commander", icon:"package", transactional:true,
    role:"Le tunnel de commande : passer une course, étape par étape.",
    audience:"Clients qui veulent commander une livraison maintenant.",
    goal:"Finaliser une commande, sans friction.",
    note:"Page transactionnelle : ici, l'enjeu n'est pas de convaincre mais de ne perdre personne en route. Chaque étape en trop, chaque champ inutile fait abandonner. Le principe : le moins d'efforts possible pour commander." },
  { key:"suivi", name:"Suivi de commande", icon:"radar", transactional:true,
    role:"Rassurer après l'achat : suivre sa livraison en temps réel.",
    audience:"Clients avec une livraison en cours.",
    goal:"Confiance et tranquillité, pour qu'ils recommandent.",
    note:"Page de réassurance : un bon suivi transforme un client stressé en client fidèle. Ce n'est pas une page à vendre, c'est une page à rassurer. Priorité : clarté de l'info en direct." },
  { key:"dashboard", name:"Tableau de bord", icon:"layout-dashboard", transactional:true,
    role:"L'espace client : gérer ses commandes et son compte.",
    audience:"Clients réguliers, une fois connectés.",
    goal:"Autonomie et fidélisation.",
    note:"Espace connecté : l'enjeu est que le client fasse seul, et vite, ce qu'il vient faire. L'utilité et la clarté priment sur le discours commercial." }
];
let structPage="accueil";
function renderStructure(){ renderStructTabs(); renderStructBody(); }
function renderStructTabs(){ const w=document.getElementById("structTabs"); if(!w) return;
  w.innerHTML=STRUCT_PAGES.map(p=>'<button type="button" class="struct-tab'+(p.key===structPage?" on":"")+'" data-p="'+p.key+'"><i data-lucide="'+p.icon+'"></i>'+p.name+'</button>').join("");
  w.querySelectorAll("[data-p]").forEach(b=>b.addEventListener("click",()=>{ structPage=b.dataset.p; renderStructure(); }));
  refreshIcons();
}
function renderStructBody(){ const w=document.getElementById("structBody"); if(!w) return;
  const HIDE_MAP={"Bandeau promotionnel":"promo","Accroche (hero)":"hero","Ce qui vous différencie":"diff","Tout est inclus (services)":"services","Témoignages":"testi","Simulateur de coût":"sim","Offres & tarifs":"offres","Prise de rendez-vous":"booking","Questions fréquentes (FAQ)":"faq"};
  const secHidden=id=> id==="promo" ? !!draft.promoHidden : (draft.hidden||[]).includes(id);
  const p=STRUCT_PAGES.find(x=>x.key===structPage)||STRUCT_PAGES[0];
  let h='<div class="struct-portante"><div class="sp-head"><span class="sp-ic"><i data-lucide="'+p.icon+'"></i></span><div><div class="sp-name">'+p.name+'</div><div class="sp-role">'+p.role+'</div></div></div>'
    +'<div class="sp-meta"><div class="sp-m"><span class="sp-m-k"><i data-lucide="users"></i>Pour qui</span><span class="sp-m-v">'+p.audience+'</span></div>'
    +'<div class="sp-m"><span class="sp-m-k"><i data-lucide="target"></i>Objectif</span><span class="sp-m-v">'+p.goal+'</span></div></div></div>';
  if(p.transactional){
    h+='<div class="struct-note"><i data-lucide="info"></i><div>'+p.note+'</div></div>';
  } else {
    const phMap={}; STRUCT_PHASES.forEach(ph=>phMap[ph.key]=ph);
    h+='<div class="struct-legend">'+STRUCT_PHASES.map((ph,i)=>'<span class="struct-leg" style="color:'+ph.col+';background:'+ph.bg+'">'+ph.label+'</span>'+(i<STRUCT_PHASES.length-1?'<span class="struct-arrow"><i data-lucide="chevron-right"></i></span>':'')).join("")+'</div>';
    h+='<div class="struct-map">'+p.sections.map(s=>{ const ph=phMap[s.phase]||STRUCT_PHASES[0]; const hid=(structPage==="accueil"&&HIDE_MAP[s.name])?secHidden(HIDE_MAP[s.name]):false;
      return '<div class="struct-item"><div class="struct-rail"><span class="struct-dot" style="background:'+ph.col+'"></span></div>'
        +'<div class="struct-card'+(s.keySec?" key":"")+'"><button type="button" class="struct-hd">'
          +'<span class="struct-ic" style="background:'+ph.bg+';color:'+ph.col+'"><i data-lucide="'+s.icon+'"></i></span>'
          +'<span class="struct-name">'+s.name+(hid?'<span style="font-size:10px;font-weight:600;color:#B4632A;background:#FBEEE4;border-radius:20px;padding:2px 8px;margin-left:6px">actuellement masquée</span>':'')+(s.keySec?'<span class="struct-key"><i data-lucide="lock"></i>section clé</span>':'')+'</span>'
          +'<span class="struct-phase" style="color:'+ph.col+';background:'+ph.bg+'">'+ph.label+'</span>'
          +'<svg class="struct-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>'
          +'<div class="struct-role">'+s.role+'</div>'
          +'<div class="struct-detail"><div class="struct-why"><b>Pourquoi à cet endroit&nbsp;?</b> '+s.why+'</div>'
            +'<div class="struct-risk"><i data-lucide="alert-triangle"></i><span><b>Si vous la retirez&nbsp;: </b>'+s.risk+'</span></div></div>'
        +'</div></div>'; }).join("")+'</div>';
    h+='<div class="ex-note" style="margin-top:6px"><i data-lucide="info"></i><div>Les sections « section clé » déclenchent le passage à l\'action. Les retirer ou les vider a un fort impact sur vos demandes de contact.</div></div>';
  }
  w.innerHTML=h;
  w.querySelectorAll(".struct-hd").forEach(b=>b.addEventListener("click",()=>b.closest(".struct-card").classList.toggle("open")));
  refreshIcons();
}

/* ============================================================
   Affiliation (ébauche : restaurants partenaires + jeux concours)
   ============================================================ */
const AFFIL_KEY="chaskis_affiliation_v2";
/* Catégories gérables : jeu par défaut élargi + ajout à la volée, persisté. [key,label] pour garder l'ordre. */
const AFFIL_CATS_KEY="chaskis_affil_cats";
const DEFAULT_AFFIL_CATS=[["restaurant","Restaurant"],["cafe","Café & bar"],["commerce","Commerce"],["beaute","Beauté"],["sport","Sport & bien-être"],["culture","Culture & loisirs"],["service","Services"],["sante","Santé"],["autre","Autre"]];
let affilCats=loadAffilCats();
function loadAffilCats(){ try{ const s=JSON.parse(localStorage.getItem(AFFIL_CATS_KEY)); if(Array.isArray(s)&&s.length) return s; }catch(e){} return DEFAULT_AFFIL_CATS.map(x=>x.slice()); }
function saveAffilCats(){ try{ localStorage.setItem(AFFIL_CATS_KEY, JSON.stringify(affilCats)); }catch(e){} }
function catLabel(key){ const c=affilCats.find(x=>x[0]===key); return c?c[1]:(key||"Autre"); }
function slugify(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[^\x00-\x7f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
function addAffilCat(label){ label=(label||"").trim(); if(!label) return null; const key=slugify(label)||("cat"+Date.now());
  const exist=affilCats.find(x=>x[0]===key||x[1].toLowerCase()===label.toLowerCase()); if(exist) return exist[0];
  const i=affilCats.findIndex(x=>x[0]==="autre"); const entry=[key,label]; if(i>=0) affilCats.splice(i,0,entry); else affilCats.push(entry); saveAffilCats(); return key; }
/* Jeux concours : chaque type a son identité (icône + couleur), fini l'icône répétée. */
const CONTEST_KINDS={
  tirage:{ic:"ticket",label:"Tirage au sort",col:"#7C5CD6",bg:"#EEEBFB"},
  defi:{ic:"trophy",label:"Défi",col:"#B8791C",bg:"#FBF0DD"},
  parrainage:{ic:"user-plus",label:"Parrainage",col:"#0F6E56",bg:"#E1F5EE"}
};
const AFFIL_ADV={pct:{label:"Remise (%)",ph:"15"},item:{label:"Article offert",ph:"Un burger offert"},amount:{label:"Montant offert (CHF)",ph:"10"},other:{label:"Avantage",ph:"2 places de ciné offertes"}};
let affilData=loadAffil(), affilFilter="all", affilSearch="", affilPage=1;
const AFFIL_PER=24;
function loadAffil(){ try{ const s=JSON.parse(localStorage.getItem(AFFIL_KEY)); if(s&&s.length) return s; }catch(e){}
  return [
    {id:1, cat:"restaurant", name:"Le Comptoir", addr:"Rue du Rhône 12, 1204 Genève", advType:"pct", advValue:"15", offer:"Valable midi et soir, sur présentation du badge Chaskis"},
    {id:2, cat:"restaurant", name:"Pizzeria Napoli", addr:"Av. de la Gare 4, 1003 Lausanne", advType:"pct", advValue:"20", offer:"À emporter uniquement"},
    {id:3, cat:"restaurant", name:"Burger House", addr:"Bahnhofstrasse 30, 8001 Zürich", advType:"item", advValue:"Un burger offert dès 25 CHF", offer:""},
    {id:4, cat:"sport", name:"Fit Léman", addr:"Route de Berne 8, 1010 Lausanne", advType:"amount", advValue:"10", offer:"Sur l'abonnement mensuel"}
  ];
}
function saveAffil(){ try{ localStorage.setItem(AFFIL_KEY, JSON.stringify(affilData)); }catch(e){ toast("Stockage plein : non enregistré. Réduisez la taille des photos ou supprimez des éléments."); } }
const AFFIL_CONTESTS_KEY="chaskis_affil_contests";
function defaultContests(){ return [
  {id:1, kind:"tirage", title:"Tirage au sort mensuel", prize:"Un bon d’achat de 150 CHF", period:"Jusqu’au 31 juillet", status:"good", photo:"", prompt:"Photo produit en gros plan d’un bon cadeau et d’un ticket doré posés sur un comptoir en bois clair, lumière naturelle latérale, ambiance chaleureuse, quelques confettis flous en arrière-plan, tons violets et sarcelle discrets, style éditorial premium."},
  {id:2, kind:"defi", title:"Défi courses de l’été", prize:"Un week-end pour deux à gagner", period:"Du 1er juin au 31 août", status:"good", photo:"", prompt:"Plan large en légère contre-plongée d’un coursier à vélo souriant dans une rue ensoleillée d’une ville suisse en été, mouvement dynamique, flou de vitesse en arrière-plan, ciel bleu, couleurs vives et estivales, cadrage cinématographique."},
  {id:3, kind:"parrainage", title:"Prime de parrainage", prize:"50 CHF par filleul actif", period:"En continu", status:"warn", photo:"", prompt:"Vue de dessus à plat (flat lay) de deux mains qui se serrent au-dessus d’une table, entourées d’enveloppes et de billets stylisés, fond uni vert sarcelle doux, composition graphique et épurée, lumière diffuse, esthétique moderne et amicale."}
];}
function loadContests(){ try{ const s=JSON.parse(localStorage.getItem(AFFIL_CONTESTS_KEY)); if(Array.isArray(s)&&s.length) return s; }catch(e){} return defaultContests(); }
function saveContests(){ try{ localStorage.setItem(AFFIL_CONTESTS_KEY, JSON.stringify(contestData)); }catch(e){ toast("Stockage plein : non enregistré. Réduisez la taille des photos ou supprimez des éléments."); } }
let contestData=loadContests();
function affilAdvBadge(r){ const t=r.advType||"pct", v=(r.advValue||"").toString().trim();
  if(t==="amount") return '<span class="ac-adv amount"><span>-'+(parseInt(v,10)||0)+' CHF</span></span>';
  if(t==="item") return '<span class="ac-adv item"><i data-lucide="gift"></i><span>'+escHtml(v||"Offert")+'</span></span>';
  if(t==="other") return '<span class="ac-adv other"><span>'+escHtml(v||"Avantage")+'</span></span>';
  return '<span class="ac-adv"><span>-'+(parseInt(v,10)||0)+' %</span></span>';
}
function renderAffilFilter(){ const w=document.getElementById("affilFilter"); if(!w) return;
  const cats=[...new Set(affilData.map(r=>r.cat||"autre"))];
  const opts=[["all","Tous ("+affilData.length+")"]].concat(cats.map(c=>[c,catLabel(c)+" ("+affilData.filter(r=>(r.cat||"autre")===c).length+")"]));
  w.innerHTML=opts.map(o=>'<button class="af-chip'+(affilFilter===o[0]?" on":"")+'" data-f="'+escHtml(o[0])+'">'+escHtml(o[1])+'</button>').join("");
  w.querySelectorAll("[data-f]").forEach(b=>b.addEventListener("click",()=>{ affilFilter=b.dataset.f; affilPage=1; renderAffiliation(); }));
}
function renderAffiliation(){
  const stats=document.getElementById("affilStats");
  if(stats){ const cats={}; affilData.forEach(r=>cats[r.cat||"autre"]=(cats[r.cat||"autre"]||0)+1);
    const rest=cats.restaurant||0, other=affilData.length-rest;
    const pctCount=affilData.filter(r=>(r.advType||"pct")==="pct").length, catCount=Object.keys(cats).length;
    const cards=[
      {k:"Partenaires", v:affilData.length, d:rest+" resto"+(rest>1?"s":"")+" · "+other+" autre"+(other>1?"s":""), ic:"handshake", col:"teal"},
      {k:"Offres actives", v:affilData.length, d:pctCount+" en pourcentage", ic:"tag", col:"amber"},
      {k:"Catégories", v:catCount, d:Object.keys(cats).map(c=>catLabel(c)).slice(0,3).join(", ")||"—", ic:"layout-grid", col:"purple"},
      {k:"Jeux concours actifs", v:contestData.filter(c=>c.status==="good").length, d:"réservés aux équipes", ic:"gift", col:"pink"}
    ];
    stats.innerHTML=""; cards.forEach(c=>{ const el=document.createElement("div"); el.className="statc"; const bc=DASH_ICOL[c.col]||DASH_ICOL.teal;
      el.innerHTML='<div class="top"><div class="ic-badge" style="background:'+bc[0]+';color:'+bc[1]+';border-radius:9px"><i data-lucide="'+c.ic+'"></i></div></div><div class="k">'+c.k+'</div><div class="v">'+c.v+'</div><div class="d">'+c.d+'</div>';
      stats.appendChild(el); }); }
  renderAffilFilter();
  const list=document.getElementById("affilList"), cnt=document.getElementById("affilCount");
  const q=(affilSearch||"").trim().toLowerCase();
  let shown=affilData.filter(r=>affilFilter==="all"||(r.cat||"autre")===affilFilter);
  if(q) shown=shown.filter(r=>((r.name||"")+" "+(r.addr||"")).toLowerCase().indexOf(q)>=0);
  const filtered=(affilFilter!=="all"||!!q), cap=affilPage*AFFIL_PER, page=shown.slice(0,cap);
  if(cnt) cnt.textContent=affilData.length+" partenaire"+(affilData.length>1?"s":"")+(filtered?" · "+shown.length+" affiché"+(shown.length>1?"s":""):"");
  if(list){ list.innerHTML="";
    if(!page.length){ list.innerHTML='<p class="hint" style="margin:0">'+(affilData.length?"Aucun partenaire ne correspond à votre recherche.":"Aucun partenaire pour l'instant. Cliquez « Ajouter un partenaire ».")+'</p>'; }
    else page.forEach(r=>{ const el=document.createElement("div"); el.className="affil-card";
      const logoInner = r.logo ? '<img src="'+escHtml(r.logo)+'">' : escHtml((r.name||"?").trim().charAt(0).toUpperCase()||"?");
      const logoEl='<span class="ac-logo '+(r.logoCorner||"tr")+(r.logoInvert?" inv":"")+'"'+(r.logo?' style="width:'+(r.logoSize||44)+'px;height:'+(r.logoSize||44)+'px"':'')+'>'+logoInner+'</span>';
      el.innerHTML='<div class="ac-photo">'
          +'<div class="ac-actions"><button class="ac-act" data-edit="'+r.id+'" title="Éditer"><i data-lucide="pencil"></i></button><button class="ac-act del" data-del="'+r.id+'" title="Supprimer"><i data-lucide="trash-2"></i></button></div>'
          +logoEl+affilAdvBadge(r)
        +'</div>'
        +'<div class="ac-body">'
          +'<div class="ac-name-row"><span class="ac-name" title="'+escHtml(r.name)+'">'+escHtml(r.name)+'</span><span class="ac-cat">'+escHtml(catLabel(r.cat))+'</span></div>'
          +'<div class="ac-addr"><i data-lucide="map-pin"></i>'+escHtml(r.addr||"—")+'</div>'
          +(r.offer?'<div class="ac-offer">'+escHtml(r.offer)+'</div>':'')
        +'</div>';
      const ph=el.querySelector(".ac-photo"); if(r.photo){ ph.style.backgroundImage="url('"+r.photo+"')"; ph.style.backgroundPosition="center "+(r.photoPosY!=null?r.photoPosY:50)+"%"; }
      el.querySelector("[data-edit]").addEventListener("click",()=>openAffilModal(r.id));
      el.querySelector("[data-del]").addEventListener("click",()=>delAffil(r.id));
      list.appendChild(el); }); }
  const more=document.getElementById("affilMore");
  if(more){ more.innerHTML=""; const rest=shown.length-cap; if(rest>0){ const b=document.createElement("button"); b.className="btn"; b.textContent="Voir plus ("+rest+" restant"+(rest>1?"s":"")+")"; b.addEventListener("click",()=>{ affilPage++; renderAffiliation(); }); more.appendChild(b); } }
  const con=document.getElementById("affilContests");
  if(con){ con.className="contest-grid"; con.innerHTML="";
    if(!contestData.length){ con.className=""; con.innerHTML='<p class="hint" style="margin:0">Aucun jeu concours pour l’instant. Cliquez « Créer un jeu concours ».</p>'; }
    else contestData.forEach(c=>{ const k=CONTEST_KINDS[c.kind]||CONTEST_KINDS.tirage; const d=document.createElement("div"); d.className="contest-card";
    const head = c.photo
      ? '<div class="cc-actions"><button class="cc-act" data-cedit="'+c.id+'" title="Éditer"><i data-lucide="pencil"></i></button><button class="cc-act del" data-cdel="'+c.id+'" title="Supprimer"><i data-lucide="trash-2"></i></button></div>'
      : '<div class="cc-actions"><button class="cc-act" data-cedit="'+c.id+'" title="Éditer"><i data-lucide="pencil"></i></button><button class="cc-act del" data-cdel="'+c.id+'" title="Supprimer"><i data-lucide="trash-2"></i></button></div>'
        +'<div class="cc-ph"><div class="cc-ph-hd"><i data-lucide="sparkles"></i>Prompt image IA<button class="cc-ph-copy" data-cprompt="'+c.id+'"><i data-lucide="copy"></i>Copier</button></div><p class="cc-ph-txt">'+escHtml(c.prompt||"Décrivez le visuel souhaité, puis ajoutez la photo générée.")+'</p></div>';
    d.innerHTML='<div class="cc-photo">'+head+'</div>'
      +'<div class="cc-body">'
        +'<div class="cc-top"><span class="cc-tile" style="background:'+k.bg+';color:'+k.col+'"><i data-lucide="'+k.ic+'"></i></span><span class="cc-kind" style="color:'+k.col+';background:'+k.bg+'">'+k.label+'</span><span class="pf-pill pf-'+c.status+' cc-status">'+(c.status==="good"?"En cours":"Bientôt")+'</span></div>'
        +'<div class="cc-title">'+escHtml(c.title)+'</div>'
        +'<div class="cc-prize">'+escHtml(c.prize)+'</div>'
        +'<div class="cc-period"><i data-lucide="calendar"></i>'+escHtml(c.period||"—")+'</div>'+(c.desc?'<div class="cc-desc" style="font-size:.82rem;color:var(--ink-light);margin-top:6px">'+escHtml(c.desc)+'</div>':'')
      +'</div>';
    const ph=d.querySelector(".cc-photo"); if(c.photo){ ph.style.backgroundImage="url('"+c.photo+"')"; ph.style.backgroundPosition="center "+(c.photoPosY!=null?c.photoPosY:50)+"%"; }
    d.querySelector("[data-cedit]").addEventListener("click",()=>openContestModal(c.id));
    d.querySelector("[data-cdel]").addEventListener("click",()=>delContest(c.id));
    const cp=d.querySelector("[data-cprompt]"); if(cp) cp.addEventListener("click",()=>{ const t=c.prompt||""; if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(()=>toast("Prompt copié"),()=>toast("Copie indisponible")); } else toast("Copie indisponible"); });
    con.appendChild(d); }); }
  refreshIcons();
}
/* éditeur d'image : aperçu live du bandeau + logo, avec cadrage photo, position/taille/négatif du logo */
let affilEditId=null, affilImg={logo:"",photo:"",photoPosY:50,logoCorner:"tr",logoSize:44,logoInvert:false};
function renderAffilEditor(){
  const w=document.getElementById("affilImgEditor"); if(!w) return; const A=affilImg;
  const logoInner = A.logo?'<img src="'+escHtml(A.logo)+'">':'';
  w.innerHTML='<div class="ae-preview" id="aePrev">'
      +(A.logo?'<span class="ae-logo '+A.logoCorner+(A.logoInvert?" inv":"")+'" id="aeLogo" style="width:'+A.logoSize+'px;height:'+A.logoSize+'px">'+logoInner+'</span>':'')
    +'</div>'
    +'<div class="ae-btns">'
      +'<button type="button" class="btn" data-pk="photo">'+(A.photo?"Changer la photo":"Ajouter une photo")+'</button>'+(A.photo?'<button type="button" class="btn ghost" data-cl="photo">Retirer</button>':'')
      +'<button type="button" class="btn" data-pk="logo">'+(A.logo?"Changer le logo":"Ajouter un logo")+'</button>'+(A.logo?'<button type="button" class="btn ghost" data-cl="logo">Retirer</button>':'')
    +'</div>'
    +(A.photo?'<div class="ae-ctrl"><label>Cadrage vertical de la photo</label><input type="range" class="ae-range" min="0" max="100" value="'+A.photoPosY+'" data-posy></div>':'')
    +(A.logo?'<div class="ae-ctrl"><label>Position du logo</label><span class="ae-corners">'+["tl","tr","bl","br"].map(c=>'<button type="button" class="ae-corner '+c+(A.logoCorner===c?" on":"")+'" data-corner="'+c+'"></button>').join("")+'</span></div>'
      +'<div class="ae-ctrl"><label>Taille du logo</label><input type="range" class="ae-range" min="30" max="72" value="'+A.logoSize+'" data-size><button type="button" class="switch'+(A.logoInvert?" on":"")+'" data-inv role="switch" aria-checked="'+A.logoInvert+'"><span class="k"></span></button><label>Négatif</label></div>':'')
    +'<input type="file" accept="image/*" hidden id="aeFilePhoto"><input type="file" accept="image/*" hidden id="aeFileLogo">';
  const prev=document.getElementById("aePrev");
  if(A.photo){ prev.style.backgroundImage="url('"+A.photo+"')"; prev.style.backgroundPosition="center "+A.photoPosY+"%"; }
  w.querySelectorAll("[data-pk]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.pk==="photo"?"aeFilePhoto":"aeFileLogo").click()));
  w.querySelectorAll("[data-cl]").forEach(b=>b.addEventListener("click",()=>{ affilImg[b.dataset.cl]=""; renderAffilEditor(); }));
  document.getElementById("aeFilePhoto").addEventListener("change",e=>readAffilImg(e,"photo"));
  document.getElementById("aeFileLogo").addEventListener("change",e=>readAffilImg(e,"logo"));
  const py=w.querySelector("[data-posy]"); if(py) py.addEventListener("input",e=>{ affilImg.photoPosY=+e.target.value; const p=document.getElementById("aePrev"); if(p) p.style.backgroundPosition="center "+affilImg.photoPosY+"%"; });
  w.querySelectorAll("[data-corner]").forEach(b=>b.addEventListener("click",()=>{ affilImg.logoCorner=b.dataset.corner; renderAffilEditor(); }));
  const sz=w.querySelector("[data-size]"); if(sz) sz.addEventListener("input",e=>{ affilImg.logoSize=+e.target.value; const l=document.getElementById("aeLogo"); if(l){ l.style.width=affilImg.logoSize+"px"; l.style.height=affilImg.logoSize+"px"; } });
  const iv=w.querySelector("[data-inv]"); if(iv) iv.addEventListener("click",()=>{ affilImg.logoInvert=!affilImg.logoInvert; renderAffilEditor(); });
  refreshIcons();
}
function readAffilImg(e,kind){ const f=e.target.files&&e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ affilImg[kind]=rd.result; renderAffilEditor(); }; rd.readAsDataURL(f); }
function setAffilSel(id,v){ const s=document.getElementById(id); if(s){ s.value=v; if(s._ddSync) s._ddSync(); } }
/* select catégorie reconstruit depuis affilCats (+ option "créer"), avec ré-enrobage du dropdown maison */
let affilPrevCat="restaurant";
function reEnhanceSelect(sel){ if(!sel) return; const dd=sel.closest(".dd"); if(dd){ dd.parentNode.insertBefore(sel, dd); dd.remove(); } sel.style.display=""; delete sel.dataset.enhanced; sel._ddSync=null; enhanceSelect(sel); }
function rebuildAffilCatSelect(val){ const s=document.getElementById("affilCat"); if(!s) return;
  s.innerHTML=affilCats.map(c=>'<option value="'+escHtml(c[0])+'"'+(c[0]===val?" selected":"")+'>'+escHtml(c[1])+'</option>').join("")+'<option value="__new__">+ Créer une catégorie…</option>';
  reEnhanceSelect(s); }
function showAffilNewCat(){ const row=document.getElementById("affilNewCat"), inp=document.getElementById("affilNewCatInput"); if(!row) return; row.hidden=false; if(inp){ inp.value=""; setTimeout(()=>inp.focus(),10); } }
function hideAffilNewCat(){ const row=document.getElementById("affilNewCat"); if(row) row.hidden=true; }
function confirmAffilNewCat(){ const inp=document.getElementById("affilNewCatInput"); const key=addAffilCat(inp?inp.value:""); if(!key){ if(inp) inp.focus(); return; } rebuildAffilCatSelect(key); affilPrevCat=key; hideAffilNewCat(); }
function cancelAffilNewCat(){ rebuildAffilCatSelect(affilPrevCat); hideAffilNewCat(); }
function syncAffilAdv(){ const t=(document.getElementById("affilAdvType")||{}).value||"pct"; const cfg=AFFIL_ADV[t]||AFFIL_ADV.pct;
  const lb=document.getElementById("affilAdvLabel"); if(lb) lb.innerHTML=cfg.label+'<span class="req">*</span>';
  const inp=document.getElementById("affilAdvValue"); if(inp){ inp.placeholder=cfg.ph; inp.inputMode=(t==="pct"||t==="amount")?"numeric":"text"; } }
function openAffilModal(id){ affilEditId=id||null; const r=id?affilData.find(x=>x.id===id):null;
  document.getElementById("affilModalT").textContent=id?"Éditer le partenaire":"Ajouter un partenaire";
  document.getElementById("affilName").value=r?r.name:"";
  affilPrevCat = r ? (r.cat||affilCats[0][0]) : affilCats[0][0];
  rebuildAffilCatSelect(affilPrevCat); hideAffilNewCat();
  document.getElementById("affilAddr").value=r?(r.addr||""):"";
  setAffilSel("affilAdvType", r?(r.advType||"pct"):"pct");
  document.getElementById("affilAdvValue").value=r?(r.advValue||""):"";
  document.getElementById("affilOffer").value=r?(r.offer||""):"";
  syncAffilAdv();
  affilImg={logo:r&&r.logo?r.logo:"", photo:r&&r.photo?r.photo:"", photoPosY:r&&r.photoPosY!=null?r.photoPosY:50, logoCorner:r&&r.logoCorner?r.logoCorner:"tr", logoSize:r&&r.logoSize?r.logoSize:44, logoInvert:!!(r&&r.logoInvert)};
  renderAffilEditor();
  document.getElementById("affilModal").classList.add("show");
  setTimeout(()=>{ const n=document.getElementById("affilName"); if(n) n.focus(); },30);
}
function closeAffilModal(){ document.getElementById("affilModal").classList.remove("show"); affilEditId=null; }
function saveAffilForm(){
  const name=(document.getElementById("affilName").value||"").trim();
  let cat=document.getElementById("affilCat").value; if(cat==="__new__") cat=affilPrevCat;
  const addr=(document.getElementById("affilAddr").value||"").trim();
  const advType=document.getElementById("affilAdvType").value;
  const advValue=(document.getElementById("affilAdvValue").value||"").trim();
  const offer=(document.getElementById("affilOffer").value||"").trim();
  if(!name){ toast("Le nom est obligatoire"); document.getElementById("affilName").focus(); return; }
  if(!advValue){ toast("Renseignez l'avantage"); document.getElementById("affilAdvValue").focus(); return; }
  const A=affilImg;
  const rec={ id:affilEditId||Date.now(), cat, name, addr, advType, advValue, offer,
    logo:A.logo||"", photo:A.photo||"", photoPosY:A.photoPosY, logoCorner:A.logoCorner, logoSize:A.logoSize, logoInvert:A.logoInvert };
  if(affilEditId){ const i=affilData.findIndex(x=>x.id===affilEditId); if(i>=0) affilData[i]=rec; toast("Partenaire mis à jour"); }
  else { affilData.push(rec); toast("Partenaire ajouté"); }
  saveAffil(); closeAffilModal(); renderAffiliation();
}
function delAffil(id){ const r=affilData.find(x=>x.id===id); if(!r) return;
  if(!confirm("Supprimer « "+r.name+" » des partenaires ?")) return;
  affilData=affilData.filter(x=>x.id!==id); saveAffil(); renderAffiliation(); toast("Partenaire supprimé"); }

/* Jeux concours : création / édition / suppression, sur le même modèle que les partenaires */
let contestEditId=null, contestImg={photo:"",photoPosY:50,prompt:""};
function renderContestEditor(){
  const w=document.getElementById("contestImgEditor"); if(!w) return; const C=contestImg;
  w.innerHTML='<div class="ae-preview" id="ccePrev"></div>'
    +'<div class="ae-btns">'
      +'<button type="button" class="btn" data-cpk>'+(C.photo?"Changer la photo":"Ajouter une photo")+'</button>'+(C.photo?'<button type="button" class="btn ghost" data-ccl>Retirer</button>':'')
    +'</div>'
    +(C.photo?'<div class="ae-ctrl"><label>Cadrage vertical de la photo</label><input type="range" class="ae-range" min="0" max="100" value="'+C.photoPosY+'" data-cposy></div>':'')
    +'<div class="formf" style="margin:10px 0 0"><label>Prompt image IA <span style="color:var(--muted);font-weight:400">(si pas de photo)</span></label><textarea id="contestPrompt" rows="3" placeholder="Décrivez le visuel souhaité pour générer une image (angle, ambiance, couleurs Chaskis…)." style="width:100%;box-sizing:border-box;font-family:inherit;font-size:13px;line-height:1.5;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:#fff;color:var(--ink);resize:vertical">'+escHtml(C.prompt||"")+'</textarea></div>'
    +'<input type="file" accept="image/*" hidden id="cceFile">';
  const prev=document.getElementById("ccePrev");
  if(C.photo){ prev.style.backgroundImage="url('"+C.photo+"')"; prev.style.backgroundPosition="center "+C.photoPosY+"%"; }
  const pk=w.querySelector("[data-cpk]"); if(pk) pk.addEventListener("click",()=>document.getElementById("cceFile").click());
  const cl=w.querySelector("[data-ccl]"); if(cl) cl.addEventListener("click",()=>{ contestImg.photo=""; renderContestEditor(); });
  document.getElementById("cceFile").addEventListener("change",e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ contestImg.photo=rd.result; renderContestEditor(); }; rd.readAsDataURL(f); });
  const py=w.querySelector("[data-cposy]"); if(py) py.addEventListener("input",e=>{ contestImg.photoPosY=+e.target.value; const p=document.getElementById("ccePrev"); if(p) p.style.backgroundPosition="center "+contestImg.photoPosY+"%"; });
  const pr=document.getElementById("contestPrompt"); if(pr) pr.addEventListener("input",e=>{ contestImg.prompt=e.target.value; });
  refreshIcons();
}
function openContestModal(id){ contestEditId=id||null; const c=id?contestData.find(x=>x.id===id):null;
  document.getElementById("contestModalT").textContent=id?"Éditer le jeu concours":"Créer un jeu concours";
  document.getElementById("contestTitle").value=c?(c.title||""):"";
  setAffilSel("contestKind", c?(c.kind||"tirage"):"tirage");
  document.getElementById("contestPrize").value=c?(c.prize||""):"";
  document.getElementById("contestPeriod").value=c?(c.period||""):"";
  setAffilSel("contestStatus", c?(c.status||"good"):"good");
  document.getElementById("contestDesc").value=c?(c.desc||""):"";
  contestImg={ photo:c&&c.photo?c.photo:"", photoPosY:c&&c.photoPosY!=null?c.photoPosY:50, prompt:c&&c.prompt?c.prompt:"" };
  renderContestEditor();
  document.getElementById("contestModal").classList.add("show");
  setTimeout(()=>{ const n=document.getElementById("contestTitle"); if(n) n.focus(); },30);
}
function closeContestModal(){ document.getElementById("contestModal").classList.remove("show"); contestEditId=null; }
function saveContestForm(){
  const title=(document.getElementById("contestTitle").value||"").trim();
  const kind=document.getElementById("contestKind").value||"tirage";
  const prize=(document.getElementById("contestPrize").value||"").trim();
  const period=(document.getElementById("contestPeriod").value||"").trim();
  const status=document.getElementById("contestStatus").value||"good";
  const desc=(document.getElementById("contestDesc").value||"").trim();
  if(!title){ toast("Le titre est obligatoire"); document.getElementById("contestTitle").focus(); return; }
  if(!prize){ toast("Renseignez le lot à gagner"); document.getElementById("contestPrize").focus(); return; }
  const C=contestImg;
  const rec={ id:contestEditId||Date.now(), kind, title, prize, period, status, desc, photo:C.photo||"", photoPosY:C.photoPosY, prompt:C.prompt||"" };
  if(contestEditId){ const i=contestData.findIndex(x=>x.id===contestEditId); if(i>=0) contestData[i]=rec; toast("Jeu concours mis à jour"); }
  else { contestData.push(rec); toast("Jeu concours créé"); }
  saveContests(); closeContestModal(); renderAffiliation();
}
function delContest(id){ const c=contestData.find(x=>x.id===id); if(!c) return;
  if(!confirm("Supprimer « "+c.title+" » des jeux concours ?")) return;
  contestData=contestData.filter(x=>x.id!==id); saveContests(); renderAffiliation(); toast("Jeu concours supprimé"); }

/* ============================================================
   Copilote RDV : assistant du commercial pendant un rendez-vous
   ============================================================ */
const COP_KEY="chaskis_copilot";
const COP_PROMOS={ "CHASKIS10":10, "BIENVENUE":15, "PARTNER20":20 };
const COP_DISCOVERY=[
  { key:"contexte", title:"Contexte & besoin", color:"#534AB7", icon:"target",
    tip:"Cerner le volume et la nature des livraisons. « Aujourd'hui, combien d'envois par semaine, et vers où ? »",
    fields:[
      {k:"secteur", label:"Secteur", multi:false, opts:["E-commerce","Restauration","Santé / pharma","Retail","Fleuriste","Autre"]},
      {k:"zones", label:"Zones de livraison", multi:true, opts:["Genève","Vaud","Riviera","Léman","Suisse romande"]},
      {k:"marchandise", label:"Type de marchandise", multi:true, opts:["Standard","Fragile","Réfrigéré","Volumineux","Documents"]}
    ]},
  { key:"actuel", title:"Situation actuelle", color:"#0F6E56", icon:"history",
    tip:"Comprendre comment ils font aujourd'hui et ce qui coince. « Qu'est-ce qui vous frustre le plus dans votre livraison actuelle ? »",
    fields:[
      {k:"solution", label:"Solution actuelle", multi:false, opts:["En interne","Prestataire local","Uber / Smood","La Poste","Rien de structuré"]},
      {k:"douleurs", label:"Points de douleur", multi:true, opts:["Retards","Casse / perte","Coût imprévisible","Mauvaise image","Aucun suivi","Pas de SAV"]}
    ]},
  { key:"enjeux", title:"Enjeux & priorités", color:"#9A6A15", icon:"flag",
    tip:"Faire ressortir LA priorité. « Si vous ne deviez garder qu'un seul critère, ce serait lequel ? »",
    fields:[
      {k:"priorites", label:"Ce qui compte le plus", multi:true, opts:["Fiabilité","Rapidité","Prix","Image de marque","Traçabilité","Écologie","Flexibilité"]}
    ]},
  { key:"objections", title:"Objections & réponses", color:"#C0407B", icon:"messages-square",
    tip:"Cochez les objections rencontrées : l'argument à dégainer s'affiche.",
    fields:[
      {k:"objections", obj:true, opts:[
        ["C'est trop cher","Coursiers salariés et prix fixe annoncé à l'avance : zéro surprise, et une image premium livrée avec le colis."],
        ["On a déjà un prestataire","Faisons un mois test comparatif : fiabilité, suivi temps réel, un seul interlocuteur en Suisse romande."],
        ["On gère en interne","On libère vos équipes des tournées : elles se concentrent sur votre métier, nous sur la livraison."],
        ["On n'est pas sûrs du volume","L'abonnement Flex s'ajuste, sans engagement long : on démarre petit et on grandit ensemble."]
      ]}
    ]},
  { key:"decision", title:"Décision & prochaine étape", color:"#2F6FE0", icon:"circle-check-big",
    tip:"Verrouiller la suite avant de partir. « Quelle serait la prochaine étape idéale pour vous ? »",
    fields:[
      {k:"decideur", label:"Interlocuteur décisionnaire ?", multi:false, opts:["Oui","Décision partagée","Non, à valider"]},
      {k:"echeance", label:"Échéance", multi:false, opts:["Ce mois-ci","Ce trimestre","À définir"]},
      {k:"next", label:"Prochaine étape", multi:false, opts:["Offre par mail","Mois test","Nouveau RDV","Réflexion"]}
    ]}
];
function copBlank(){ return { company:"", contact:"", email:"", open:{contexte:true}, ans:{}, notes:"", sim:{volume:40, zone:"geneve", express:10}, promo:"", rdvKey:"", rdvLabel:"" }; }
let copState=copLoad();
function copLoad(){ try{ const s=JSON.parse(localStorage.getItem(COP_KEY)); if(s) return Object.assign(copBlank(), s); }catch(e){} return copBlank(); }
function copSave(){ try{ localStorage.setItem(COP_KEY, JSON.stringify(copState)); }catch(e){} }
function copOptOn(fk,val){ const a=copState.ans[fk]; return Array.isArray(a)?a.includes(val):a===val; }
function copAnsText(fk){ const a=copState.ans[fk]; return Array.isArray(a)?(a.length?a.join(", "):""):(a||""); }
function copToggle(fk,val,multi){
  if(multi){ const a=Array.isArray(copState.ans[fk])?copState.ans[fk]:[]; const i=a.indexOf(val); if(i<0)a.push(val); else a.splice(i,1); copState.ans[fk]=a; }
  else { copState.ans[fk]=(copState.ans[fk]===val)?"":val; }
  copSave(); renderCopSections(); renderCopRecap(); renderCopProgress(); refreshIcons();
}
function renderCopSections(){
  const w=document.getElementById("copSections"); if(!w) return; w.innerHTML="";
  COP_DISCOVERY.forEach(sec=>{
    const open=!!copState.open[sec.key], cnt=sec.fields.filter(f=>copAnsText(f.k)).length;
    const el=document.createElement("div"); el.className="cop-sec"+(open?" open":""); el.style.setProperty("--c",sec.color);
    let bd='<div class="cop-tip"><i data-lucide="lightbulb"></i><span>'+sec.tip+'</span></div>';
    sec.fields.forEach(f=>{
      if(f.obj){ bd+='<div class="cop-fld" data-fk="'+f.k+'">'+f.opts.map(o=>'<div class="cop-obj'+(copOptOn(f.k,o[0])?" on":"")+'" data-v="'+escHtml(o[0])+'"><div class="cop-obj-q"><span class="cop-obj-chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>« '+escHtml(o[0])+' »</div><div class="cop-obj-a">'+escHtml(o[1])+'</div></div>').join("")+'</div>'; }
      else { const multi=!!f.multi; bd+='<div class="cop-fld"><label>'+f.label+'</label><div class="cop-opts" data-fk="'+f.k+'" data-multi="'+(multi?1:0)+'">'+f.opts.map(o=>'<button class="cop-opt'+(copOptOn(f.k,o)?" on":"")+'" data-v="'+escHtml(o)+'">'+escHtml(o)+'</button>').join("")+'</div></div>'; }
    });
    el.innerHTML='<button type="button" class="cop-sec-hd"><span class="cop-sec-ic"><i data-lucide="'+sec.icon+'"></i></span><span class="cop-sec-t">'+sec.title+'</span>'+(cnt?'<span class="cop-sec-badge">'+cnt+'</span>':'')+'<svg class="cop-sec-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div class="cop-sec-bd">'+bd+'</div>';
    el.querySelector(".cop-sec-hd").addEventListener("click",()=>{ copState.open[sec.key]=!open; copSave(); renderCopSections(); refreshIcons(); });
    el.querySelectorAll(".cop-opts").forEach(box=>{ const fk=box.dataset.fk, multi=box.dataset.multi==="1"; box.querySelectorAll(".cop-opt").forEach(b=>b.addEventListener("click",()=>copToggle(fk,b.dataset.v,multi))); });
    el.querySelectorAll(".cop-obj").forEach(o=>{ const fk=o.closest("[data-fk]").dataset.fk; o.addEventListener("click",()=>copToggle(fk,o.dataset.v,true)); });
    w.appendChild(el);
  });
}
function copPromoPct(code){ const P=getPricing(); if(P&&Array.isArray(P.promos)){ const f=P.promos.find(x=>x.code===code); if(f) return f.pct; } return COP_PROMOS[code]||0; }
function copSimCalc(){ const P=getPricing(), s=copState.sim, vol=s.volume;
  const zone=(P.zones||[]).find(z=>z.key===s.zone), unit=zone?zone.unit:(s.zone==="leman"?22:14);
  const expRate=(P.express!=null?P.express:9), expSurcharge=Math.round(vol*s.express/100)*expRate;
  const flexBase=(P.flexMonthly!=null?P.flexMonthly:249), flexIncl=(P.flexIncluded!=null?P.flexIncluded:30);
  const payPer=vol*unit+expSurcharge, flex=flexBase+Math.max(0,vol-flexIncl)*unit+expSurcharge;
  const reco=flex<=payPer?"flex":"course", recoTotal=Math.min(flex,payPer);
  const promoPct=copPromoPct((copState.promo||"").toUpperCase()), final=Math.round(recoTotal*(1-promoPct/100));
  return {unit,vol,payPer,flex,reco,recoTotal,promoPct,final,saving:Math.max(payPer,flex)-recoTotal};
}
function copRangeFill(el){ if(!el) return; const min=+el.min||0, max=+el.max||100, v=+el.value; const pct=max>min?((v-min)/(max-min)*100):0; el.style.setProperty("--fill", pct.toFixed(1)+"%"); }
function copComputeSim(){ const o=document.getElementById("copSimOut"); if(!o) return; const c=copSimCalc();
  o.innerHTML='<div class="cop-sim-line"><span>À la course</span><b>'+c.payPer+' CHF<span style="font-weight:400;color:var(--muted)"> /mois</span></b></div>'
    +'<div class="cop-sim-line"><span>Abonnement Flex</span><b>'+c.flex+' CHF<span style="font-weight:400;color:var(--muted)"> /mois</span></b></div>'
    +'<div class="cop-sim-reco"><div class="cop-sim-reco-k">Recommandé · '+(c.reco==="flex"?"Abonnement Flex":"À la course")+'</div><div class="cop-sim-big">'+c.final+' <small>CHF / mois</small></div>'
    +(c.promoPct?'<div class="cop-sim-save">Code '+escHtml((copState.promo||"").toUpperCase())+' : -'+c.promoPct+'% appliqué</div>':'')
    +(c.saving>0?'<div class="cop-sim-save">Soit ~'+c.saving+' CHF/mois d\'économie vs l\'autre option</div>':'')
    +'</div>';
}
function renderCopSim(){
  const w=document.getElementById("copSim"); if(!w) return; const s=copState.sim;
  let zoneOpts=(getPricing().zones||[]).map(z=>[z.key,z.name]); if(!zoneOpts.length) zoneOpts=[["geneve","Genève"],["leman","Léman / Vaud"]];
  w.innerHTML='<div class="cop-sim-row"><label>Courses par mois · <b id="copVolLbl">'+s.volume+'</b></label><input type="range" class="cop-range" min="0" max="200" step="5" value="'+s.volume+'" id="copVol"></div>'
    +'<div class="cop-sim-row"><label>Zone dominante</label><div class="cop-opts" id="copZone">'+zoneOpts.map(z=>'<button class="cop-opt'+(s.zone===z[0]?" on":"")+'" data-z="'+z[0]+'" style="--c:#0F6E56">'+z[1]+'</button>').join("")+'</div></div>'
    +'<div class="cop-sim-row"><label>Part en express (&lt; 2h) · <b id="copExpLbl">'+s.express+' %</b></label><input type="range" class="cop-range" min="0" max="100" step="5" value="'+s.express+'" id="copExp"></div>'
    +'<div class="cop-sim-out" id="copSimOut"></div>'
    +'<div class="cop-promo"><input id="copPromo" placeholder="Code promo" value="'+escHtml(copState.promo||"")+'"><button class="btn" id="copPromoBtn">Appliquer</button></div>'
    +'<div id="copPromoMsg"></div>';
  copComputeSim();
  const vol=document.getElementById("copVol"); copRangeFill(vol); vol.addEventListener("input",e=>{ s.volume=+e.target.value; document.getElementById("copVolLbl").textContent=s.volume; copRangeFill(vol); copComputeSim(); copSave(); renderCopRecap(); });
  const exp=document.getElementById("copExp"); copRangeFill(exp); exp.addEventListener("input",e=>{ s.express=+e.target.value; document.getElementById("copExpLbl").textContent=s.express+" %"; copRangeFill(exp); copComputeSim(); copSave(); renderCopRecap(); });
  document.getElementById("copZone").querySelectorAll("[data-z]").forEach(b=>b.addEventListener("click",()=>{ s.zone=b.dataset.z; copSave(); renderCopSim(); renderCopRecap(); }));
  document.getElementById("copPromoBtn").addEventListener("click",copApplyPromo);
  document.getElementById("copPromo").addEventListener("keydown",e=>{ if(e.key==="Enter") copApplyPromo(); });
}
function copApplyPromo(){ const code=(document.getElementById("copPromo").value||"").trim().toUpperCase(); copState.promo=code; copSave();
  const msg=document.getElementById("copPromoMsg");
  if(copPromoPct(code)) msg.innerHTML='<div class="cop-promo-ok"><i data-lucide="check-circle-2"></i>Code valide : -'+copPromoPct(code)+'% sur l\'offre</div>';
  else if(code) msg.innerHTML='<div class="hint" style="margin:7px 0 0;color:#B23B3B">Code inconnu</div>';
  else msg.innerHTML="";
  copComputeSim(); renderCopRecap(); refreshIcons();
}
const COP_ARR='<svg class="cop-act-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
function copFirstName(){ var c=(copState.contact||"").trim(); return c?c.split(/[ ·]/)[0]:""; }
function copMailto(subject, body){ var to=encodeURIComponent(copState.email||""); return "mailto:"+to+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body); }
function renderCopActions(){ const w=document.getElementById("copActions"); if(!w) return;
  // Actions HONNÊTES : ouvrent un email pré-rempli (rien n'est « envoyé » en douce). Le suivi ouvre les RDV.
  const acts=[
    {k:"plaquette", ic:"file-text", t:"Envoyer la plaquette", s:"Email pré-rempli (joindre le PDF)"},
    {k:"offre", ic:"mail", t:"Envoyer l'offre chiffrée", s:"Email pré-rempli avec le chiffrage"},
    {k:"suivi", ic:"calendar-plus", t:"Planifier un suivi", s:"Ouvre les rendez-vous"}
  ];
  w.innerHTML=acts.map(a=>'<button type="button" class="cop-act" data-act="'+a.k+'"><span class="cop-act-ic"><i data-lucide="'+a.ic+'"></i></span><span class="cop-act-tx"><span class="cop-act-t">'+a.t+'</span><span class="cop-act-s">'+a.s+'</span></span>'+COP_ARR+'</button>').join("");
  const hi=function(){ var f=copFirstName(); return "Bonjour"+(f?" "+f:"")+","; };
  w.querySelector('[data-act="plaquette"]').addEventListener("click",()=>{
    var body=hi()+"\n\nComme convenu à l'instant, je vous joins la présentation de Chaskis.\n\n[Pensez à joindre la plaquette PDF avant d'envoyer.]\n\nBien à vous,";
    try{ window.location.href=copMailto("Chaskis — présentation", body); }catch(e){ toast("Impossible d'ouvrir l'email."); }
  });
  w.querySelector('[data-act="offre"]').addEventListener("click",()=>{
    var body=hi()+"\n\nSuite à notre échange, voici votre offre :\n\n"+copRecapText()+"\n\nJe reste à votre disposition.\nBien à vous,";
    try{ window.location.href=copMailto("Votre offre Chaskis", body); }catch(e){ toast("Impossible d'ouvrir l'email."); }
  });
  w.querySelector('[data-act="suivi"]').addEventListener("click",()=>showView("rdv"));
  refreshIcons();
}
function renderCopRecap(){ const w=document.getElementById("copRecap"); if(!w) return; const c=copSimCalc(); const dash='<span class="muted">—</span>';
  const rows=[
    ["Prospect", (copState.company?escHtml(copState.company):dash)+(copState.contact?' · '+escHtml(copState.contact):"")],
    ["Secteur", copAnsText("secteur")?escHtml(copAnsText("secteur")):dash],
    ["Zones", copAnsText("zones")?escHtml(copAnsText("zones")):dash],
    ["Aujourd'hui", copAnsText("solution")?escHtml(copAnsText("solution")):dash],
    ["Douleurs", copAnsText("douleurs")?escHtml(copAnsText("douleurs")):dash],
    ["Priorités", copAnsText("priorites")?escHtml(copAnsText("priorites")):dash],
    ["Offre", (c.reco==="flex"?"Flex":"À la course")+" · "+c.final+" CHF/mois"+(c.promoPct?" (-"+c.promoPct+"%)":"")],
    ["Décision", [copAnsText("decideur"),copAnsText("echeance")].filter(Boolean).map(escHtml).join(" · ")||dash],
    ["Suite", copAnsText("next")?escHtml(copAnsText("next")):dash]
  ];
  let h=rows.map(r=>'<div class="cop-recap-row"><span class="cop-recap-k">'+r[0]+'</span><span class="cop-recap-v">'+r[1]+'</span></div>').join("");
  const notes=(copState.notes||"").trim();
  h+='<div class="cop-recap-notes"><span class="cop-recap-k">Notes</span>'+(notes?'<div class="cop-recap-note">'+escHtml(notes).replace(/\n/g,"<br>")+'</div>':'<span class="cop-recap-v"><span class="muted">—</span></span>')+'</div>';
  w.innerHTML=h;
}
function renderCopProgress(){ const el=document.getElementById("copProg"); if(!el) return;
  const done=COP_DISCOVERY.filter(sec=>sec.fields.some(f=>copAnsText(f.k))).length;
  el.textContent="Préparation "+done+"/"+COP_DISCOVERY.length; }
function copRecapText(){ const c=copSimCalc(); const L=["Compte-rendu RDV — "+(copState.company||"prospect")];
  if(copState.contact) L.push("Interlocuteur : "+copState.contact);
  const add=(lbl,fk)=>{ const v=copAnsText(fk); if(v) L.push(lbl+" : "+v); };
  add("Secteur","secteur"); add("Zones","zones"); add("Marchandise","marchandise");
  add("Situation actuelle","solution"); add("Points de douleur","douleurs"); add("Priorités","priorites");
  const obj=copAnsText("objections"); if(obj) L.push("Objections traitées : "+obj);
  add("Décisionnaire","decideur"); add("Échéance","echeance"); add("Prochaine étape","next");
  L.push("Offre chiffrée : "+(c.reco==="flex"?"Abonnement Flex":"À la course")+" — "+c.final+" CHF/mois"+(c.promoPct?" (code "+(copState.promo||"").toUpperCase()+", -"+c.promoPct+"%)":""));
  if(copState.notes) L.push("Notes : "+copState.notes);
  return L.join("\n"); }
function renderCopilot(){
  const cc=document.getElementById("copCompany"); if(cc) cc.value=copState.company||"";
  const ct=document.getElementById("copContact"); if(ct) ct.value=copState.contact||"";
  const ce=document.getElementById("copEmail"); if(ce) ce.value=copState.email||"";
  const nt=document.getElementById("copNotes"); if(nt) nt.value=copState.notes||"";
  renderCopSections(); renderCopSim(); renderCopActions(); renderCopRecap(); renderCopProgress();
  renderCopRdvLink(); renderCopHistory(); refreshIcons();
}
/* Bandeau « vous préparez CE rendez-vous » quand le copilote a été ouvert depuis un RDV. */
function renderCopRdvLink(){
  var w=document.getElementById("copRdvLink"); if(!w) return;
  if(copState.rdvKey && copState.rdvLabel){ w.style.display=""; w.innerHTML='<i data-lucide="link-2"></i><div>Vous préparez le rendez-vous : <b>'+escHtml(copState.rdvLabel)+'</b>. En cliquant « Terminer », le compte-rendu sera <b>rattaché à ce rendez-vous</b>.</div>'; }
  else { w.style.display="none"; w.innerHTML=""; }
}
/* Télécharge un compte-rendu en .txt (réutilisé par « Terminer » et par la relecture d'historique). */
function downloadRecapText(text, company){
  try{ var blob=new Blob([text],{type:"text/plain;charset=utf-8"}); var url=URL.createObjectURL(blob); var a=document.createElement("a"); a.href=url; a.download="compte-rendu-"+(String(company||"rdv").replace(/[^a-z0-9]+/gi,"-").toLowerCase()||"rdv")+".txt"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} },1000); }catch(e){}
}
/* Historique des comptes-rendus (chaskis_copilot_hist) — DÉSORMAIS relu et affiché (avant : écrit
   mais jamais montré). Relecture dans une petite fenêtre + re-téléchargement. */
function copHistList(){ try{ var h=JSON.parse(localStorage.getItem("chaskis_copilot_hist")); return Array.isArray(h)?h:[]; }catch(e){ return []; } }
function renderCopHistory(){
  var w=document.getElementById("copHistory"); if(!w) return;
  var hist=copHistList();
  if(!hist.length){ w.innerHTML='<p class="hint" style="margin:0">Aucun compte-rendu enregistré pour l\'instant. Ils apparaîtront ici après « Terminer ».</p>'; return; }
  w.innerHTML=hist.slice(0,8).map(function(h,idx){
    return '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">'
      +'<div style="min-width:0"><div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(h.company||"Prospect")+'</div><div class="hint" style="margin:0">'+escHtml(fmtShort(h.date))+'</div></div>'
      +'<div style="display:flex;gap:6px;flex-shrink:0"><button class="btn ghost sm" data-cophist-view="'+idx+'">Relire</button><button class="btn ghost sm" data-cophist-dl="'+idx+'" title="Télécharger">↓</button></div></div>';
  }).join("");
  w.querySelectorAll("[data-cophist-view]").forEach(function(b){ b.addEventListener("click",function(){ var h=hist[+b.dataset.cophistView]; if(h) copShowRecap(h); }); });
  w.querySelectorAll("[data-cophist-dl]").forEach(function(b){ b.addEventListener("click",function(){ var h=hist[+b.dataset.cophistDl]; if(h) downloadRecapText(h.recap||"", h.company); }); });
}
function copShowRecap(h){
  var ov=document.createElement("div"); ov.className="thm-ov";
  ov.innerHTML='<div class="thm-card" style="max-width:560px"><button class="thm-x" title="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
    +'<h3 style="margin:0 0 4px">Compte-rendu · '+escHtml(h.company||"Prospect")+'</h3><p class="hint" style="margin:0 0 12px">'+escHtml(fmtShort(h.date))+'</p>'
    +'<div style="white-space:pre-wrap;font-size:13px;line-height:1.55;background:#F7F6FB;border:1px solid #E7E3F5;border-radius:8px;padding:12px 14px;max-height:50vh;overflow:auto">'+escHtml(h.recap||"")+'</div>'
    +'<div class="thm-acts" style="margin-top:12px"><button type="button" class="btn primary sm" id="crDl"><i data-lucide="download"></i>Télécharger</button><button type="button" class="btn ghost sm" id="crClose">Fermer</button></div></div>';
  document.body.appendChild(ov);
  var onKey=function(e){ if(e.key==="Escape") close(); };
  var close=function(){ ov.remove(); document.removeEventListener("keydown",onKey); };
  ov.addEventListener("click",function(e){ if(e.target===ov) close(); });
  ov.querySelector(".thm-x").addEventListener("click",close);
  ov.querySelector("#crClose").addEventListener("click",close);
  ov.querySelector("#crDl").addEventListener("click",function(){ downloadRecapText(h.recap||"", h.company); });
  document.addEventListener("keydown",onKey);
  refreshIcons();
}

/* ============================================================
   Utilisateurs & accès (page admin : gérer comptes + droits par rôle)
   ============================================================ */
let usrEditId=null, usrOv={grant:[],deny:[]}, usrOvCollapsed=new Set();
function renderUsers(){
  const list=document.getElementById("usrList"), cnt=document.getElementById("usrCount"); const me=currentUser();
  if(cnt) cnt.textContent=adminUsers.length+" utilisateur"+(adminUsers.length>1?"s":"");
  if(list){ list.innerHTML=""; adminUsers.forEach(u=>{ const row=document.createElement("div"); row.className="usr-row"; const isMe=u.id===me.id;
    const ovN=(u.grant?u.grant.length:0)+(u.deny?u.deny.length:0);
    const roleOpts=ROLE_ORDER.map(r=>'<option value="'+r+'"'+(u.role===r?" selected":"")+'>'+roleLabel(r)+'</option>').join("");
    row.innerHTML='<span class="usr-ava" style="background:'+roleColor(u.role)+'">'+userInitials(u)+'</span>'
      +'<div class="usr-main"><div class="usr-n">'+escHtml(u.name)+(isMe?'<span class="you">vous</span>':'')+'</div><div class="usr-e">'+escHtml(u.email||"—")+(ovN?'<span class="usr-ov-badge" title="Accès personnalisés au-delà du rôle">sur-mesure</span>':'')+'</div></div>'
      +'<div class="usr-role"><select class="formfsel usr-role-sel">'+roleOpts+'</select></div>'
      +'<button class="usr-edit" title="Réglages & accès sur-mesure"><i data-lucide="sliders-horizontal"></i></button>'
      +'<button class="usr-del" title="Retirer"'+(isMe?" disabled":"")+'><i data-lucide="trash-2"></i></button>';
    const sel=row.querySelector(".usr-role-sel"); sel.addEventListener("change",e=>setUserRole(u.id,e.target.value)); enhanceSelect(sel);
    row.querySelector(".usr-edit").addEventListener("click",()=>openUsrModal(u.id));
    const del=row.querySelector(".usr-del"); if(!isMe) del.addEventListener("click",()=>delUser(u.id));
    list.appendChild(row); }); }
  renderUsrAccess(); refreshIcons();
}
function setUserRole(id, role){ const u=adminUsers.find(x=>x.id===id); if(!u) return;
  if(u.role==="admin" && role!=="admin" && adminUsers.filter(x=>x.role==="admin").length<=1){ toast("Gardez au moins un administrateur"); renderUsers(); return; }
  u.role=role; saveUsers(); if(id===currentUser().id) applyRole(); toast("Rôle mis à jour"); renderUsers(); }
function delUser(id){ const u=adminUsers.find(x=>x.id===id); if(!u) return;
  if(id===currentUser().id){ toast("Vous ne pouvez pas vous retirer"); return; }
  if(u.role==="admin" && adminUsers.filter(x=>x.role==="admin").length<=1){ toast("Gardez au moins un administrateur"); return; }
  if(!confirm("Retirer "+u.name+" ?")) return; adminUsers=adminUsers.filter(x=>x.id!==id); saveUsers(); renderUsers(); toast("Utilisateur retiré"); }
let accCollapsed=null; /* init paresseux : CAP_GROUPS est défini plus bas dans le script */
function roleHasCap(role, cap){ return role==="admin" || (roleCaps[role]||[]).indexOf(cap)>=0; }
function moduleState(role, g){ if(role==="admin") return "all"; const on=g.caps.filter(c=>roleHasCap(role,c[0])).length; return on===0?"none":(on===g.caps.length?"all":"some"); }
const ACC_CHK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
function accChk(state, locked, attrs){ /* state : on | ind | off. Un seul glyphe centré, pas d'élément caché qui décale. */
  const glyph = state==="on" ? ACC_CHK_SVG : (state==="ind" ? '<span class="acc-dash"></span>' : "");
  return '<button type="button" class="acc-chk'+(state==="on"?" on":state==="ind"?" ind":"")+(locked?" locked":"")+'"'+(locked?" disabled":"")+" "+attrs+">"+glyph+"</button>";
}
function renderUsrAccess(){ const w=document.getElementById("usrAccess"); if(!w) return; const roles=ROLE_ORDER;
  if(!accCollapsed) accCollapsed=new Set(CAP_GROUPS.map(g=>g.mod));
  let h='<div class="acc-scroll"><table class="acc-tbl acc-caps"><colgroup><col class="acc-c0">'+roles.map(()=>'<col class="acc-cr">').join("")+'</colgroup><thead><tr><th>Capacité</th>'+roles.map(r=>'<th><span class="acc-role-h"><span class="acc-dot" style="background:'+roleColor(r)+'"></span>'+roleLabel(r)+'</span></th>').join("")+'</tr></thead><tbody>';
  CAP_GROUPS.forEach((g,gi)=>{ const col=accCollapsed.has(g.mod);
    if(gi>0) h+='<tr class="acc-gap"><td colspan="'+(roles.length+1)+'"></td></tr>';
    h+='<tr class="acc-grp'+(col?" col":"")+'"><td><button type="button" class="acc-grp-tog" data-tog="'+g.mod+'"><svg class="acc-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg><span class="acc-grp-ic"><i data-lucide="'+g.ic+'"></i></span>'+g.label+'<span class="acc-grp-n">'+g.caps.length+'</span></button></td>'
      + roles.map(r=>{ const st=moduleState(r,g), cs=st==="all"?"on":st==="some"?"ind":"off";
        return '<td>'+accChk(cs, r==="admin", 'data-mrole="'+r+'" data-mmod="'+g.mod+'" title="'+(st==="all"?"Tout coché":st==="some"?"Partiel":"Aucun")+'"')+'</td>'; }).join("")+'</tr>';
    g.caps.forEach((c,ci)=>{ const last=!col && ci===g.caps.length-1;
      h+='<tr class="acc-cap'+(col?" hide":"")+(last?" lastcap":"")+'"><td class="acc-cap-lbl">'+c[1]+'</td>'
      + roles.map(r=>{ const on=roleHasCap(r,c[0]);
        return '<td>'+accChk(on?"on":"off", r==="admin", 'data-crole="'+r+'" data-cap="'+c[0]+'"')+'</td>'; }).join("")+'</tr>'; });
  });
  h+='</tbody></table></div>'; w.innerHTML=h;
  w.querySelectorAll(".acc-grp-tog").forEach(b=>b.addEventListener("click",()=>{ const m=b.dataset.tog; accCollapsed.has(m)?accCollapsed.delete(m):accCollapsed.add(m); renderUsrAccess(); }));
  w.querySelectorAll(".acc-chk[data-cap]:not(.locked)").forEach(b=>b.addEventListener("click",()=>toggleRoleCap(b.dataset.crole,b.dataset.cap)));
  w.querySelectorAll(".acc-chk[data-mmod]:not(.locked)").forEach(b=>b.addEventListener("click",()=>toggleModuleCaps(b.dataset.mrole,b.dataset.mmod)));
  refreshIcons();
}
function setRoleCap(role, cap, on){ const a=roleCaps[role]||(roleCaps[role]=[]); const i=a.indexOf(cap); if(on && i<0) a.push(cap); else if(!on && i>=0) a.splice(i,1); }
function toggleRoleCap(role, cap){ setRoleCap(role, cap, !roleHasCap(role,cap)); saveRoleCaps(); if(role===currentUser().role) applyRole(); renderUsrAccess(); }
function toggleModuleCaps(role, mod){ const g=CAP_GROUPS.find(x=>x.mod===mod); if(!g) return; const on=moduleState(role,g)!=="all"; g.caps.forEach(c=>setRoleCap(role,c[0],on)); saveRoleCaps(); if(role===currentUser().role) applyRole(); renderUsrAccess(); }
function openUsrModal(id){ usrEditId=id||null; const u=id?adminUsers.find(x=>x.id===id):null;
  document.getElementById("usrModalT").textContent=id?"Éditer l'utilisateur":"Ajouter un utilisateur";
  document.getElementById("usrName").value=u?u.name:"";
  document.getElementById("usrEmail").value=u?(u.email||""):"";
  const rs=document.getElementById("usrRole"); rs.value=u?u.role:"commercial"; if(rs._ddSync) rs._ddSync();
  usrOv={ grant:(u&&u.grant?u.grant.slice():[]).filter(isCap), deny:(u&&u.deny?u.deny.slice():[]).filter(isCap) };
  usrOvCollapsed=new Set(CAP_GROUPS.map(g=>g.mod));
  renderUsrOvSection();
  document.getElementById("usrModal").classList.add("show");
  setTimeout(()=>{ const n=document.getElementById("usrName"); if(n) n.focus(); },30); }
function closeUsrModal(){ document.getElementById("usrModal").classList.remove("show"); usrEditId=null; }
/* Exceptions par personne : delta au-dessus du preset du rôle. grant = ajout, deny = retrait. */
function ovEff(role, cap){ let on=role!=="admin" && (roleCaps[role]||[]).indexOf(cap)>=0; if(usrOv.grant.indexOf(cap)>=0) on=true; if(usrOv.deny.indexOf(cap)>=0) on=false; return on; }
function ovStatus(role, cap){ if(usrOv.grant.indexOf(cap)>=0) return "add"; if(usrOv.deny.indexOf(cap)>=0) return "rem"; return ""; }
function toggleUsrOv(role, cap){ const inRole=(roleCaps[role]||[]).indexOf(cap)>=0, neweff=!ovEff(role,cap);
  usrOv.grant=usrOv.grant.filter(c=>c!==cap); usrOv.deny=usrOv.deny.filter(c=>c!==cap);
  if(neweff!==inRole){ if(neweff) usrOv.grant.push(cap); else usrOv.deny.push(cap); }
  renderUsrOv(); }
function renderUsrOvSection(){ const role=document.getElementById("usrRole").value, wrap=document.getElementById("usrOvWrap"), note=document.getElementById("usrOvNote"); if(!wrap) return;
  if(role==="admin"){ wrap.hidden=true; if(note) note.hidden=false; return; }
  if(note) note.hidden=true; wrap.hidden=false; renderUsrOv(); }
function renderUsrOv(){ const box=document.getElementById("usrOv"); if(!box) return; const role=document.getElementById("usrRole").value;
  let h="";
  CAP_GROUPS.forEach(g=>{ const col=usrOvCollapsed.has(g.mod), nov=g.caps.filter(c=>ovStatus(role,c[0])).length;
    h+='<div class="cov-grp"><button type="button" class="cov-ghd" data-tog="'+g.mod+'"><span class="cov-gic"><i data-lucide="'+g.ic+'"></i></span>'+g.label+(nov?'<span class="cov-gn">'+nov+'</span>':'')+'<svg class="acc-caret'+(col?" col":"")+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>'
      +'<div class="cov-body'+(col?" hide":"")+'">';
    g.caps.forEach(c=>{ const on=ovEff(role,c[0]), st=ovStatus(role,c[0]);
      h+='<div class="cov-row"><span class="cov-lbl">'+c[1]+'</span>'+(st==="add"?'<span class="cov-badge add">ajout</span>':st==="rem"?'<span class="cov-badge rem">retiré</span>':'')
        +accChk(on?"on":"off", false, 'data-cap="'+c[0]+'"')+'</div>'; });
    h+='</div></div>'; });
  box.innerHTML=h;
  box.querySelectorAll(".cov-ghd").forEach(b=>b.addEventListener("click",()=>{ const m=b.dataset.tog; usrOvCollapsed.has(m)?usrOvCollapsed.delete(m):usrOvCollapsed.add(m); renderUsrOv(); }));
  box.querySelectorAll(".acc-chk").forEach(b=>b.addEventListener("click",()=>toggleUsrOv(role,b.dataset.cap)));
  refreshIcons(); }
function saveUsrForm(){ const name=(document.getElementById("usrName").value||"").trim(); const email=(document.getElementById("usrEmail").value||"").trim(); const role=document.getElementById("usrRole").value;
  if(!name){ toast("Le nom est obligatoire"); return; }
  const grant=role==="admin"?[]:usrOv.grant.filter(isCap), deny=role==="admin"?[]:usrOv.deny.filter(isCap);
  if(usrEditId){ const u=adminUsers.find(x=>x.id===usrEditId); if(u){ u.name=name; u.email=email; u.role=role; u.grant=grant; u.deny=deny; } toast("Utilisateur mis à jour"); }
  else { adminUsers.push({id:"u"+Date.now(), name, email, role, grant, deny, color:USER_COLORS[adminUsers.length%USER_COLORS.length]}); toast("Utilisateur ajouté"); }
  saveUsers(); closeUsrModal(); applyRole(); renderUsers(); }

/* ============================================================
   View switching + sidebar
   ============================================================ */
const TITLES={ dashboard:"Tableau de bord", editor:"Édition du site", structure:"Structure & stratégie", media:"Médiathèque", versions:"Versions", notes:"Notes de version", progress:"Avancement", chatbot:"Chatbot", "chatbot-stats":"Statistiques du chatbot", clients:"Clients", rdv:"Rendez-vous", stats:"Statistiques", perf:"Performance", affiliation:"Affiliation", copilot:"Copilote RDV", users:"Utilisateurs & accès", tech:"Suivi technique" };
function showView(name){
  if(name==="chatbot-stats") name="chatbot";   // ancienne vue supprimée : les stats vivent dans le tiroir de la page Chatbot
  if(!canView(name)) name="dashboard";          // un rôle ne peut pas ouvrir une vue hors de son périmètre
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("on"));
  const v=document.getElementById("view-"+name); if(v) v.classList.add("on");
  const navName = name;
  document.querySelectorAll(".nav-i[data-view]").forEach(b=>b.classList.toggle("on", b.dataset.view===navName));
  const _tbT=document.getElementById("viewTitle"); _tbT.textContent=TITLES[name]||TITLES[navName]||"";
  syncHeaderTitle(v);
  // en édition, on replie la barre latérale pour laisser la place à la page (restaurée en sortant)
  const appEl=document.querySelector(".app");
  if(appEl){ if(name==="editor"){ if(!appEl.classList.contains("mini")){ appEl.dataset.autoMini="1"; appEl.classList.add("mini"); } }
    else if(appEl.dataset.autoMini){ appEl.classList.remove("mini"); delete appEl.dataset.autoMini; } }
  // l'état d'enregistrement n'a de sens que dans l'éditeur du site
  const ss=document.getElementById("saveState"); if(ss) ss.style.display=(name==="editor")?"":"none";
  const pb=document.getElementById("publishBtn"); if(pb) pb.style.display=(name==="editor")?"":"none";
  if(name==="editor") ensureEditor();
  if(name==="media") renderAllMedia();
  if(name==="versions") renderVersions();
  if(name==="notes") renderReleaseLog();
  if(name==="progress") renderProgress();
  if(name==="dashboard") updateDashboard();
  if(name==="chatbot") renderChatbot();
  if(name==="clients") renderClients();
  if(name==="rdv"){ renderRdv(); if(getStoredPublishKey()) syncCalendlyRdv(true); }
  if(name==="stats") renderStats();
  if(name==="perf") renderPerf();
  if(name==="structure") renderStructure();
  if(name==="affiliation") renderAffiliation();
  if(name==="copilot") renderCopilot();
  if(name==="users") renderUsers();
  if(name==="tech") renderTech();
  saveUI({view:name});
}
// Titre du header : masqué tant que le titre de la page est visible, révélé en fondu dès qu'il sort du viewport au scroll.
let _hdrTitleObs=null;
function syncHeaderTitle(view){
  const tb=document.getElementById("viewTitle"); if(!tb) return;
  if(_hdrTitleObs){ _hdrTitleObs.disconnect(); _hdrTitleObs=null; }
  const pgH = view ? view.querySelector(".pg-h") : null;
  const scroller = (view && view.classList.contains("scroll")) ? view : null;
  // Vues sans titre de page (l'éditeur du site) : le titre du header est le seul repère, on le laisse affiché.
  if(!pgH || !scroller){ tb.classList.add("revealed"); return; }
  tb.classList.remove("revealed");
  _hdrTitleObs = new IntersectionObserver((entries)=>{
    for(const e of entries){ tb.classList.toggle("revealed", !e.isIntersecting); }
  }, { root: scroller, threshold: 0 });
  _hdrTitleObs.observe(pgH);
}
function saveUI(patch){ let s={}; try{ s=JSON.parse(localStorage.getItem(UI_KEY))||{}; }catch(e){} Object.assign(s,patch); localStorage.setItem(UI_KEY, JSON.stringify(s)); }
function loadUI(){ try{ return JSON.parse(localStorage.getItem(UI_KEY))||{}; }catch(e){ return {}; } }
/* Agrège tout l'état de l'admin (toutes les clés localStorage) en un objet unique :
   socle du futur bouton Publier et base d'une sauvegarde/export auditable. Lecture seule. */
/* Construit le fichier site-content.json exactement conforme au contrat
   (api/_lib/content-schema.js) : c'est le fichier que la publication ecrira dans le
   depot. TEXTE + tarifs seulement (le schema refuse le HTML : draft.html est donc
   exclu ; les edits de structure/images ne passent pas encore par ce contrat).
   content.js lit par page et n'applique que les cles presentes sur chaque page. On publie
   donc un bloc i18n PROPRE A CHAQUE PAGE (bucketI18n) : les cles partagees (nav/pied =
   window.T_BASE) sont recopiees dans toutes les pages, les cles propres a une page ne vont
   que dans cette page. Verifiable hors ligne : node -e "require('./api/_lib/content-schema')
   .validateContent(obj)". */
/* Fonction PURE (sans DOM) : repartit le dictionnaire i18n edite (t = {fr:{k:v},en:{}}) en
   blocs par page, selon keyPage (k -> "shared" | page | absent). "shared"/absent => toutes
   les pages (repli non-cassant), sinon la page indiquee. Retourne { <page>:{i18n:{fr:{},en:{}}} }
   sans les pages vides. Isolee (pure) pour etre verifiable par l'audit in-app. */
function bucketI18n(t, km){
  t=t||{}; km=km||{};
  var PP=["accueil","mobilite","recrutement","commander","suivi","dashboard"];
  var buckets={}; PP.forEach(function(pk){ buckets[pk]={}; });
  var put=function(pk,lg,key,val){ (buckets[pk][lg]||(buckets[pk][lg]={}))[key]=val; };
  ["fr","en"].forEach(function(lg){
    var src=t[lg]; if(!src||typeof src!=="object") return;
    Object.keys(src).forEach(function(key){
      var where=km[key];
      if(where&&where!=="shared"&&buckets[where]) put(where,lg,key,src[key]);
      else PP.forEach(function(pk){ put(pk,lg,key,src[key]); });
    });
  });
  var out={};
  PP.forEach(function(pk){ var b=buckets[pk]; if(["fr","en"].some(function(lg){ return b[lg]&&Object.keys(b[lg]).length; })) out[pk]={ i18n:b }; });
  return out;
}
function buildSiteContent(){
  const out={ schemaVersion:1, version:(typeof ADMIN_BUILD!=="undefined"?ADMIN_BUILD.version:undefined), updatedAt:new Date().toISOString() };
  try{ const nm=(currentUser()||{}).name; if(nm) out.updatedBy=String(nm); }catch(e){}
  try{ const pr=getPricing(); if(pr&&typeof pr==="object"){ const P={}; ["days","tiers","zones","flexMonthly","flexIncluded","express","promos"].forEach(function(k){ if(pr[k]!==undefined) P[k]=pr[k]; }); out.pricing=P; } }catch(e){}
  // Textes i18n publiés PAR PAGE (réconciliation du brouillon multi-pages), via bucketI18n().
  var pagesOut=bucketI18n((draft&&draft.text)?draft.text:{}, (draft&&draft.keyPage)?draft.keyPage:{});
  // Remplacements d'images publiés PAR PAGE : uniquement les URL https (jamais un dataURL).
  if(draft&&draft.imgPub){ Object.keys(draft.imgPub).forEach(function(pk){
    var m=draft.imgPub[pk]||{}, imgs={};
    Object.keys(m).forEach(function(orig){ var u=m[orig]; if(typeof u==="string"&&/^https:\/\//i.test(u)) imgs[orig]=u; });
    if(Object.keys(imgs).length){ (pagesOut[pk]||(pagesOut[pk]={})).images=imgs; }
  }); }
  if(Object.keys(pagesOut).length) out.pages=pagesOut;
  // Réglages de l'assistant (chantier chatbot) : uniquement la CONFIG (pas les sources/documents,
  // qui ne doivent pas fuir dans le JSON public). Lu par api/chat.js après publication.
  try{ if(typeof chat==="object"&&chat){ const C={};
    if(Array.isArray(chat.forbidden)&&chat.forbidden.length) C.forbidden=chat.forbidden.map(String);
    // chat.allowed n'est PAS publié : il resterait du code mort côté bot (non imposé comme
    // filtre dur pour éviter le sur-blocage). Le périmètre en ligne = récupération + sujets
    // interdits + prompt. La liste « sujets autorisés » de l'admin reste indicative.
    ["tone","length","fallback","botName","address","emojiLevel","defaultLang","uncertain"].forEach(function(k){ if(typeof chat[k]==="string"&&chat[k].trim()) C[k]=chat[k]; });
    if(typeof chat.instr==="string"&&chat.instr.trim()) C.instructions=chat.instr;
    // Base de connaissances : on publie le TEXTE des sources (borné en taille) pour que le bot
    // en ligne les utilise. Pas les binaires/gros documents (taille du JSON limitée).
    if(Array.isArray(chat.sources)&&chat.sources.length){
      const S=chat.sources.slice(0,15).map(function(s){
        const o={ title:String((s&&(s.n||s.title))||"Source").slice(0,200) };
        if(s&&Array.isArray(s.tags)&&s.tags.length) o.tags=s.tags.map(function(t){return String(t).slice(0,60);}).slice(0,8);
        const txt=((s&&(typeof s.prev==="string"?s.prev:(typeof s.text==="string"?s.text:"")))||"").trim();
        if(txt) o.text=txt.slice(0,1500);
        return o;
      }).filter(function(o){ return o.text; });
      if(S.length) C.sources=S;
    }
    if(Object.keys(C).length) out.chatbot=C;
  } }catch(e){}
  return out;
}

document.getElementById("navlist").addEventListener("click",(e)=>{
  const b=e.target.closest(".nav-i"); if(!b||b.classList.contains("dis")||!b.dataset.view) return;
  showView(b.dataset.view);
});
document.querySelectorAll("[data-goto]").forEach(b=> b.addEventListener("click",()=>showView(b.dataset.goto)));

// collapse (+ repli automatique en dessous d'une certaine largeur, ré-ouvrable à la main)
const app=document.getElementById("app");
const NAV_BP=1200;
let respNarrow=null;
function applyResponsiveNav(){
  const narrow = window.innerWidth < NAV_BP;
  if(narrow===respNarrow) return; respNarrow=narrow;
  if(narrow) app.classList.add("mini");
  else app.classList.toggle("mini", !!loadUI().mini);
}
window.addEventListener("resize", applyResponsiveNav);
document.getElementById("collapseBtn").addEventListener("click",()=>{ app.classList.toggle("mini"); saveUI({mini:app.classList.contains("mini")}); });

/* ============================================================
   Editor controls
   ============================================================ */
document.getElementById("lang").addEventListener("click",(e)=>{
  const b=e.target.closest("button[data-lang]"); if(!b) return;
  currentLang=b.dataset.lang;
  document.querySelectorAll("#lang button").forEach(x=>x.classList.toggle("on",x===b));
  if(WIN&&typeof WIN.setLang==="function"){ try{ WIN.setLang(currentLang); }catch(e){} }
  applyTextForLang();
  toast(currentLang==="en"?"Édition en anglais":"Édition en français");
});
document.getElementById("device").addEventListener("click",(e)=>{
  const b=e.target.closest("button[data-dev]"); if(!b) return;
  const mobile=b.dataset.dev==="mobile";
  document.querySelectorAll("#device button").forEach(x=>x.classList.toggle("on",x===b));
  document.getElementById("frameWrap").classList.toggle("mobile",mobile);
  reloadIframe("Rendu "+(mobile?"mobile":"bureau")+"…");
});
const promoSwitch=document.getElementById("promoSwitch");
function setPromoSwitch(on){ promoSwitch.classList.toggle("on",on); promoSwitch.setAttribute("aria-checked",on); }
promoSwitch.addEventListener("click",()=>{
  const on=!promoSwitch.classList.contains("on"); setPromoSwitch(on);
  draft.promoHidden=!on; setPromoVisible(on); markDirty();
});
document.getElementById("resetBtn").addEventListener("click",()=>{
  if(_verPreview){ toast("Quittez d'abord l'aperçu de version (le brouillon réel est mis de côté)."); return; } /* sinon on effacerait le brouillon réel */
  if(!confirm("Réinitialiser toutes les modifications du brouillon ?")) return;
  draft=blankDraft(); localStorage.removeItem(STORE_KEY); setSaved();
  reloadIframe("Rechargement…"); updateDashboard();
});
function reloadIframe(msg){ loader.style.display="flex"; loader.innerHTML='<div class="spin"></div>'+(msg||"Chargement…"); iframe.src=currentPageFile(); }
(function wireEditPages(){
  const sel=document.getElementById("editPageSel");
  if(sel){ sel.innerHTML=EDIT_PAGES.map(p=>'<option value="'+p.key+'">'+p.label+'</option>').join(""); sel.value=editPage;
    enhanceSelect(sel); sel.addEventListener("change",e=>switchEditPage(e.target.value)); }
  const pv=document.getElementById("previewBtn"); if(pv) pv.addEventListener("click",()=>togglePreview());
  const cmp=document.getElementById("compareBtn"); if(cmp) cmp.addEventListener("click",openOnline);
})();

/* media buttons */
document.getElementById("mediaClose").addEventListener("click",()=> document.getElementById("mediaModalBg").classList.remove("show"));
document.getElementById("mediaImport").addEventListener("click",()=> mediaInput.click());
document.getElementById("mediaModalBg").addEventListener("click",(e)=>{ if(e.target.id==="mediaModalBg") document.getElementById("mediaModalBg").classList.remove("show"); });
(function(){ const zone=document.getElementById("mediaImportZone"); if(!zone) return;
  const openPick=()=>{ mediaTarget=null; mediaInput.click(); };
  zone.addEventListener("click",openPick);
  zone.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openPick(); } });
  ["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{ e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave","dragend"].forEach(ev=>zone.addEventListener(ev,e=>{ e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop",e=>{ e.preventDefault(); zone.classList.remove("drag"); mediaTarget=null; const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) importMediaFile(f); });
})();
document.getElementById("mdClose").addEventListener("click",closeMediaDetail);
document.getElementById("mediaDetailModal").addEventListener("click",(e)=>{ if(e.target.id==="mediaDetailModal") closeMediaDetail(); });
document.getElementById("specClose").addEventListener("click",closeSpec);
document.getElementById("specModal").addEventListener("click",(e)=>{ if(e.target.id==="specModal") closeSpec(); });

/* publish */
const pubBg=document.getElementById("pubModalBg");
const PUBKEY_SS="chaskis_publish_key";
/* Mesure d'attente avant l'auth Clerk : la clé est mémorisée sur cet appareil (localStorage),
   à ne saisir qu'une seule fois. Le futur système de connexion (Clerk) la remplacera. */
// Auth des appels /api : quand on est connecté via Clerk, on renvoie le jeton de session Clerk
// (mis en cache et rafraîchi par le bootstrap de editor.html) ; sinon la clé stockée (repli
// break-glass). Ainsi tous les appels /api existants basculent sur Clerk sans être modifiés.
function getStoredPublishKey(){ try{ if(window.__clerkToken) return window.__clerkToken; return localStorage.getItem(PUBKEY_SS)||sessionStorage.getItem(PUBKEY_SS)||""; }catch(e){ return ""; } }
function setStoredPublishKey(v){ try{ if(v) localStorage.setItem(PUBKEY_SS,v); else { localStorage.removeItem(PUBKEY_SS); sessionStorage.removeItem(PUBKEY_SS); } }catch(e){} }
function publishKeySection(){
  const has=!!getStoredPublishKey();
  let h='<div style="margin-top:16px;padding-top:14px;border-top:1px solid #EEF0EE">';
  h+='<div style="font-weight:600;margin-bottom:6px">Mise en ligne automatique</div>';
  if(has){ h+='<div style="color:var(--muted,#6b6f6b);font-size:14px">Clé de publication mémorisée sur cet appareil. <button type="button" id="pubKeyForget" style="background:none;border:0;color:var(--teal,#0E9AA0);cursor:pointer;text-decoration:underline;padding:0;font:inherit">changer</button></div>'; }
  else{ h+='<div style="color:var(--muted,#6b6f6b);font-size:13px;margin-bottom:8px">Collez votre clé de publication (la même que dans Vercel). Elle est mémorisée sur cet appareil : à saisir une seule fois. Sans clé, la version est seulement enregistrée en local.</div>'; h+='<input type="password" id="pubKeyInput" placeholder="Clé de publication" autocomplete="off" style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #D8DCD8;border-radius:9px;font:inherit">'; }
  h+='</div>'; return h;
}
function openPublish(){
  if(_verPreview){ toast("Quittez l'aperçu de version avant de publier."); return; } /* sinon on publierait le snapshot prévisualisé, pas le brouillon */
  const online=publishedSummary(draft), local=localOnlySummary(draft), pend=pendingUploadCount(draft);
  let h="Publier crée une version (<b>v"+(versions.length+1)+"</b>).<br><br>";
  h+='<b>Mis en ligne sur le site :</b><br>'+escHtml(online)+"<br>";
  if(local.length){
    h+='<div style="margin-top:12px;padding:10px 12px;background:#FBF7EC;border:1px solid #EBDCB6;border-radius:9px;font-size:13px;color:#7a6320">'
      +'<b>Enregistré dans la version locale seulement</b> (pas encore poussé en ligne — l\'intégration serveur de ces éléments viendra) :<br>'+escHtml(local.join(", "))+'</div>';
  }
  if(pend){
    h+='<div style="margin-top:10px;padding:10px 12px;background:#FDECEC;border:1px solid #F3C6C6;border-radius:9px;font-size:13px;color:#9a3b3b">'
      +'⚠️ '+pend+' image'+(pend>1?"s":"")+' encore en cours d\'envoi : publiez à nouveau une fois l\'envoi terminé pour '+(pend>1?"qu\'elles apparaissent":"qu\'elle apparaisse")+' en ligne.</div>';
  }
  h+=publishKeySection();
  document.getElementById("pubBody").innerHTML=h;
  const forget=document.getElementById("pubKeyForget"); if(forget) forget.addEventListener("click",()=>{ setStoredPublishKey(""); openPublish(); });
  pubBg.classList.add("show");
}
document.getElementById("publishBtn").addEventListener("click",openPublish);
document.getElementById("pubCancel").addEventListener("click",()=> pubBg.classList.remove("show"));
document.getElementById("pubCloseX").addEventListener("click",()=> pubBg.classList.remove("show"));
pubBg.addEventListener("click",(e)=>{ if(e.target===pubBg) pubBg.classList.remove("show"); });
document.getElementById("pubConfirm").addEventListener("click",publishNow);
async function publishNow(){
  const btn=document.getElementById("pubConfirm");
  const inp=document.getElementById("pubKeyInput"); if(inp&&inp.value.trim()) setStoredPublishKey(inp.value.trim());
  const key=getStoredPublishKey();
  if(!key){ publishVersion(); pubBg.classList.remove("show"); return; }
  const content=buildSiteContent();
  const orig=btn?btn.innerHTML:""; if(btn){ btn.disabled=true; btn.innerHTML="Publication en ligne…"; }
  try{
    const res=await fetch("/api/publish",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify(content)});
    let data={}; try{ data=await res.json(); }catch(e){}
    if(res.status===200){ publishVersion(); _onlineVerLoaded=false; pubBg.classList.remove("show"); toast("Publié en ligne. Le site se met à jour dans une minute environ."); } /* _onlineVerLoaded=false -> le panneau « Versions en ligne » se rechargera */
    else if(res.status===401){ setStoredPublishKey(""); toast("Clé de publication refusée. Vérifiez-la puis recommencez."); openPublish(); }
    else if(res.status===403){ toast("Votre compte n'a pas le droit de publier (rôle sans la capacité « publier »). Contactez un administrateur."); }
    else if(res.status===400){ toast("Contenu non publiable : "+((data&&data.details&&data.details[0])||(data&&data.error)||"format invalide")); }
    else if(res.status===409){ toast("Quelqu'un vient de publier. Rechargez la page, puis republiez."); }
    else if(res.status===500){ toast("Réglages serveur incomplets (variables à finir dans Vercel)."); }
    else if(res.status===501){ publishVersion(); pubBg.classList.remove("show"); toast("La mise en ligne se teste sur le site en ligne, pas dans cet aperçu local. Version enregistrée en local."); }
    else { toast("Publication indisponible pour le moment (code "+res.status+")."); }
  }catch(e){
    publishVersion(); pubBg.classList.remove("show"); toast("Publication impossible pour le moment (réseau ou serveur injoignable). Réessayez. La version est enregistrée en local.");
  } finally { if(btn){ btn.disabled=false; btn.innerHTML=orig; } }
}
document.getElementById("pubExport").addEventListener("click",()=>{
  const content=buildSiteContent();
  const blob=new Blob([JSON.stringify(content,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="site-content.json"; a.click();
  toast("Fichier site-content.json exporté (prêt à publier)");
});

/* toast */
let toastTimer=null;
function toast(msg){ const t=document.getElementById("toast"); document.getElementById("toastMsg").textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),1900); }

/* ============================================================
   Chatbot module (interactive)
   ============================================================ */
const CHAT_KEY="chaskis_chatbot_v2_"+PAGE;
const LANGS=[{k:"fr",l:"Français"},{k:"en",l:"English"},{k:"de",l:"Deutsch"},{k:"it",l:"Italiano"}];
const LANG_LBL={fr:"Français",en:"English",de:"Deutsch",it:"Italiano",pt:"Português",es:"Español",tr:"Türkçe",so:"Soomaali",ar:"العربية"};
function blankChat(){ return {
  sources:[
    {n:"tarifs-2026.pdf",kind:"file",ext:"pdf",pages:12,size:238000,tags:["Tarifs","Offres"],s:"indexé",prev:"Grille tarifaire 2026\n\nCourse standard (Genève intra-muros) : 14 CHF.\nZone Léman (Nyon, Morges, Lausanne) : dès 22 CHF.\nAbonnement Flex : 249 CHF / mois, 30 courses incluses.\nAbonnement Dédié : sur devis, coursier attitré.\nSupplément express (< 2 h) : +9 CHF."},
    {n:"zones-livraison.docx",kind:"file",ext:"docx",pages:4,size:96000,tags:["Zones","Délais"],s:"indexé",prev:"Zones de livraison\n\nGenève : livraison le jour même, créneaux 9h-18h.\nNyon / Morges : J+0 si commande avant 11h, sinon J+1.\nLausanne / Riviera : J+1, créneau matin ou après-midi.\nLe samedi est couvert sur la zone Léman de 9h à 17h."},
    {n:"FAQ du site",kind:"url",url:"https://chaskis.ch/faq",tags:["Général","Services"],s:"synchronisé",prev:"FAQ publiée sur chaskis.ch/faq\n\n• Comment commander une course ?\n• Quels sont les délais garantis ?\n• Livrez-vous les produits fragiles / réfrigérés ?\n• Comment fonctionne la facturation mensuelle ?\n(La FAQ du site est resynchronisée automatiquement à chaque publication.)"}
  ],
  allowed:["Tarifs","Délais","Zones","Services"],
  forbidden:["Données clients","Marges internes","Coordonnées coursiers"],
  tone:"pro", length:"moyenne", autoLang:true, defaultLang:"fr",
  fallback:"Je n'ai pas la réponse exacte ici. Écrivez-nous à hello@chaskis.ch, on vous répond vite.",
  instr:"Tu es l'assistant de Chaskis, service de livraison B2B en Suisse romande. Réponds à partir des sources fournies, reste factuel et ne donne jamais d'information confidentielle.",
  botName:"Assistant Chaskis", address:"vous", emojiLevel:"parcimonie",
  escalateAfter:2, escalateChannel:"rdv",
  offHours:false, uncertain:"prudent",
  version:"1.0.2",
  changelog:[
    {v:"1.0.2",date:"1 juil.",text:"Source ajoutée : « zones-livraison.docx » (tags Zones, Délais)."},
    {v:"1.0.1",date:"28 juin",text:"Sujet interdit ajouté : « Marges internes »."},
    {v:"1.0.0",date:"25 juin",text:"Création de l'assistant."}
  ] }; }
let chat=loadChat();
/* stats chatbot par période (démo, cohérent avec les cartes Rendez-vous : contexte + comparaison période préc.) */
let cbKey="30j";
const CB_PERIODS={
  "7j": {conv:298,  dConv:12, q:121,  un:9,   unScope:5,  unKnow:4,  dRate:2, curR:"23-29 juin", prevR:"16-22 juin", chart:{labels:["lun","mar","mer","jeu","ven","sam","dim"], vals:[90,93,92,94,93,95,93]}},
  "30j":{conv:1248, dConv:18, q:512,  un:41,  unScope:13, unKnow:28, dRate:3, curR:"1-30 juin",  prevR:"1-31 mai",   chart:{labels:["2-8 juin","9-15 juin","16-22 juin","23-30 juin"], vals:[89,90,91,92]}},
  "3m": {conv:3520, dConv:24, q:1490, un:132, unScope:74, unKnow:58, dRate:4, curR:"avr-juin 2026", prevR:"janv-mars 2026", chart:{labels:["avril","mai","juin"], vals:[89,91,92]}},
  "6m": {conv:6380, dConv:31, q:2690, un:255, unScope:150,unKnow:105,dRate:5, curR:"janv-juin 2026", prevR:"juil-déc 2025", chart:{labels:["janv.","févr.","mars","avr.","mai","juin"], vals:[87,88,89,90,91,92]}},
  "12m":{conv:11200,dConv:46, q:4720, un:470, unScope:280,unKnow:190,dRate:7, curR:"juil 2025 - juin 2026", prevR:"année préc.", chart:{labels:["juil.","août","sept.","oct.","nov.","déc.","janv.","févr.","mars","avr.","mai","juin"], vals:[84,85,86,86,87,88,88,89,90,90,91,92]}}
};
/* questions sans réponse. reason : "scope" = hors périmètre / "knowledge" = à documenter */
let cbUnPage=1; const CB_UN_PER=8;
const CB_UN_RAW=[
  ["Vous livrez des palettes de plus de 500 kg ?","knowledge","fr"],
  ["Proposez-vous des cartons isothermes pour les surgelés ?","knowledge","fr"],
  ["Can I get an invoice with VAT for my company?","knowledge","en"],
  ["Liefern Sie auch nach Freiburg?","knowledge","de"],
  ["Avez-vous une assurance en cas de casse d'un colis fragile ?","knowledge","fr"],
  ["Livrez-vous le dimanche à Genève ?","knowledge","fr"],
  ["Puis-je programmer une livraison récurrente chaque semaine ?","knowledge","fr"],
  ["Quel est le délai pour une course urgente à Lausanne ?","knowledge","fr"],
  ["Do you handle temperature-controlled deliveries?","knowledge","en"],
  ["Entregam medicamentos para farmácias?","knowledge","pt"],
  ["Acceptez-vous le paiement par carte à la livraison ?","knowledge","fr"],
  ["Consegnate anche a Lugano?","knowledge","it"],
  ["Y a-t-il un suivi GPS en temps réel du coursier ?","knowledge","fr"],
  ["Quelle est la taille maximale de colis acceptée ?","knowledge","fr"],
  ["Proposez-vous des emballages écologiques ?","knowledge","fr"],
  ["Can I book a specific one-hour delivery slot?","knowledge","en"],
  ["Livrez-vous dans les zones piétonnes du centre ?","knowledge","fr"],
  ["Reprenez-vous les emballages vides après livraison ?","knowledge","fr"],
  ["هل توصّلون الطرود المبرّدة إلى المطاعم؟","knowledge","ar"],
  ["Facturez-vous les kilomètres à vide ?","knowledge","fr"],
  ["Bieten Sie einen Express-Service am Wochenende an?","knowledge","de"],
  ["¿Entregan objetos frágiles con seguro?","knowledge","es"],
  ["Cumartesi Nyon'a teslimat yapıyor musunuz?","knowledge","tr"],
  ["Peut-on annuler une course déjà commandée ?","knowledge","fr"],
  ["Ma keentaan baakadaha qaboojinta ah?","knowledge","so"],
  ["Livrez-vous aux particuliers ou seulement aux entreprises ?","knowledge","fr"],
  ["Do you offer same-day delivery in Nyon?","knowledge","en"],
  ["Gestite anche resi e ritiri?","knowledge","it"],
  ["Do you deliver to France, in Annemasse?","scope","en"],
  ["Quel est le salaire d'un coursier chez vous ?","scope","fr"],
  ["C'est quoi votre marge sur une course express ?","scope","fr"],
  ["Pouvez-vous me donner le numéro d'un de vos coursiers ?","scope","fr"],
  ["¿Cuánto gana un repartidor en Chaskis?","scope","es"],
  ["Qui sont vos plus gros clients ?","scope","fr"],
  ["Quel logiciel utilisez-vous en interne ?","scope","fr"],
  ["Puis-je avoir la liste de vos coursiers ?","scope","fr"],
  ["Livrez-vous jusqu'à Paris ?","scope","fr"],
  ["Quel est le chiffre d'affaires de Chaskis ?","scope","fr"],
  ["Can you share a client's delivery address?","scope","en"],
  ["Quelles négociations tarifaires avez-vous avec vos gros comptes ?","scope","fr"],
  ["Recrutez-vous des coursiers en ce moment ?","scope","fr"]
];
const cbUnanswered=(function(){
  const times=["14:32","11:08","17:45","09:21","16:03","10:14","15:39","08:52","13:20","18:04","12:47","07:58","15:11","09:44"];
  const out=[]; let dnum=1, mon="juil.";
  CB_UN_RAW.forEach((r,i)=>{ out.push({q:r[0],reason:r[1],lang:r[2],date:dnum+" "+mon,time:times[i%times.length]});
    if(i%2===1){ if(mon==="juil."){ mon="juin"; dnum=30; } else { dnum=Math.max(1,dnum-1); } } });
  return out;
})();
const FLAG={
  fr:'<svg viewBox="0 0 9 6"><rect width="3" height="6" fill="#0055A4"/><rect x="3" width="3" height="6" fill="#fff"/><rect x="6" width="3" height="6" fill="#EF4135"/></svg>',
  en:'<svg viewBox="0 0 60 36"><rect width="60" height="36" fill="#012169"/><path d="M0 0 60 36M60 0 0 36" stroke="#fff" stroke-width="7"/><path d="M0 0 60 36" stroke="#C8102E" stroke-width="4"/><path d="M60 0 0 36" stroke="#C8102E" stroke-width="4"/><path d="M30 0V36M0 18H60" stroke="#fff" stroke-width="12"/><path d="M30 0V36M0 18H60" stroke="#C8102E" stroke-width="7"/></svg>',
  de:'<svg viewBox="0 0 5 3"><rect width="5" height="1" y="0" fill="#000"/><rect width="5" height="1" y="1" fill="#D00"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>',
  it:'<svg viewBox="0 0 9 6"><rect width="3" height="6" fill="#009246"/><rect x="3" width="3" height="6" fill="#fff"/><rect x="6" width="3" height="6" fill="#CE2B37"/></svg>',
  pt:'<svg viewBox="0 0 9 6"><rect width="9" height="6" fill="#FF0000"/><rect width="3.6" height="6" fill="#006600"/><circle cx="3.6" cy="3" r="1" fill="#FFCC00"/><circle cx="3.6" cy="3" r=".55" fill="#fff"/></svg>',
  es:'<svg viewBox="0 0 9 6"><rect width="9" height="6" fill="#AA151B"/><rect y="1.5" width="9" height="3" fill="#F1BF00"/></svg>',
  tr:'<svg viewBox="0 0 9 6"><rect width="9" height="6" fill="#E30A17"/><circle cx="3.7" cy="3" r="1.4" fill="#fff"/><circle cx="4.15" cy="3" r="1.12" fill="#E30A17"/><path d="m5.15 3 1.1-.36-.68.93v-1.14l.68.93z" fill="#fff"/></svg>',
  so:'<svg viewBox="0 0 9 6"><rect width="9" height="6" fill="#4189DD"/><path d="M4.5 1.6 5.03 3.23H6.75L5.36 4.24 5.89 5.87 4.5 4.86 3.11 5.87 3.64 4.24 2.25 3.23H3.97z" fill="#fff"/></svg>',
  ar:'<svg viewBox="0 0 24 24" fill="none" stroke="#4b7bec" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>'
};
function loadChat(){ try{ const r=JSON.parse(localStorage.getItem(CHAT_KEY)); if(r) return Object.assign(blankChat(),r); }catch(e){} return blankChat(); }
function saveChat(){ try{ localStorage.setItem(CHAT_KEY,JSON.stringify(chat)); }catch(e){} }
let cbTestLog=[];

function renderChips(id, arr, cls, onRemove, onAdd){
  const w=document.getElementById(id); if(!w) return; w.innerHTML="";
  arr.forEach((t,i)=>{ const c=document.createElement("span"); c.className="src-tag"+(cls==="no"?" no":"");
    c.innerHTML=escHtml(t)+' <span class="x" role="button" aria-label="Retirer">&times;</span>';
    c.querySelector(".x").addEventListener("click",()=>onRemove(i)); w.appendChild(c); });
  const add=document.createElement("span"); add.className="src-tag add"; add.textContent="+ ajouter";
  add.addEventListener("click",()=>onAdd(add)); w.appendChild(add);
}
const CB_IC={
  msg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>',
  globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></svg>',
  drive:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7.7 3.5-6.5 11.3 3.2 5.7 6.6-11.4z"/><path d="M22.8 14.8 16.3 3.5H9.8l6.5 11.3z"/><path d="M4.6 20.5h14.1l3.2-5.7H7.8z"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  open:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2 2m8 8 2 2m0-14-2 2M6 18l2-2"/></svg>'
};
function srcIcon(k){ return k==="url"?CB_IC.globe : k==="drive"?CB_IC.drive : CB_IC.file; }
function cbNf(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g," "); }
function renderCbCards(id, nav){
  const cw=document.getElementById(id); if(!cw) return; cw.innerHTML="";
  const p=CB_PERIODS[cbKey]||CB_PERIODS["30j"];
  const ans=p.q-p.un, rate=Math.round(ans/p.q*100), prevConv=Math.round(p.conv/(1+p.dConv/100));
  const ICOL={purple:["#EEEDFE","#534AB7"],teal:["#E1F5EE","#0F6E56"],amber:["#FBF0DD","#9A6A15"]};
  const tS=(k,v)=>'<div class="tt-row"><span>'+k+'</span><b>'+v+'</b></div>';
  [["Conversations",cbNf(p.conv),"purple",CB_IC.msg,trendChip(p.dConv),"vs "+p.prevR,
    '<div class="tt-h">Conversations</div>'+tS("Sur "+p.curR,cbNf(p.conv))+tS("Période préc. ("+p.prevR+")",cbNf(prevConv))+'<div class="tt-sub">Usage / adoption, pas un indicateur de qualité.</div>',"conversations"],
   ["Taux de réponse",rate+" %","teal",CB_IC.check,trendChip(p.dRate," pts"),ans+" réponses utiles sur "+p.q,
    '<div class="tt-h">Taux de réponse</div>'+tS("Réponses utiles",ans+" / "+p.q)+tS("Restant hors périmètre",p.unScope)+tS("Restant à documenter",p.unKnow)+'<div class="tt-sub">Part des questions où le bot a répondu utilement.</div>',"reponses"],
   ["Questions sans réponse",String(p.un),"amber",CB_IC.warn,'<span class="trend flat">à traiter</span>','<span class="cb-split know"><b>'+p.unKnow+'</b> à documenter</span><span class="cb-split scope">'+p.unScope+' hors périmètre</span>',
    '<div class="tt-h">Questions sans réponse</div>'+tS("Hors périmètre (normal)",p.unScope)+tS("À documenter (action)",p.unKnow)+'<div class="tt-sub">Cliquez pour voir le détail.</div>',"questions"]]
  .forEach(c=>{ const el=document.createElement("div"); el.className="statc tipped"; const col=ICOL[c[2]];
    const openNow = nav && cbOpen===c[7];
    // Statistiques chatbot = démonstration (pas de journalisation réelle des conversations branchée).
    el.innerHTML='<div class="top"><div class="ic-badge" style="background:'+col[0]+';color:'+col[1]+';border-radius:9px">'+c[3]+'</div><span class="ex-tag">exemple</span></div>'+
      '<div class="k">'+c[0]+'</div>'+
      '<div class="v">'+c[1]+'</div>'+
      '<div class="statc-foot">'+
        (c[5]?'<div class="d">'+c[5]+'</div>':'<span class="d"></span>')+
        (nav?'<div class="statc-cta"><span>'+(openNow?"Masquer les détails":"Voir les détails")+'</span><svg class="cta-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>':'')+
      '</div>';
    el._tip=c[6];
    if(nav){ el.dataset.k=c[7]; el.style.cursor="pointer"; el.setAttribute("aria-expanded",openNow?"true":"false");
      const meta=CB_META[c[7]]; el.style.setProperty("--acc",meta.acc); el.style.setProperty("--fill",meta.fill); el.style.setProperty("--stroke",meta.stroke);
      el.addEventListener("click",()=>openCbDrawer(c[7]));
      if(openNow){ el.classList.add("is-open"); } }
    cw.appendChild(el); });
}
/* Tiroir de détail : chaque KPI a son contenu propre (nature + couleur), s'ouvre SOUS la carte cliquée, sans changer de vue */
const CB_META={
  conversations:{tpl:"cbTpl-conversations",title:"Conversations",icon:CB_IC.msg,acc:"#534AB7",bg:"#EEEDFE",fill:"#F7F5FF",stroke:"#EBE5FF",
    val:p=>cbNf(p.conv), trend:p=>trendChip(p.dConv), render:()=>{ renderCbConvChart(); renderCbConvLang(); }},
  reponses:{tpl:"cbTpl-reponses",title:"Taux de réponse",icon:CB_IC.check,acc:"#0F6E56",bg:"#E1F5EE",fill:"#F1FBF8",stroke:"#DBF0E9",
    val:p=>Math.round((p.q-p.un)/p.q*100)+" %", trend:p=>trendChip(p.dRate," pts"), render:()=>{ renderCbChart(); renderCbAnsBar(); }},
  questions:{tpl:"cbTpl-questions",title:"Questions sans réponse",icon:CB_IC.warn,acc:"#9A6A15",bg:"#FBF0DD",fill:"#FDF8EE",stroke:"#F2E7CB",
    val:p=>String(p.un), trend:()=>'<span class="trend flat">à traiter</span>', render:()=>{ renderCbBreakdown(); renderCbUnanswered(); }}
};
let cbOpen=null;
function openCbDrawer(kind){
  if(cbOpen===kind){ closeCbDrawer(); return; }
  const m=CB_META[kind]; if(!m) return;
  cbOpen=kind;
  document.querySelector(".cb-pulse")?.classList.add("tight");
  const p=CB_PERIODS[cbKey]||CB_PERIODS["30j"];
  const d=document.getElementById("cbDrawer"); if(!d) return;
  d.style.setProperty("--acc",m.acc); d.style.setProperty("--acc-bg",m.bg);
  d.style.setProperty("--fill",m.fill); d.style.setProperty("--stroke",m.stroke);
  document.getElementById("cbDrawerIc").innerHTML=m.icon;
  document.getElementById("cbDrawerT").textContent=m.title;
  document.getElementById("cbDrawerV").innerHTML='<span class="dv">'+m.val(p)+'</span>'+m.trend(p);
  const body=document.getElementById("cbDrawerBody"); body.innerHTML="";
  body.appendChild(document.getElementById(m.tpl).content.cloneNode(true));
  d.hidden=false;                 // visible AVANT le render : drawLine a besoin de la largeur du SVG
  m.render();
  renderCbCards("cbPulse", true);  // reflète l'état ouvert (liseré couleur + label "Masquer")
  const rg=document.getElementById("cbRange"); if(rg){ rg.value=cbKey; if(rg._ddSync) rg._ddSync(); }
  d.classList.remove("in"); void d.offsetHeight; d.classList.add("in");
  refreshIcons();
}
function refreshCbDrawer(){ if(!cbOpen) return; const m=CB_META[cbOpen], p=CB_PERIODS[cbKey]||CB_PERIODS["30j"];
  const v=document.getElementById("cbDrawerV"); if(v) v.innerHTML='<span class="dv">'+m.val(p)+'</span>'+m.trend(p);
  m.render(); refreshIcons(); }
function closeCbDrawer(){
  const d=document.getElementById("cbDrawer"); if(!d) return;
  d.classList.remove("in"); d.hidden=true;
  document.querySelector(".cb-pulse")?.classList.remove("tight");
  cbOpen=null; renderCbCards("cbPulse", true);
}
function renderCbAnsBar(){
  const bar=document.getElementById("cbAnsBar"), leg=document.getElementById("cbAnsLeg"); if(!bar||!leg) return;
  const p=CB_PERIODS[cbKey]||CB_PERIODS["30j"]; const ans=p.q-p.un, tot=p.q||1;
  bar.innerHTML=""; leg.innerHTML=""; leg.className="statleg";
  [["Réponses utiles",ans,"#1D9E75"],["Hors périmètre",p.unScope,"#B4B2A9"],["À documenter",p.unKnow,"#E0A83E"]].forEach(d=>{ const pc=Math.round(d[1]/tot*100);
    const seg=document.createElement("div"); seg.className="seg"; seg.style.width=pc+"%"; seg.style.background=d[2]; bar.appendChild(seg);
    const r=document.createElement("div"); r.className="r"; r.innerHTML='<span class="dot" style="background:'+d[2]+'"></span><span class="nm">'+d[0]+'</span><span class="ct">'+d[1]+'</span><span class="pc">'+pc+' %</span>'; leg.appendChild(r); });
}
function renderCbConvChart(){
  const svg=document.getElementById("cbConvChart"); if(!svg) return;
  const p=CB_PERIODS[cbKey]||CB_PERIODS["30j"]; const n=p.chart.labels.length||1;
  const base=p.conv/n; const vals=p.chart.labels.map((_,i)=>Math.round(base*(0.82+0.36*(i/(n>1?n-1:1)))));
  const prev=vals.map(v=>Math.round(v/(1+p.dConv/100)));
  drawLine(svg,p.chart.labels,vals,prev,"Conversations"); wireCbWheel(svg); wireCbZoomBtns("cbConvZoomOut","cbConvZoomIn");
  const badge=document.getElementById("cbConvBadge"); if(badge) badge.innerHTML=trendChip(p.dConv)+' <span style="color:var(--muted)">vs période préc.</span>';
  const leg=document.getElementById("cbConvLeg"); if(leg) leg.innerHTML='<span class="li"><span class="dot" style="background:#6B5BCC"></span><span class="li-k">Conversations</span><span class="li-v">'+cbNf(p.conv)+'</span></span><span class="li"><span class="dot dash" style="background:#c4c9c4"></span><span class="li-k">Période préc.</span></span>';
}
function renderCbConvLang(){
  const data=[["fr",48],["en",17],["pt",10],["ar",8],["de",6],["es",5],["it",3],["tr",2],["so",1]]
    .map(x=>['<span class="flag">'+(FLAG[x[0]]||FLAG.ar)+'</span>'+(LANG_LBL[x[0]]||x[0]), x[1]]);
  renderBars("cbConvLangBars", data, "#6B5BCC"); refreshIcons();
}
function renderCbBreakdown(){
  const total=cbUnanswered.length||1;
  const counts={}; cbUnanswered.forEach(u=>counts[u.lang]=(counts[u.lang]||0)+1);
  const order=["fr","en","de","it","pt","es","tr","so","ar"].filter(l=>counts[l]).sort((a,b)=>counts[b]-counts[a]);
  const data=order.map(l=>['<span class="flag">'+FLAG[l]+'</span>'+(LANG_LBL[l]||l), Math.round(counts[l]/total*100)]);
  renderBars("cbLangBars", data, "#6B5BCC");
  const bar=document.getElementById("cbReasonBar"), leg=document.getElementById("cbReasonLeg");
  if(bar&&leg){ const know=cbUnanswered.filter(u=>u.reason==="knowledge").length, scope=total-know;
    bar.innerHTML=""; leg.innerHTML=""; leg.className="statleg";
    [["À documenter",know,"#E0A83E"],["Hors périmètre",scope,"#B4B2A9"]].forEach(d=>{ const pc=Math.round(d[1]/total*100);
      const seg=document.createElement("div"); seg.className="seg"; seg.style.width=pc+"%"; seg.style.background=d[2]; bar.appendChild(seg);
      const r=document.createElement("div"); r.className="r";
      r.innerHTML='<span class="dot" style="background:'+d[2]+'"></span><span class="nm">'+d[0]+'</span><span class="ct">'+d[1]+'</span><span class="pc">'+pc+' %</span>';
      leg.appendChild(r); }); }
  refreshIcons();
}
/* zoom molette sur les courbes du chatbot : parcourt les périodes (comme la page Rendez-vous) */
const CB_ZOOM=["7j","30j","3m","6m","12m"];
/* source unique de la période : synchronise les 2 sélecteurs (page + tiroir), les cartes et le tiroir */
function setCbPeriod(key){ if(!key) return; cbKey=key;
  ["cbPageRange","cbRange"].forEach(id=>{ const s=document.getElementById(id); if(s){ s.value=cbKey; if(s._ddSync) s._ddSync(); } });
  refreshCbDrawer(); renderCbCards("cbPulse",true); }
function cbZoom(dir){ let i=CB_ZOOM.indexOf(cbKey); if(i<0)i=CB_ZOOM.indexOf("30j"); const ni=Math.min(CB_ZOOM.length-1,Math.max(0,i+dir)); if(ni===i) return;
  setCbPeriod(CB_ZOOM[ni]); }
function wireCbWheel(svg){ if(!svg||svg.dataset.wheel) return; svg.dataset.wheel="1"; let t=0;
  svg.addEventListener("wheel",e=>{ e.preventDefault(); const now=Date.now(); if(now-t<200) return; t=now; cbZoom(e.deltaY>0?1:-1); },{passive:false}); }
/* boutons - / + de zoom sur les courbes du chatbot (meme comportement que la molette et que Rendez-vous) */
function wireCbZoomBtns(outId,inId){ const out=document.getElementById(outId), inn=document.getElementById(inId);
  if(out) out.onclick=()=>cbZoom(1); if(inn) inn.onclick=()=>cbZoom(-1); updateZoomBtns(CB_ZOOM,cbKey,outId,inId); }
function renderCbChart(){
  const svg=document.getElementById("cbChart"); if(!svg) return;
  const p=CB_PERIODS[cbKey]||CB_PERIODS["30j"];
  const prev=p.chart.vals.map(v=>Math.max(0,v-p.dRate));
  drawLine(svg,p.chart.labels,p.chart.vals,prev,"Taux de réponse"); wireCbWheel(svg); wireCbZoomBtns("cbChartZoomOut","cbChartZoomIn");
  const badge=document.getElementById("cbChartBadge"); if(badge) badge.innerHTML=trendChip(p.dRate," pts")+' <span style="color:var(--muted)">vs période préc.</span>';
  const leg=document.getElementById("cbChartLeg"); if(leg) leg.innerHTML='<span class="li"><span class="dot" style="background:#4BB3A4"></span><span class="li-k">Taux de réponse</span><span class="li-v">'+p.chart.vals[p.chart.vals.length-1]+' %</span></span><span class="li"><span class="dot dash" style="background:#c4c9c4"></span><span class="li-k">Période préc.</span></span>';
}
function renderCbUnanswered(){
  const b=document.getElementById("cbUnBody"); if(!b) return; b.innerHTML="";
  const total=cbUnanswered.length, pages=Math.max(1,Math.ceil(total/CB_UN_PER));
  if(cbUnPage>pages) cbUnPage=pages; if(cbUnPage<1) cbUnPage=1;
  const start=(cbUnPage-1)*CB_UN_PER, pageItems=cbUnanswered.slice(start,start+CB_UN_PER);
  const cap=document.getElementById("cbUnCap"); if(cap) cap.textContent=total+" questions à traiter";
  pageItems.forEach((u)=>{ const tr=document.createElement("tr");
    const reason = u.reason==="scope" ? '<span class="rtag scope">Hors périmètre</span>' : '<span class="rtag know">À documenter</span>';
    const act = u.reason==="knowledge" ? '<button class="iconbtn" data-unq="'+escHtml(u.q)+'">'+CB_IC.plus+'Ajouter aux sources</button>' : '<span style="color:var(--muted);font-size:11.5px">rien à faire</span>';
    const fl = FLAG[u.lang] ? '<span class="flag">'+FLAG[u.lang]+'</span>' : '';
    tr.innerHTML='<td><span class="cb-q" title="'+escHtml(u.q)+'">'+escHtml(u.q)+'</span></td>'+
      '<td style="white-space:nowrap"><div class="dt-d">'+u.date+'</div><div class="dt-t">'+u.time+'</div></td>'+
      '<td style="white-space:nowrap"><span class="lang-cell">'+fl+(LANG_LBL[u.lang]||u.lang)+'</span></td>'+
      '<td>'+reason+'</td>'+
      '<td style="white-space:nowrap;text-align:right">'+act+'</td>';
    b.appendChild(tr); });
  b.querySelectorAll("[data-unq]").forEach(bt=>bt.addEventListener("click",()=>openCbAdd({q:bt.dataset.unq})));
  renderCbUnPager(total,pages,start,pageItems.length);
  refreshIcons();
}
function renderCbUnPager(total,pages,start,count){
  const el=document.getElementById("cbUnPager"); if(!el) return;
  if(pages<=1){ el.innerHTML=""; return; }
  const chevL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  const chevR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  const btn=(n,lbl,cls,dis)=>'<button class="pg-btn'+(cls?" "+cls:"")+'" data-cbpg="'+n+'"'+(dis?" disabled":"")+'>'+lbl+'</button>';
  const win=[]; for(let n=1;n<=pages;n++){ if(n===1||n===pages||Math.abs(n-cbUnPage)<=1) win.push(n); }
  let nums="",last=0; win.forEach(n=>{ if(n-last>1) nums+='<span class="pg-ell">…</span>'; nums+=btn(n,String(n),n===cbUnPage?"on":""); last=n; });
  el.innerHTML='<span class="pg-info">'+(start+1)+'–'+(start+count)+' sur '+total+'</span><span class="pg-ctrl">'+btn(cbUnPage-1,chevL,"",cbUnPage<=1)+nums+btn(cbUnPage+1,chevR,"",cbUnPage>=pages)+'</span>';
  el.querySelectorAll(".pg-btn[data-cbpg]").forEach(bt=>{ if(bt.disabled) return; bt.addEventListener("click",()=>{ const n=+bt.dataset.cbpg; if(n>=1&&n<=pages&&n!==cbUnPage){ cbUnPage=n; renderCbUnanswered(); } }); });
}
function renderCbSources(){
  const s=document.getElementById("cbSources"); if(!s) return; s.innerHTML="";
  s.insertAdjacentHTML("beforeend",'<p class="hint" style="margin:0 2px 12px;padding:8px 10px;background:#FBF0DD;border-radius:8px;color:#7A5410;display:flex;gap:8px;align-items:flex-start"><span style="flex-shrink:0">⚠️</span><span>À la publication, le <b>texte</b> de ces sources est inclus dans le contenu public du site (c\'est là que l\'assistant le lit). N\'y mettez pas de données confidentielles (liste clients, tarifs internes, coordonnées…). Un stockage privé sera prévu pour ces cas.</span></p>');
  const cnt=document.getElementById("cbSrcCount"); if(cnt) cnt.textContent=chat.sources.length+" source"+(chat.sources.length>1?"s":"");
  const q=(document.getElementById("cbSrcSearch")?.value||"").toLowerCase().trim();
  const items=chat.sources.map((src,i)=>({src,i})).filter(o=> !q || (o.src.n||"").toLowerCase().includes(q) || (o.src.tags||[]).some(t=>t.toLowerCase().includes(q)));
  if(!items.length){ s.innerHTML='<p class="hint" style="margin:8px 2px 2px">'+(q?"Aucune source ne correspond à « "+escHtml(q)+" ».":"Aucune source pour l'instant.")+'</p>'; return; }
  items.forEach(o=>{ const src=o.src, i=o.i, tags=(src.tags||[]);
    const row=document.createElement("div"); row.className="src-row";
    const tagHtml = tags.length ? tags.map(t=>'<span class="src-tag">'+escHtml(t)+'</span>').join("") : '<span class="src-tag empty">sans tag</span>';
    row.innerHTML='<span class="src-ic">'+srcIcon(src.kind)+'</span>'+
      '<div class="src-main"><span class="src-nm" title="'+escHtml(src.n)+'">'+escHtml(src.n)+'</span><div class="src-tags">'+tagHtml+'</div></div>'+
      '<button class="src-prev" title="Prévisualiser">'+CB_IC.eye+'</button>'+
      '<button class="media-del src-del" title="Retirer">&times;</button>';
    row.querySelector(".src-prev").addEventListener("click",()=>openCbPreview(i));
    row.querySelector(".src-del").addEventListener("click",()=>{ const r=chat.sources.splice(i,1)[0]; bumpBot("Source retirée : « "+r.n+" »"); renderChatbot(); toast("Source retirée · v"+chat.version); });
    s.appendChild(row); });
}
/* Lecteur de fichier (façon pièce jointe) : barre d'outils + pages A4 + zoom + téléchargement, adapté aux gros documents. */
function fvFileType(src){ const ext=(src.ext||(src.n||"").split(".").pop()||"").toLowerCase();
  if(src.kind==="url") return {label:"Page web", ic:"globe", color:"#2F6FE0"};
  if(src.kind==="drive") return {label:"Google Drive", ic:"hard-drive", color:"#0F9D58"};
  const map={ pdf:{label:"Document PDF",ic:"file-text",color:"#CF3B3B"}, docx:{label:"Document Word",ic:"file-text",color:"#2F6FE0"}, doc:{label:"Document Word",ic:"file-text",color:"#2F6FE0"}, txt:{label:"Fichier texte",ic:"file-text",color:"#8a8c89"}, csv:{label:"Tableur CSV",ic:"table",color:"#0F9D58"}, xlsx:{label:"Tableur Excel",ic:"table",color:"#0F9D58"} };
  return map[ext]||{label:"Fichier",ic:"file",color:"#6B5BCC"}; }
function fvPaginate(text){ const paras=(text||"").split(/\n\n+/), pages=[]; let cur=""; const B=560;
  paras.forEach(p=>{ if((cur+p).length>B && cur){ pages.push(cur); cur=""; } cur+=(cur?"\n\n":"")+p; });
  if(cur) pages.push(cur); if(!pages.length) pages.push("(Document vide)"); return pages; }
let _fvZoom=1;
function renderFvPages(src, declaredPages){
  if(src.kind==="url"){ return '<div class="fv-web"><div class="fv-web-bar"><span class="fv-dot"></span><span class="fv-dot"></span><span class="fv-dot"></span><span class="fv-url">'+escHtml(src.url||"chaskis.ch")+'</span></div><div class="fv-web-body">'+escHtml(src.prev||"").replace(/\n/g,"<br>")+'</div></div>'; }
  const pages=fvPaginate(src.prev), total=Math.max(pages.length, declaredPages||0); let h="";
  pages.forEach((p,idx)=>{ h+='<div class="fv-page"><div class="fv-page-body">'+escHtml(p).replace(/\n/g,"<br>")+'</div><div class="fv-pnum">'+(idx+1)+' / '+total+'</div></div>'; });
  if(total>pages.length){ const more=total-pages.length; h+='<div class="fv-page fv-page-more"><div class="fv-more"><i data-lucide="files"></i><div><b>'+more+' autre'+(more>1?"s":"")+' page'+(more>1?"s":"")+'</b><span>L\'aperçu montre le début. Le fichier complet ('+total+' pages) est bien indexé et sert de source au chatbot.</span></div></div><div class="fv-pnum">'+(pages.length+1)+'–'+total+' / '+total+'</div></div>'; }
  return h; }
function openCbPreview(i){ const src=chat.sources[i]; if(!src) return; _fvZoom=1;
  const ft=fvFileType(src), tags=(src.tags||[]).map(t=>'<span class="src-tag">'+escHtml(t)+'</span>').join("")||'<span class="src-tag empty">sans tag</span>';
  const dp=src.pages||0; let meta;
  if(src.kind==="url"){ meta=ft.label+' · '+escHtml(src.url||"chaskis.ch"); }
  else { const parts=[ft.label], pg=Math.max(fvPaginate(src.prev).length, dp); if(pg) parts.push(pg+" page"+(pg>1?"s":"")); if(src.size) parts.push(fmtBytes(src.size)); meta=parts.join(" · "); }
  document.getElementById("cbPrevBody").innerHTML='<div class="fv">'
    +'<div class="fv-bar"><span class="fv-fic" style="background:'+ft.color+'1a;color:'+ft.color+'"><i data-lucide="'+ft.ic+'"></i></span>'
      +'<div class="fv-file"><div class="fv-nm">'+escHtml(src.n)+'</div><div class="fv-meta">'+meta+'</div></div>'
      +'<div class="fv-tools">'+(src.kind==="url"?'':'<div class="fv-zoom"><button class="fv-zb" data-z="-" aria-label="Dézoomer">–</button><span class="fv-zv" id="fvZoomV">100%</span><button class="fv-zb" data-z="+" aria-label="Zoomer">+</button></div>')
        +'<button class="fv-dl" id="fvDl" title="'+(src.kind==="url"?"Ouvrir la page":"Télécharger")+'">'+(src.kind==="url"?'<i data-lucide="external-link"></i>Ouvrir':'<i data-lucide="download"></i>Télécharger')+'</button></div></div>'
    +'<div class="src-tags fv-tags">'+tags+'<span class="fv-status">'+escHtml(src.s||"")+'</span></div>'
    +'<div class="fv-canvas" id="fvCanvas">'+renderFvPages(src, dp)+'</div></div>';
  document.querySelectorAll("#cbPrevBody .fv-zb").forEach(b=>b.addEventListener("click",()=>fvZoom(b.dataset.z)));
  const dl=document.getElementById("fvDl"); if(dl) dl.addEventListener("click",()=>{ if(src.kind==="url"){ try{ window.open(src.url,"_blank"); }catch(e){} } else toast("Téléchargement de « "+src.n+" » (démo)"); });
  document.getElementById("cbPrevModal").classList.add("show"); refreshIcons(); }
function fvZoom(dir){ _fvZoom=Math.max(0.6, Math.min(1.8, _fvZoom+(dir==="+"?0.15:-0.15)));
  const c=document.getElementById("fvCanvas"); if(c) c.style.setProperty("--fvz", _fvZoom);
  const v=document.getElementById("fvZoomV"); if(v) v.textContent=Math.round(_fvZoom*100)+"%"; }
function closeCbPreview(){ document.getElementById("cbPrevModal").classList.remove("show"); }
/* auto-tag : "lecture" du document -> tags proposés (l'utilisateur n'a rien à saisir) */
/* auto-tag : on lit le nom (et l'aperçu si dispo), insensible aux accents, vocabulaire livraison */
function detectTags(name, extra){
  const n=((name||"")+" "+(extra||"")).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,"");
  const out=[];
  [[/tarif|prix|price|cout|devis|montant|chf|facture?ment|abonnement flex/,"Tarifs"],
   [/zone|livrais|deliver|region|secteur|geneve|vaud|lausanne|nyon|morges|riviera|leman|adresse/,"Zones"],
   [/delai|delay|horaire|creneau|jour meme|j\+\d|planning|disponibilit/,"Délais"],
   [/express|urgent|prioritaire|2\s?h|deux heures/,"Express"],
   [/faq|questions?|comment |aide|help|guide/,"FAQ"],
   [/cgv|conditions?|terms|contrat|mentions|legal|rgpd/,"Conditions"],
   [/factur|invoice|tva|vat|paiement|payment|carte|iban|mensuel|remboursement/,"Facturation"],
   [/service|offre|abonnement|flex|dedi|forfait|formule|plan\b/,"Services"],
   [/assur|casse|fragile|garantie|dommage|refriger|perissable/,"Assurance"],
   [/suivi|track|statut|ou est|commande|colis|reception/,"Suivi"],
   [/compte|inscription|connexion|mot de passe|profil|identifiant/,"Compte"],
   [/contact|support|reclamation|joindre|hotline|assistance/,"Contact"]]
    .forEach(m=>{ if(m[0].test(n)&&!out.includes(m[1])) out.push(m[1]); });
  if(!out.length) out.push("Général");
  return out.slice(0,4);
}
function renderTagEditor(id, tags, onChange){
  const w=document.getElementById(id); if(!w) return; w.innerHTML="";
  tags.forEach((t,i)=>{ const c=document.createElement("span"); c.className="src-tag"; c.innerHTML=escHtml(t)+' <span class="x" role="button" aria-label="Retirer">×</span>';
    c.querySelector(".x").addEventListener("click",()=>{ tags.splice(i,1); if(onChange)onChange(); renderTagEditor(id,tags,onChange); }); w.appendChild(c); });
  const inp=document.createElement("input"); inp.className="cb-tag-inp"; inp.placeholder=tags.length?"+ tag":"+ ajouter un tag";
  inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); const v=inp.value.trim(); if(v&&!tags.includes(v)){ tags.push(v); if(onChange)onChange(); renderTagEditor(id,tags,onChange); const ni=w.querySelector(".cb-tag-inp"); if(ni) ni.focus(); } } });
  w.appendChild(inp);
}
/* picker de sujets (périmètre) alimenté par les tags des sources + saisie libre */
function openTagPicker(anchor, existing, onPick){
  closeTagPicker();
  const pool=[...new Set(chat.sources.flatMap(s=>s.tags||[]))].filter(t=>!existing.includes(t));
  const menu=document.createElement("div"); menu.className="tag-picker"; menu.id="tagPicker";
  let html = pool.length ? '<div class="tp-lbl">Depuis vos sources</div>'+pool.map(t=>'<button class="tp-opt" data-t="'+escHtml(t)+'">'+CB_IC.plus+escHtml(t)+'</button>').join('') : '<div class="tp-lbl">Aucun tag de source disponible</div>';
  html += '<div class="tp-sep"></div><input class="tp-inp" placeholder="Autre sujet… (Entrée)">';
  menu.innerHTML=html; document.body.appendChild(menu);
  const r=anchor.getBoundingClientRect(); menu.style.left=r.left+"px"; menu.style.top=(r.bottom+6)+"px";
  requestAnimationFrame(()=>{ const mw=menu.offsetWidth,mh=menu.offsetHeight; if(r.left+mw>innerWidth-8) menu.style.left=Math.max(8,innerWidth-mw-8)+"px"; if(r.bottom+6+mh>innerHeight-8) menu.style.top=Math.max(8,r.top-6-mh)+"px"; });
  menu.querySelectorAll(".tp-opt").forEach(b=>b.addEventListener("click",()=>{ onPick(b.dataset.t); closeTagPicker(); }));
  const inp=menu.querySelector(".tp-inp"); inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ const v=inp.value.trim(); if(v){ onPick(v); closeTagPicker(); } } });
  setTimeout(()=>{ inp.focus(); document.addEventListener("mousedown",tpOutside,true); },0); refreshIcons();
}
function tpOutside(e){ const m=document.getElementById("tagPicker"); if(m&&!m.contains(e.target)) closeTagPicker(); }
function closeTagPicker(){ const m=document.getElementById("tagPicker"); if(m) m.remove(); document.removeEventListener("mousedown",tpOutside,true); }

let cbAddKind="file", cbAddTags=[], cbAddTagsManual=false;
function openCbAdd(pre){ pre=pre||{}; cbAddKind="file";
  cbAddTags = (pre.tags&&pre.tags.length) ? pre.tags.slice() : detectTags(pre.name||"");
  cbAddTagsManual = !!(pre.tags&&pre.tags.length);
  document.querySelectorAll("#cbAddKind button").forEach(b=>b.classList.toggle("on",b.dataset.kind==="file"));
  renderCbAddBody(pre); document.getElementById("cbAddModal").classList.add("show"); }
function closeCbAdd(){ document.getElementById("cbAddModal").classList.remove("show"); }
function renderCbAddBody(pre){
  pre=pre||{}; const body=document.getElementById("cbAddBody"); if(!body) return;
  const cfg = cbAddKind==="url" ? {label:"Adresse de la page",ph:"https://chaskis.ch/tarifs",head:""} :
              cbAddKind==="drive" ? {label:"Document Google Drive",ph:"Nom du document choisi…",head:'<div class="cb-hint-box">'+CB_IC.drive+'<div>Connectez votre Google Drive une fois : vos équipes ajoutent des documents sans repasser par le site.</div></div>'} :
              {label:"Nom du fichier",ph:"conditions-generales.pdf",head:'<div class="cb-drop">'+CB_IC.file+'<div><b>Glissez un fichier</b> ou parcourez<br><span>PDF, DOCX, TXT — 10 Mo max</span></div></div>'};
  body.innerHTML=(cfg.head||'')+
    '<div class="formf"><label>'+cfg.label+'</label><input id="cbAddName" placeholder="'+cfg.ph+'" value="'+escHtml(pre.name||"")+'"></div>'+
    '<div class="cb-autotag"><div class="at-hd">'+CB_IC.sparkle+'Tags détectés automatiquement en lisant le document</div><div class="cb-tag-edit" id="cbAddTags"></div></div>'+
    (pre.q?'<p class="hint" style="margin:10px 0 0">Servira à répondre à : « '+escHtml(pre.q)+' »</p>':'');
  renderTagEditor("cbAddTags", cbAddTags, ()=>{ cbAddTagsManual=true; });
  const nm=document.getElementById("cbAddName");
  if(nm) nm.addEventListener("input",e=>{ if(!cbAddTagsManual){ cbAddTags.length=0; detectTags(e.target.value).forEach(t=>cbAddTags.push(t)); renderTagEditor("cbAddTags", cbAddTags, ()=>{ cbAddTagsManual=true; }); } });
  refreshIcons();
}
function cbAddConfirm(){
  const nm=(document.getElementById("cbAddName").value||"").trim();
  if(!nm){ toast("Indiquez un nom ou un lien"); return; }
  const s = cbAddKind==="url"?"synchronisé":cbAddKind==="drive"?"lié":"en file";
  const prev = cbAddKind==="url"?"Page web synchronisée : "+nm : cbAddKind==="drive"?"Document Google Drive lié : "+nm+"\n(Le contenu est lu directement depuis le Drive.)" : "Aperçu du fichier « "+nm+" » — indexation en cours.";
  chat.sources.push({n:nm,kind:cbAddKind,tags:cbAddTags.slice(),s:s,prev:prev});
  bumpBot("Source ajoutée : « "+nm+" »"+(cbAddTags.length?" (tags : "+cbAddTags.join(", ")+")":""));
  closeCbAdd(); renderChatbot(); toast("Source ajoutée · v"+chat.version);
}
/* version + changelog de l'assistant : chaque amélioration = un bump de patch + une entrée */
function bumpBot(text){
  const p=(chat.version||"1.0.0").split(".").map(n=>parseInt(n,10)||0); p[2]=(p[2]||0)+1;
  chat.version=p.join(".");
  if(!Array.isArray(chat.changelog)) chat.changelog=[];
  chat.changelog.unshift({v:chat.version,date:RDV_TODAY,text:text});
  saveChat();
}
function renderCbVersion(){
  const el=document.getElementById("cbVerChip"); if(!el) return;
  el.innerHTML='<span class="cb-ver-dot"></span>Assistant v'+(chat.version||"1.0.0")+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3.5 2"/></svg>';
}
function openCbLog(){
  const b=document.getElementById("cbLogBody"); if(!b) return;
  const log=chat.changelog||[];
  b.innerHTML='<p class="hint" style="margin:0 0 14px">Version actuelle <b>v'+(chat.version||"1.0.0")+'</b>. Chaque source, changement de périmètre ou correction dans le bac à test crée une entrée.</p>'+
    '<div class="cb-log">'+(log.length?log.map(e=>'<div class="cb-log-e"><span class="cb-log-v">v'+e.v+'</span><div class="cb-log-tx"><div class="cb-log-t">'+escHtml(e.text)+'</div><div class="cb-log-d">'+e.date+'</div></div></div>').join(''):'<p class="hint">Aucune entrée.</p>')+'</div>';
  document.getElementById("cbLogModal").classList.add("show");
}
function closeCbLog(){ document.getElementById("cbLogModal").classList.remove("show"); }
function renderChatbot(){
  renderCbCards("cbPulse", true); renderCbSources();
  renderChips("cbAllowed", chat.allowed, "ok",
    (i)=>{ const r=chat.allowed.splice(i,1)[0]; bumpBot("Sujet autorisé retiré : « "+r+" »"); renderChatbot(); },
    (btn)=>openTagPicker(btn, chat.allowed.concat(chat.forbidden), v=>{ chat.allowed.push(v); bumpBot("Sujet autorisé ajouté : « "+v+" »"); renderChatbot(); }));
  renderChips("cbForbidden", chat.forbidden, "no",
    (i)=>{ const r=chat.forbidden.splice(i,1)[0]; bumpBot("Sujet interdit retiré : « "+r+" »"); renderChatbot(); },
    (btn)=>openTagPicker(btn, chat.allowed.concat(chat.forbidden), v=>{ chat.forbidden.push(v); bumpBot("Sujet interdit ajouté : « "+v+" »"); renderChatbot(); }));
  const tone=document.getElementById("cbTone"); if(tone){ tone.value=chat.tone; if(tone._ddSync) tone._ddSync(); }
  const len=document.getElementById("cbLength"); if(len){ len.value=chat.length; if(len._ddSync) len._ddSync(); }
  const fb=document.getElementById("cbFallback"); if(fb) fb.value=chat.fallback;
  const ins=document.getElementById("cbInstr"); if(ins) ins.value=chat.instr;
  const al=document.getElementById("cbAutoLang"); if(al){ const on=chat.autoLang!==false; al.classList.toggle("on",on); al.setAttribute("aria-checked",on); }
  const dl=document.getElementById("cbDefaultLang"); if(dl){ dl.value=chat.defaultLang||"fr"; if(dl._ddSync) dl._ddSync(); }
  // comportement : identité, relais humain, garde-fous, disponibilité/incertitude
  const setSw=(id,on)=>{ const el=document.getElementById(id); if(el){ el.classList.toggle("on",!!on); el.setAttribute("aria-checked",!!on); } };
  const setSel=(id,v)=>{ const el=document.getElementById(id); if(el){ el.value=v; if(el._ddSync) el._ddSync(); } };
  const bn=document.getElementById("cbBotName"); if(bn) bn.value=chat.botName||"";
  setSel("cbAddress",chat.address||"vous"); setSel("cbEmojiLevel",chat.emojiLevel||"parcimonie");
  setSel("cbEscAfter",String(chat.escalateAfter||2)); setSel("cbEscChannel",chat.escalateChannel||"rdv");
  setSel("cbUncertain",chat.uncertain||"prudent"); setSw("cbOffHours",chat.offHours);
  renderCbVersion();
  if(cbOpen){ document.querySelector(".cb-pulse")?.classList.add("tight"); const d=document.getElementById("cbDrawer"); if(d){ d.hidden=false; d.classList.add("in"); } refreshCbDrawer(); }
  renderCbTest();
}
function renderCbTest(){
  const t=document.getElementById("cbTest"); if(!t) return; t.innerHTML="";
  const clr=document.getElementById("cbTestClear");
  if(!cbTestLog.length){
    if(clr) clr.style.display="none";
    t.innerHTML='<div class="cb-test-empty"><span class="em-ic">'+CB_IC.msg+'</span>'+
      '<p>Testez votre assistant en direct.<br>Posez une question, ou essayez un sujet interdit pour voir le blocage.</p>'+
      '<div class="cb-test-sugg">'+
        ["Vous livrez à Nyon le samedi ?","Quels sont vos tarifs pour Lausanne ?","Donnez-moi vos données clients"].map(q=>'<button class="cb-sugg" data-sugg="'+escHtml(q)+'">'+escHtml(q)+'</button>').join("")+
      '</div></div>';
    t.querySelectorAll("[data-sugg]").forEach(b=>b.addEventListener("click",()=>cbAsk(b.dataset.sugg)));
    return;
  }
  if(clr) clr.style.display="";
  cbTestLog.forEach((m,idx)=>{ const b=document.createElement("div");
    if(m.r==="block"){ b.className="bub block"; b.textContent=m.x; }
    else { b.className="bub "+m.r; b.innerHTML=escHtml(m.x)+(m.src?'<br><span style="font-size:10.5px;color:var(--muted)">source : '+escHtml(m.src)+'</span>':''); }
    t.appendChild(b);
    if(m.r==="a"||m.r==="block") t.appendChild(cbFeedbackEl(m)); });
  t.scrollTop=t.scrollHeight;
}
const THUMB_UP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11M2 13v6a2 2 0 0 0 2 2h13.3a2 2 0 0 0 2-1.7l1.3-8A2 2 0 0 0 18 9h-5V5a2 2 0 0 0-2-2l-4 7"/></svg>';
const THUMB_DOWN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V3M22 11V5a2 2 0 0 0-2-2H6.7a2 2 0 0 0-2 1.7l-1.3 8A2 2 0 0 0 5.4 15H11v4a2 2 0 0 0 2 2l4-7"/></svg>';
let cbRegenN=0;
function cbGenAnswer(q){ const v=["(réponse régénérée) Voici une autre formulation à partir des sources indexées.","(réponse régénérée) D'après vos documents, je peux le dire autrement.","(réponse régénérée) Reformulation en m'appuyant sur les sources disponibles."]; return v[(cbRegenN++)%v.length]; }
function cbFeedbackEl(m){
  const w=document.createElement("div"); w.className="cb-fb";
  if(m.fb==="up"){ w.classList.add("ok"); w.innerHTML=CB_IC.check+'Réponse validée'; return w; }
  if(m.fb!=="down"){
    w.innerHTML='<span class="cb-fb-q">Cette réponse convient&nbsp;?</span><button class="cb-fb-b up" data-a="up" title="Oui">'+THUMB_UP+'</button><button class="cb-fb-b" data-a="down" title="Non">'+THUMB_DOWN+'</button>';
    w.querySelector('[data-a="up"]').addEventListener("click",()=>{ m.fb="up"; bumpBot("Réponse validée dans le bac à test."); renderCbTest(); renderCbVersion(); toast("Validé · v"+chat.version); });
    w.querySelector('[data-a="down"]').addEventListener("click",()=>{ m.fb="down"; renderCbTest(); });
    return w;
  }
  if(m.correcting){
    w.classList.add("correcting");
    w.innerHTML='<div class="cb-fb-q">Quelle aurait été la bonne réponse ? Elle rejoindra les connaissances.</div><textarea class="cb-fb-ta" placeholder="La bonne réponse…">'+escHtml(m.draft||"")+'</textarea><div class="cb-fb-acts"><button class="btn ghost" data-a="cancel">Annuler</button><button class="btn primary" data-a="save">Enregistrer et apprendre</button></div>';
    const ta=w.querySelector(".cb-fb-ta");
    ta.addEventListener("input",()=>m.draft=ta.value);
    w.querySelector('[data-a="cancel"]').addEventListener("click",()=>{ m.correcting=false; renderCbTest(); });
    w.querySelector('[data-a="save"]').addEventListener("click",()=>{ const v=ta.value.trim(); if(!v){ toast("Écrivez la bonne réponse"); return; }
      chat.sources.push({n:"Correction : "+(m.q||"réponse").slice(0,42),kind:"file",tags:detectTags(m.q||""),s:"appris",prev:"Question : "+(m.q||"")+"\n\nBonne réponse : "+v});
      bumpBot("Correction apprise pour « "+(m.q||"…")+" ».");
      m.fb="up"; m.correcting=false; m.draft=""; m.x=v; m.src="correction apprise"; renderChatbot(); toast("Appris · v"+chat.version); });
    return w;
  }
  w.classList.add("down");
  w.innerHTML='<span class="cb-fb-q">Réponse à revoir.</span><button class="cb-fb-b2" data-a="regen">'+CB_IC.sparkle+'Régénérer</button><button class="cb-fb-b2" data-a="correct">'+CB_IC.plus+'Corriger</button>';
  w.querySelector('[data-a="regen"]').addEventListener("click",()=>{ m.x=cbGenAnswer(m.q); m.src="sources"; m.fb=null; renderCbTest(); });
  w.querySelector('[data-a="correct"]').addEventListener("click",()=>{ m.correcting=true; renderCbTest(); });
  return w;
}
function cbAsk(q){
  q=(q||"").trim(); if(!q) return;
  cbTestLog.push({r:"u",x:q});
  const split=s=>s.toLowerCase().split(/[^a-zàâäéèêëïîôöùûüç0-9]+/).filter(w=>w.length>=4);
  const words=split(q);
  const hit=chat.forbidden.find(f=> split(f).some(fw=> words.includes(fw)));
  if(hit) cbTestLog.push({r:"block",x:"Sujet « "+hit+" » hors périmètre → "+chat.fallback,q:q});
  else {
    const scoreOf=s=>{ const hay=((s.n||"")+" "+((Array.isArray(s.tags)?s.tags:[]).join(" "))+" "+(s.prev||"")).toLowerCase(); return words.reduce((n,w)=>n+(hay.indexOf(w)>=0?1:0),0); };
    let best=null, bestScore=0;
    (chat.sources||[]).forEach(s=>{ const sc=scoreOf(s); if(sc>bestScore){ bestScore=sc; best=s; } });
    if(best){ const snip=(best.prev||"").replace(/\s+/g," ").trim().slice(0,180); cbTestLog.push({r:"a",x:"D'après cette source : "+(snip||"(cette source n'a pas encore d'extrait)"),src:best.n,q:q}); }
    else cbTestLog.push({r:"a",x:(chat.fallback||"Je n'ai pas trouvé de réponse dans les sources configurées."),src:"repli",q:q});
  }
  renderCbTest();
}
(function wireChatbot(){
  const CB_RANGE_LBL={"7j":"7 derniers jours","30j":"30 derniers jours","3m":"3 derniers mois","6m":"6 derniers mois","12m":"12 derniers mois"};
  const rg=document.getElementById("cbRange"); if(rg){ rg.addEventListener("change",e=>setCbPeriod(e.target.value)); enhanceSelect(rg); }
  const pr=document.getElementById("cbPageRange"); if(pr){ pr.addEventListener("change",e=>setCbPeriod(e.target.value)); enhanceSelect(pr); }
  const dx=document.getElementById("cbDrawerX"); if(dx) dx.addEventListener("click",closeCbDrawer);
  const add=document.getElementById("cbAddSource"); if(add) add.addEventListener("click",()=>openCbAdd());
  const ssearch=document.getElementById("cbSrcSearch"); if(ssearch) ssearch.addEventListener("input",renderCbSources);
  // modale d'ajout de source
  document.getElementById("cbAddClose").addEventListener("click",closeCbAdd);
  document.getElementById("cbAddCancel").addEventListener("click",closeCbAdd);
  document.getElementById("cbAddModal").addEventListener("click",e=>{ if(e.target.id==="cbAddModal") closeCbAdd(); });
  document.getElementById("cbAddConfirm").addEventListener("click",cbAddConfirm);
  document.getElementById("cbAddKind").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; cbAddKind=b.dataset.kind; document.querySelectorAll("#cbAddKind button").forEach(x=>x.classList.toggle("on",x===b)); renderCbAddBody(); });
  // modale de prévisualisation
  document.getElementById("cbPrevClose").addEventListener("click",closeCbPreview);
  document.getElementById("cbPrevModal").addEventListener("click",e=>{ if(e.target.id==="cbPrevModal") closeCbPreview(); });
  // version + changelog
  const vc=document.getElementById("cbVerChip"); if(vc) vc.addEventListener("click",openCbLog);
  document.getElementById("cbLogClose").addEventListener("click",closeCbLog);
  document.getElementById("cbLogModal").addEventListener("click",e=>{ if(e.target.id==="cbLogModal") closeCbLog(); });
  // Performance : bouton d'analyse (ébauche)
  const prun=document.getElementById("perfRun"); if(prun) prun.addEventListener("click",()=>{ perfAnalyzeReal(); });
  const chC=document.getElementById("contentHealth"); if(chC) chC.addEventListener("click",()=>showView("perf"));
  // Affiliation : ajout / édition / suppression de restaurants
  const aAdd=document.getElementById("affilAdd"); if(aAdd) aAdd.addEventListener("click",()=>openAffilModal(null));
  const aClose=document.getElementById("affilClose"); if(aClose) aClose.addEventListener("click",closeAffilModal);
  const aCancel=document.getElementById("affilCancel"); if(aCancel) aCancel.addEventListener("click",closeAffilModal);
  const aSave=document.getElementById("affilSave"); if(aSave) aSave.addEventListener("click",saveAffilForm);
  const aModal=document.getElementById("affilModal"); if(aModal) aModal.addEventListener("click",e=>{ if(e.target.id==="affilModal") closeAffilModal(); });
  const aType=document.getElementById("affilAdvType"); if(aType){ aType.addEventListener("change",syncAffilAdv); enhanceSelect(aType); }
  const aCat=document.getElementById("affilCat"); if(aCat) aCat.addEventListener("change",e=>{ if(e.target.value==="__new__") showAffilNewCat(); else affilPrevCat=e.target.value; });
  const aNcOk=document.getElementById("affilNewCatOk"); if(aNcOk) aNcOk.addEventListener("click",confirmAffilNewCat);
  const aNcC=document.getElementById("affilNewCatCancel"); if(aNcC) aNcC.addEventListener("click",cancelAffilNewCat);
  const aNcI=document.getElementById("affilNewCatInput"); if(aNcI) aNcI.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); confirmAffilNewCat(); } else if(e.key==="Escape"){ e.preventDefault(); cancelAffilNewCat(); } });
  const aSearch=document.getElementById("affilSearch"); if(aSearch) aSearch.addEventListener("input",e=>{ affilSearch=e.target.value; affilPage=1; renderAffiliation(); });
  // Jeux concours : création / édition / suppression
  const cAdd=document.getElementById("contestAdd"); if(cAdd) cAdd.addEventListener("click",()=>openContestModal(null));
  const cClose=document.getElementById("contestClose"); if(cClose) cClose.addEventListener("click",closeContestModal);
  const cCancel=document.getElementById("contestCancel"); if(cCancel) cCancel.addEventListener("click",closeContestModal);
  const cSave=document.getElementById("contestSave"); if(cSave) cSave.addEventListener("click",saveContestForm);
  const cModal=document.getElementById("contestModal"); if(cModal) cModal.addEventListener("click",e=>{ if(e.target.id==="contestModal") closeContestModal(); });
  const cKind=document.getElementById("contestKind"); if(cKind) enhanceSelect(cKind);
  const cStatus=document.getElementById("contestStatus"); if(cStatus) enhanceSelect(cStatus);
  // Copilote RDV
  const copC=document.getElementById("copCompany"); if(copC) copC.addEventListener("input",e=>{ copState.company=e.target.value; copSave(); renderCopRecap(); renderCopProgress(); });
  const copCt=document.getElementById("copContact"); if(copCt) copCt.addEventListener("input",e=>{ copState.contact=e.target.value; copSave(); renderCopRecap(); });
  const copEm=document.getElementById("copEmail"); if(copEm) copEm.addEventListener("input",e=>{ copState.email=e.target.value.trim(); copSave(); });
  const copN=document.getElementById("copNotes"); if(copN) copN.addEventListener("input",e=>{ copState.notes=e.target.value; copSave(); renderCopRecap(); });
  const copRz=document.getElementById("copReset"); if(copRz) copRz.addEventListener("click",()=>{ if(!confirm("Démarrer un nouveau RDV ? Les infos en cours seront effacées.")) return; copState=copBlank(); copSave(); renderCopilot(); toast("Nouveau RDV"); });
  const copCp=document.getElementById("copCopy"); if(copCp) copCp.addEventListener("click",()=>{ const t=copRecapText(); if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(()=>toast("Compte-rendu copié"),()=>toast("Copie indisponible")); } else toast("Copie indisponible"); });
  const copF=document.getElementById("copFinish"); if(copF) copF.addEventListener("click",()=>{
    if(!copHasWork()){ toast("Rien à enregistrer : renseignez d'abord le rendez-vous."); return; } /* anti-doublon / clic à vide */
    copSave();
    const txt=copRecapText();
    let hist=[]; try{ hist=JSON.parse(localStorage.getItem("chaskis_copilot_hist"))||[]; }catch(e){}
    hist.unshift({ date:new Date().toISOString(), company:(copState.company||""), recap:txt, rdvKey:copState.rdvKey||"" });
    try{ localStorage.setItem("chaskis_copilot_hist", JSON.stringify(hist.slice(0,50))); }catch(e){}
    downloadRecapText(txt, copState.company);
    // SORTIE du workflow : si le copilote est lié à un RDV, on y RATTACHE le compte-rendu (visible
    // dans le tiroir du RDV) et on propose de le marquer « honoré ».
    let attached=false;
    if(copState.rdvKey && typeof rdvData!=="undefined" && Array.isArray(rdvData)){
      const idx=rdvData.findIndex(r=>rdvStableKey(r)===copState.rdvKey);
      if(idx>=0){
        const now=new Date().toISOString();
        const patch={ compteRendu:txt, compteRenduAt:now };
        if(confirm("Marquer ce rendez-vous comme « honoré » ?")) patch.st="honore";
        Object.assign(rdvData[idx], patch);
        // persistance selon le VRAI mode (rdvLiveOn), pas la présence de calendlyUri : sinon un RDV
        // live sans uri passerait par saveRdv() (no-op en live) -> compte-rendu perdu à la re-synchro.
        if(rdvLiveOn) saveRdvOverride(rdvData[idx].calendlyUri||rdvStableKey(rdvData[idx]), patch);
        else saveRdv();
        attached=true;
        if(typeof updateDashboard==="function") updateDashboard();
      }
    }
    // Réinitialise le copilote (comme « Nouveau RDV ») : évite les doublons au re-clic et prépare
    // le prochain prospect. Le compte-rendu reste consultable (historique + fiche RDV + .txt).
    copState=copBlank(); copSave();
    renderCopilot();
    toast(attached?"RDV terminé : compte-rendu rattaché au rendez-vous, téléchargé et archivé.":"RDV terminé : compte-rendu téléchargé et archivé.");
  });
  // Utilisateurs & accès
  const uAdd=document.getElementById("usrAdd"); if(uAdd) uAdd.addEventListener("click",()=>openUsrModal(null));
  const uClose=document.getElementById("usrClose"); if(uClose) uClose.addEventListener("click",closeUsrModal);
  const uCancel=document.getElementById("usrCancel"); if(uCancel) uCancel.addEventListener("click",closeUsrModal);
  const uSave=document.getElementById("usrSave"); if(uSave) uSave.addEventListener("click",saveUsrForm);
  const uModal=document.getElementById("usrModal"); if(uModal) uModal.addEventListener("click",e=>{ if(e.target.id==="usrModal") closeUsrModal(); });
  const uRole=document.getElementById("usrRole"); if(uRole){ enhanceSelect(uRole); uRole.addEventListener("change",renderUsrOvSection); }
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ if(cbOpen && !document.querySelector(".modal-bg.show")) closeCbDrawer(); closeCbAdd(); closeCbPreview(); closeCbLog(); closeAffilModal(); closeUsrModal(); } });
  // langue : s'adapte au visiteur + langue par défaut
  const alg=document.getElementById("cbAutoLang"); if(alg) alg.addEventListener("click",()=>{ chat.autoLang=!(chat.autoLang!==false); const on=chat.autoLang; alg.classList.toggle("on",on); alg.setAttribute("aria-checked",on); saveChat(); });
  const dlg=document.getElementById("cbDefaultLang"); if(dlg){ dlg.addEventListener("change",e=>{ chat.defaultLang=e.target.value; saveChat(); }); enhanceSelect(dlg); }
  const t=document.getElementById("cbTone"); if(t){ t.addEventListener("change",e=>{ chat.tone=e.target.value; saveChat(); }); enhanceSelect(t); }
  const l=document.getElementById("cbLength"); if(l){ l.addEventListener("change",e=>{ chat.length=e.target.value; saveChat(); }); enhanceSelect(l); }
  const fb=document.getElementById("cbFallback"); if(fb) fb.addEventListener("input",e=>{ chat.fallback=e.target.value; saveChat(); });
  const ins=document.getElementById("cbInstr"); if(ins) ins.addEventListener("input",e=>{ chat.instr=e.target.value; saveChat(); });
  // comportement : identité / relais humain / garde-fous / disponibilité
  const bn=document.getElementById("cbBotName"); if(bn) bn.addEventListener("input",e=>{ chat.botName=e.target.value; saveChat(); });
  const oh=document.getElementById("cbOffHours"); if(oh) oh.addEventListener("click",()=>{ chat.offHours=!chat.offHours; oh.classList.toggle("on",chat.offHours); oh.setAttribute("aria-checked",chat.offHours); saveChat(); });
  [["cbAddress","address"],["cbEmojiLevel","emojiLevel"],["cbEscAfter","escalateAfter"],["cbEscChannel","escalateChannel"],["cbUncertain","uncertain"]].forEach(pair=>{
    const el=document.getElementById(pair[0]); if(!el) return;
    el.addEventListener("change",e=>{ chat[pair[1]]= pair[1]==="escalateAfter"?parseInt(e.target.value,10):e.target.value; saveChat(); }); enhanceSelect(el);
  });
  document.querySelectorAll("#view-chatbot .cb-acc-hd").forEach(h=>h.addEventListener("click",()=>h.parentElement.classList.toggle("open")));
  const clr=document.getElementById("cbTestClear"); if(clr) clr.addEventListener("click",()=>{ cbTestLog=[]; renderCbTest(); });
  const send=document.getElementById("cbSend"); if(send) send.addEventListener("click",()=>{ const i=document.getElementById("cbInput"); cbAsk(i.value); i.value=""; });
  const inp=document.getElementById("cbInput"); if(inp) inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ cbAsk(e.target.value); e.target.value=""; } });
})();

/* ============================================================
   Clients — hub commercial (agrège RDV + demandes ; relie les comptes-rendus)
   ============================================================
   La liste est DÉRIVÉE de sources déjà partagées : les rendez-vous (Calendly en direct ou démo) et
   les demandes reçues (/api/crm). Tous les commerciaux voient donc les mêmes clients. L'enrichissement
   PARTAGÉ (statut/prochaine étape saisis à la main) viendra dans un incrément suivant. Repli : sans
   demandes chargées, les clients proviennent des RDV -> démo intacte. */
var cliLeads=[], cliQuery="", cliFilter="all", cliLeadsLoaded=false, cliCurrentList=[], cliPage=1, cliEnrich={};
var CLI_PER_PAGE=25;
var cliSel=new Set();       // sélection multiple (par c.key stable) pour actions groupées — cf. rdvSel
var cliCurrentShown=[];     // clients affichés (filtrés, toutes pages) au dernier rendu — pour « tout sélectionner »
// Filtres avancés de la MODALE (le contenu de la fenêtre Filtres). Contrôles scalables : listes
// MULTI (arrays) recherchables pour commercial/secteur, plage de dates du/au précise, + critères métier.
var cliFilterAdv={who:[],secteur:[],offer:[],statut:[],dateFrom:"",dateTo:"",aRelancer:false,rdvAVenir:false,sansCommercial:false,avecCr:false};
function cliFilterEmpty(){ return {who:[],secteur:[],offer:[],statut:[],dateFrom:"",dateTo:"",aRelancer:false,rdvAVenir:false,sansCommercial:false,avecCr:false}; }
function cliFilterCount(){ var f=cliFilterAdv; return f.who.length+f.secteur.length+f.offer.length+f.statut.length+((f.dateFrom||f.dateTo)?1:0)+(f.aRelancer?1:0)+(f.rdvAVenir?1:0)+(f.sansCommercial?1:0)+(f.avecCr?1:0); }
// Raccourcis de plage : renvoient une date de DÉBUT (la fin reste ouverte). Non bloquants (on peut aussi saisir du/au).
function cliISO(dt){ if(!dt) return ""; var m=dt.getMonth()+1,d=dt.getDate(); return dt.getFullYear()+"-"+(m<10?"0"+m:m)+"-"+(d<10?"0"+d:d); }
function cliDatePresetFrom(p){ var day=86400000; if(p==="30j") return cliISO(new Date(Date.now()-30*day)); if(p==="3m") return cliISO(new Date(Date.now()-90*day)); if(p==="year"){ var n=new Date(); return cliISO(new Date(n.getFullYear(),0,1)); } return ""; }
var CLI_DATE_PRESETS=[["30j","30 derniers jours"],["3m","3 derniers mois"],["year","Cette année"]];
// « À relancer » : pas de relance depuis 14 j (ou jamais), hors clients actifs / sans suite.
function cliNeedsFollowUp(c){ var en=c.enrich||{}; var st=(c.status&&c.status.k)||""; if(st==="active"||st==="lost") return false; var lr=en.lastRelanceAt?Date.parse(en.lastRelanceAt):0; return !lr || (Date.now()-lr)>14*86400000; }
// Statut manuel (enrichissement partagé) : override le statut dérivé. {k,lbl,c} comme cliStatus().
// Table des statuts Clients — MÊME modèle que RDV_STC (couleur texte + FOND CLAIR net + point) pour
// des tags colorés identiques à la page Rendez-vous (fini le blanc).
var CLI_STC={
  lead:{l:"Nouveau lead",c:"#9A6A15",bg:"#FBF0DD",solid:"#C7891B"},
  rdv:{l:"RDV planifié",c:"#185FA5",bg:"#E6F1FB",solid:"#378ADD"},
  seen:{l:"Rencontré",c:"#0F6E56",bg:"#E1F5EE",solid:"#1D9E75"},
  discussion:{l:"En discussion",c:"#2F6FE0",bg:"#E9F0FC",solid:"#2F6FE0"},
  devis:{l:"Devis envoyé",c:"#534AB7",bg:"#EEEDFE",solid:"#6B5BCC"},
  active:{l:"Client actif",c:"#0F6E56",bg:"#E1F5EE",solid:"#1D9E75"},
  lost:{l:"Sans suite",c:"#6B6E6A",bg:"#EEEFEE",solid:"#9A9C98"},
  other:{l:"À traiter",c:"#6B6E6A",bg:"#EEEFEE",solid:"#9A9C98"}
};
// enhanceSelect consulte RDV_STC puis CLI_STC AU MOMENT DU CLIC (runtime) : couleur commune RDV+Clients
// sans dépendre de l'ordre de déclaration (pas de fusion au chargement -> pas de zone morte temporelle).
function stcOf(v){ try{ if(RDV_STC && RDV_STC[v]) return RDV_STC[v]; }catch(e){} if(typeof CLI_STC!=="undefined" && CLI_STC[v]) return CLI_STC[v]; return null; }
function cliStat(k){ var s=CLI_STC[k]||CLI_STC.other; return { k:k, lbl:s.l, c:s.c, bg:s.bg }; }
// Statuts « manuels » choisissables (le pipeline commercial), dérivés de CLI_STC.
var CLI_STATUS_MANUAL={}; ["lead","discussion","devis","active","lost"].forEach(function(k){ CLI_STATUS_MANUAL[k]=cliStat(k); });
var CLI_STATUS_OPTS=[["","(automatique)"],["lead","Nouveau lead"],["discussion","En discussion"],["devis","Devis envoyé"],["active","Client actif"],["lost","Sans suite"]];
var CLI_OFFER_OPTS=[["","(aucune)"],["flex","Flex"],["express","Express"],["dedie","Dédié"]];
var GENERIC_MAIL=/^(gmail|hotmail|outlook|yahoo|icloud|live|msn|bluewin|gmx|proton|protonmail|orange|wanadoo|free)\./;
function cliNormKey(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,""); }
function cliMailDomain(e){ var m=/@(.+)$/.exec(String(e||"").trim().toLowerCase()); return m?m[1]:""; }
/* Clé d'identité : entreprise normalisée si connue, sinon domaine e-mail pro, sinon e-mail, sinon contact.
   Regroupe les RDV et demandes d'une même entreprise sous un seul client. */
function cliKeyFor(o){
  var co=cliNormKey(o.company||o.client); if(co) return "co:"+co;
  var d=cliMailDomain(o.email); if(d && !GENERIC_MAIL.test(d)) return "dom:"+d;
  var e=String(o.email||"").trim().toLowerCase(); if(e) return "em:"+e;
  var ct=cliNormKey(o.contact); if(ct) return "ct:"+ct;
  return "";
}
function cliStatus(c){
  var st=c.rdvs.map(function(r){return r.st;});
  if(st.indexOf("avenir")>=0) return cliStat("rdv");
  if(st.indexOf("honore")>=0) return cliStat("seen");
  if(c.sources.lead && !c.rdvs.length) return cliStat("lead");
  if(st.indexOf("refuse")>=0||st.indexOf("noshow")>=0||st.indexOf("annule")>=0) return cliStat("lost");
  return cliStat("other");
}
// Jeu de DÉMO stable pour la page Clients (projection commerciale). Découplé de Calendly : il reste
// affiché tant qu'AUCUNE vraie donnée n'existe (pas de RDV live non vide, pas de vraie demande) et
// disparaît dès que le réel arrive. Reprend les entreprises du seed RDV -> navigation RDV<->Client
// cohérente. À RETIRER le jour où de vraies données alimentent la page (comme les autres démos).
function cliDemoSources(){
  var D=function(n){ return Date.now()-n*86400000; };
  var rdv=[
    {client:"Boucherie Dubois",contact:"Pierre Dubois",tel:"+41 22 311 22 09",email:"contact@boucherie-dubois.ch",secteur:"Restauration",day:"2",mon:"juil.",time:"10:00",sujet:"Découverte",who:"Sarah",mode:"tel",st:"avenir",ts:D(1)},
    {client:"Pharmacie du Lac",contact:"Claire Fontaine",tel:"+41 22 736 44 10",email:"accueil@pharmaciedulac.ch",secteur:"Médical / Pharma",day:"2",mon:"juil.",time:"15:00",sujet:"Mise en place Flex",who:"Marc",mode:"tel",st:"avenir",ts:D(1)},
    {client:"Atelier Vélo Plus",contact:"Thomas Girard",email:"hello@atelierveloplus.ch",secteur:"E-commerce / Retail",day:"4",mon:"juil.",time:"09:00",sujet:"Devis Dédié",who:"Sarah",mode:"visio",st:"avenir",ts:D(0)},
    {client:"Café des Bains",contact:"Sofia Marchetti",tel:"+41 22 321 57 30",email:"resa@cafedesbains.ch",secteur:"Restauration",day:"7",mon:"juil.",time:"11:00",sujet:"Découverte",who:"Marc",mode:"tel",st:"avenir",ts:D(2)},
    {client:"Cabinet Morand",contact:"Antoine Morand",email:"contact@cabinet-morand.ch",secteur:"Juridique / Notarial",day:"28",mon:"juin",time:"11:00",sujet:"Découverte",who:"Sarah",mode:"visio",st:"honore",ts:D(6),compteRendu:"Découverte : étude notariale, envois d'actes urgents en centre-ville.\nBesoin : coursier fiable 3x/semaine.\nOffre chiffrée : Flex — 240 CHF/mois.\nProchaine étape : relance après validation de l'associé.",compteRenduAt:new Date(D(6)).toISOString()},
    {client:"Restaurant Sole",contact:"Luca Bianchi",tel:"+41 22 738 16 24",email:"info@restaurant-sole.ch",secteur:"Restauration",day:"27",mon:"juin",time:"15:30",sujet:"Suivi mensuel",who:"Marc",mode:"tel",st:"honore",ts:D(7),compteRendu:"Client satisfait du service, volumes en hausse.\nDécision : passage de Flex à Dédié dès le mois prochain.",compteRenduAt:new Date(D(7)).toISOString()},
    {client:"Fleuriste Camélia",contact:"Nadia Berger",tel:"+41 22 344 28 71",email:"bonjour@camelia-fleurs.ch",secteur:"E-commerce / Retail",day:"26",mon:"juin",time:"16:00",sujet:"Question tarifs",who:"Sarah",mode:"tel",st:"refuse",ts:D(8)},
    {client:"Établissements Vermeulen-Delacroix & Fils",contact:"Marie-Alexandra de Montmollin",email:"contact@vermeulen-delacroix.ch",secteur:"Luxe / Bijouterie",day:"24",mon:"juin",time:"14:00",sujet:"Renouvellement Dédié",who:"Jean-Christophe",mode:"visio",st:"honore",ts:D(10),compteRendu:"Renouvellement du contrat Dédié à l'ordre du jour.\nInterlocutrice favorable ; décision attendue au prochain comité de direction.",compteRenduAt:new Date(D(10)).toISOString()}
  ];
  var leads=[
    {company:"Traiteur Belleville",contact:"Yannis Roux",email:"contact@traiteur-belleville.ch",phone:"+41 22 900 11 22",summary:"Voiture · Planifié · 3 arrêts · ~120 CHF",source:"commander",receivedAt:new Date(D(0)).toISOString()},
    {company:"Studio Photo Lumen",contact:"Inès Caron",email:"hello@studiolumen.ch",phone:"",summary:"Vélo · Express · 1 arrêt · ~22 CHF",source:"commander",receivedAt:new Date(D(3)).toISOString()}
  ];
  var enrich={
    "co:cabinetmorand":{status:"devis",offer:"",nextStep:"Relancer après validation de l'associé"},
    "co:restaurantsole":{status:"active",offer:"dedie",nextStep:""},
    "co:etablissementsvermeulendelacroixfils":{status:"discussion",offer:"dedie",nextStep:"Attendre le comité de direction"},
    "co:boucheriedubois":{status:"discussion",offer:"",nextStep:"Envoyer le devis Flex"},
    "co:cafedesbains":{status:"active",offer:"flex",nextStep:""}
  };
  return { rdv:rdv, leads:leads, enrich:enrich };
}
function cliBuildIndex(){
  var idx=new Map();
  function ensure(key,name){ if(!idx.has(key)) idx.set(key,{key:key,name:name||"",contacts:[],emails:[],phones:[],secteur:"",rdvs:[],recaps:[],leads:[],sources:{},owners:[],lastTs:0}); var c=idx.get(key); if(name && name.length>(c.name||"").length) c.name=name; return c; }
  function add(arr,v){ v=(v||"").trim(); if(v && arr.indexOf(v)<0) arr.push(v); }
  // Réel dès qu'il existe une VRAIE donnée (RDV live non vide OU vraie demande) ; sinon DÉMO stable.
  // L'enrichissement saisi (cliEnrich) prime toujours, même sur la démo -> un changement de statut est visible.
  var hasReal=(typeof rdvLiveOn!=="undefined" && rdvLiveOn && typeof rdvData!=="undefined" && Array.isArray(rdvData) && rdvData.length>0) || (cliLeads&&cliLeads.length>0);
  var dem=hasReal?null:cliDemoSources();
  var rdvSrc=hasReal?(typeof rdvData!=="undefined"&&Array.isArray(rdvData)?rdvData:[]):dem.rdv;
  var leadSrc=hasReal?(cliLeads||[]):dem.leads;
  var enrichSrc=hasReal?cliEnrich:Object.assign({}, dem.enrich, cliEnrich);
  rdvSrc.forEach(function(r){
    var key=cliKeyFor({company:r.client,email:r.email,contact:r.contact}); if(!key) return;
    var c=ensure(key,r.client); add(c.contacts,r.contact); add(c.emails,r.email); add(c.phones,r.tel);
    if(r.secteur&&!c.secteur) c.secteur=r.secteur; c.rdvs.push(r); c.sources.rdv=true;
    if(r.who && c.owners.indexOf(r.who)<0) c.owners.push(r.who);  // commercial(aux) ayant vu ce client
    if(r.compteRendu) c.recaps.push({at:r.compteRenduAt,text:r.compteRendu,rdv:r});
    if((r.ts||0)>c.lastTs) c.lastTs=r.ts||0;
  });
  leadSrc.forEach(function(l){
    var key=cliKeyFor({company:l.company,email:l.email,contact:l.contact}); if(!key) return;
    var c=ensure(key,l.company); add(c.contacts,l.contact); add(c.emails,l.email); add(c.phones,l.phone);
    c.leads.push(l); c.sources.lead=true; var ts=Date.parse(l.receivedAt)||0; if(ts>c.lastTs) c.lastTs=ts;
  });
  var list=Array.from(idx.values());
  list.forEach(function(c){ if(!c.name) c.name=c.contacts[0]||c.emails[0]||"Client"; c.status=cliStatus(c); c.statusDerived=c.status; // statut déduit des RDV, conservé pour l'option « automatique »
    var en=enrichSrc[c.key]; if(en){ c.enrich=en; c.nextStep=en.nextStep||""; c.offer=en.offer||""; if(en.status && CLI_STATUS_MANUAL[en.status]) c.status=CLI_STATUS_MANUAL[en.status]; } });
  list.sort(function(a,b){ return (b.lastTs-a.lastTs) || a.name.localeCompare(b.name); });
  return list;
}
function cliMatch(c,q){ if(!q) return true; q=q.toLowerCase();
  return (c.name||"").toLowerCase().indexOf(q)>=0 || c.contacts.join(" ").toLowerCase().indexOf(q)>=0
    || c.emails.join(" ").toLowerCase().indexOf(q)>=0 || (c.secteur||"").toLowerCase().indexOf(q)>=0; }
var CLI_FILTERS=[["all","Tous"],["lead","Nouveaux leads"],["rdv","RDV planifié"],["seen","Rencontrés"],["active","Clients actifs"],["lost","Sans suite"]];
function renderClients(){
  var list=cliBuildIndex(); cliCurrentList=list;
  var total=list.length, nLead=list.filter(function(c){return c.status.k==="lead";}).length, nRdv=list.filter(function(c){return c.status.k==="rdv";}).length, nCr=list.reduce(function(s,c){return s+c.recaps.length;},0);
  var sr=document.getElementById("cliStats");
  if(sr){ sr.style.gridTemplateColumns="repeat(4,1fr)"; sr.innerHTML=[["Clients & prospects",total,"contact-round","teal"],["Nouveaux leads",nLead,"inbox","amber"],["RDV planifiés",nRdv,"calendar","blue"],["Comptes-rendus",nCr,"file-text","purple"]].map(function(t){ var bc=DASH_ICOL[t[3]]||DASH_ICOL.teal; return '<div class="statc"><div class="top"><div class="ic-badge" style="background:'+bc[0]+';color:'+bc[1]+';border-radius:9px"><i data-lucide="'+t[2]+'"></i></div></div><div class="k">'+t[0]+'</div><div class="v">'+t[1]+'</div></div>'; }).join(""); }
  var fw=document.getElementById("cliFilters");
  if(fw){ fw.innerHTML=CLI_FILTERS.map(function(f){ var n=f[0]==="all"?total:list.filter(function(c){return c.status.k===f[0];}).length; return '<button type="button" class="cli-fbtn'+(cliFilter===f[0]?" on":"")+'" data-f="'+f[0]+'">'+f[1]+'<span class="cli-fn">'+n+'</span></button>'; }).join("");
    fw.querySelectorAll("[data-f]").forEach(function(b){ b.addEventListener("click",function(){ cliFilter=b.dataset.f; cliPage=1; cliSel.clear(); renderClients(); }); }); }
  var shown=list.filter(function(c){ return cliMatch(c,cliQuery) && (cliFilter==="all"||c.status.k===cliFilter)
    && (!cliFilterAdv.who.length || (c.owners||[]).some(function(w){return cliFilterAdv.who.indexOf(w)>=0;}))
    && (!cliFilterAdv.secteur.length || cliFilterAdv.secteur.indexOf(c.secteur)>=0)
    && (!cliFilterAdv.offer.length || cliFilterAdv.offer.indexOf(c.offer)>=0)
    && (!cliFilterAdv.statut.length || cliFilterAdv.statut.indexOf((c.status&&c.status.k)||"")>=0)
    && (!cliFilterAdv.dateFrom || ((c.lastTs||0) >= Date.parse(cliFilterAdv.dateFrom)))
    && (!cliFilterAdv.dateTo || ((c.lastTs||0) <= Date.parse(cliFilterAdv.dateTo)+86399999))
    && (!cliFilterAdv.aRelancer || cliNeedsFollowUp(c))
    && (!cliFilterAdv.rdvAVenir || (c.rdvs||[]).some(function(r){return r.st==="avenir";}))
    && (!cliFilterAdv.sansCommercial || !((c.owners||[]).length))
    && (!cliFilterAdv.avecCr || (c.recaps||[]).length>0); });
  cliCurrentShown=shown;
  var b=document.getElementById("cliBody"); if(!b) return; b.innerHTML="";
  var pages=Math.max(1,Math.ceil(shown.length/CLI_PER_PAGE)); if(cliPage>pages) cliPage=pages; if(cliPage<1) cliPage=1;
  var start=(cliPage-1)*CLI_PER_PAGE, pageItems=shown.slice(start,start+CLI_PER_PAGE);
  if(!shown.length){ var tre=document.createElement("tr"); tre.innerHTML='<td colspan="9" style="color:var(--muted);padding:16px">'+(list.length?"Aucun client ne correspond à cette recherche.":"Aucun client pour l'instant. Ils apparaîtront depuis les rendez-vous et les demandes reçues.")+'</td>'; b.appendChild(tre); }
  pageItems.forEach(function(c){
    var tr=document.createElement("tr"); tr.className="rdv-row";
    var last=c.lastTs?new Date(c.lastTs).toLocaleDateString("fr-CH",{day:"2-digit",month:"short",year:"numeric"}):"—";
    var stVal=(c.enrich&&c.enrich.status)?c.enrich.status:"";
    var deriv=c.statusDerived||c.status;
    // Statut = tag ÉDITABLE (composant .statusel de Rendez-vous). Option vide = statut déduit des RDV (sans préfixe « Auto »).
    var stOpts='<option value="">'+escHtml(deriv.lbl)+'</option>'+Object.keys(CLI_STATUS_MANUAL).map(function(k){ return '<option value="'+k+'"'+(k===stVal?" selected":"")+'>'+CLI_STATUS_MANUAL[k].lbl+'</option>'; }).join("");
    var owners=c.owners||[];
    var comHtml=owners.length ? '<div class="cli-owners">'+owners.slice(0,3).map(function(w){ var cc=commercialChip(w); return '<span class="avatar xs" style="background:'+cc.color+';color:#fff" title="'+escAttr(cc.full)+'">'+cc.ini+'</span>'; }).join("")+(owners.length>3?'<span class="cli-owmore">+'+(owners.length-3)+'</span>':'')+'</div>' : '<span style="color:var(--muted)">—</span>';
    var hasCr=c.recaps.length>0;
    tr.innerHTML='<td class="chk"><input type="checkbox" class="rsel"'+(cliSel.has(c.key)?" checked":"")+'></td>'
      +'<td><div class="cl-co" title="'+escAttr(c.name)+'">'+escHtml(c.name)+'</div>'+(c.contacts[0]?'<div class="cl-ct">'+escHtml(c.contacts[0])+'</div>':'')+'</td>'
      +'<td>'+escHtml(c.secteur||"—")+'</td>'
      +'<td><select class="statusel cli-stsel" data-k="'+escAttr(c.key)+'" data-stc-bg="'+c.status.bg+'" data-stc-color="'+c.status.c+'">'+stOpts+'</select></td>'
      +'<td>'+comHtml+'</td>'
      +'<td style="text-align:center">'+(c.rdvs.length||'<span style="color:var(--muted)">—</span>')+'</td>'
      +'<td style="text-align:center">'+(hasCr?'<button type="button" class="cli-crn" data-act="cr" title="Voir les comptes-rendus">'+c.recaps.length+'</button>':'<span style="color:var(--muted)">—</span>')+'</td>'
      +'<td style="white-space:nowrap;color:var(--ink-soft)">'+escHtml(last)+'</td>'
      +'<td><div class="cli-actions">'
        +'<button class="iconbtn" data-act="cop" title="Lancer le rendez-vous"><i data-lucide="compass"></i></button>'
        +'<button class="iconbtn" data-act="relance" title="Relancer par e-mail"><i data-lucide="mail"></i></button>'
        +'<button class="iconbtn" data-act="fiche" title="Ouvrir la fiche client"><i data-lucide="arrow-right"></i></button>'
      +'</div></td>';
    tr.addEventListener("click",function(){ openClientCard(c.key); });
    var sel=tr.querySelector(".cli-stsel"); if(sel){ sel.addEventListener("click",function(e){e.stopPropagation();}); sel.addEventListener("change",function(e){ e.stopPropagation(); saveClientStatusInline(c.key, sel.value); }); if(typeof enhanceSelect==="function") enhanceSelect(sel); }
    var cb=tr.querySelector(".rsel"); if(cb){ cb.addEventListener("click",function(e){ e.stopPropagation(); }); cb.addEventListener("change",function(e){ if(e.target.checked) cliSel.add(c.key); else cliSel.delete(c.key); cliSyncSelUI(); }); }
    tr.querySelectorAll("[data-act]").forEach(function(bt){ bt.addEventListener("click",function(e){ e.stopPropagation(); var a=bt.dataset.act; if(a==="cop") prepareCopilotForClient(c.key); else if(a==="relance") cliRelance(c.key); else openClientCard(c.key); }); });
    b.appendChild(tr);
  });
  cliRenderPager(shown.length,pages,start,pageItems.length);
  var s=document.getElementById("cliSearch"); if(s && !s.dataset.wired){ s.dataset.wired="1"; s.addEventListener("input",function(){ cliQuery=s.value||""; cliPage=1; cliSel.clear(); renderClients(); }); }
  var pp=document.getElementById("cliPerPage"); if(pp && !pp.dataset.wired){ pp.dataset.wired="1"; pp.addEventListener("change",function(){ CLI_PER_PAGE=parseInt(pp.value,10)||25; cliPage=1; renderClients(); }); if(typeof enhanceSelect==="function") enhanceSelect(pp); }
  var fb=document.getElementById("cliFilterBtn"); if(fb && !fb.dataset.wired){ fb.dataset.wired="1"; fb.addEventListener("click",openCliFilters); }
  var sa=document.getElementById("cliSelAll"); if(sa && !sa.dataset.wired){ sa.dataset.wired="1"; sa.addEventListener("change",function(){ if(sa.checked) cliCurrentShown.forEach(function(c){ cliSel.add(c.key); }); else cliCurrentShown.forEach(function(c){ cliSel.delete(c.key); }); renderClients(); }); }
  cliSyncSelUI();
  syncCliFilterBtn();
  refreshIcons();
  if(!cliLeadsLoaded) loadClientLeads();
}
function cliRenderPager(total,pages,start,count){
  var el=document.getElementById("cliPager"); if(!el) return;
  if(!total){ el.innerHTML=""; return; }   // pagination visible dès qu'il y a des clients (même sur une seule page)
  var chevL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  var chevR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  var mk=function(n,lbl,cls,dis){ return '<button class="pg-btn'+(cls?" "+cls:"")+'" data-pg="'+n+'"'+(dis?" disabled":"")+'>'+lbl+'</button>'; };
  var win=[]; for(var n=1;n<=pages;n++){ if(n===1||n===pages||Math.abs(n-cliPage)<=1) win.push(n); }
  var nums="",lastN=0; win.forEach(function(k){ if(k-lastN>1) nums+='<span class="pg-ell">…</span>'; nums+=mk(k,String(k),k===cliPage?"on":""); lastN=k; });
  el.innerHTML='<span class="pg-info">'+(start+1)+'–'+(start+count)+' sur '+total+' client'+(total>1?"s":"")+'</span><span class="pg-ctrl">'+mk(cliPage-1,chevL,"",cliPage<=1)+nums+mk(cliPage+1,chevR,"",cliPage>=pages)+'</span>';
  el.querySelectorAll(".pg-btn[data-pg]").forEach(function(bt){ if(bt.disabled) return; bt.addEventListener("click",function(){ var k=+bt.dataset.pg; if(k>=1&&k<=pages&&k!==cliPage){ cliPage=k; renderClients(); } }); });
}
/* ---- sélection multiple : barre d'actions groupées (réutilise .bulk-bar / .chk / .rsel de Rendez-vous) ---- */
// Met à jour la barre groupée + l'état de la case « tout sélectionner », SANS re-render complet (cf. renderRdvBulk).
function cliSyncSelUI(){
  renderCliBulk();
  var sa=document.getElementById("cliSelAll"); if(!sa) return;
  var sh=cliCurrentShown||[];
  var allSel=sh.length>0 && sh.every(function(c){ return cliSel.has(c.key); });
  sa.checked=allSel;
  sa.indeterminate=!allSel && sh.some(function(c){ return cliSel.has(c.key); });
}
function renderCliBulk(){
  var el=document.getElementById("cliBulk"); if(!el) return;
  var n=cliSel.size;
  if(!n){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="";
  var stOpts='<option value="__" disabled selected>Changer le statut…</option>'
    +Object.keys(CLI_STATUS_MANUAL).map(function(k){ return '<option value="'+k+'">'+escHtml(CLI_STC[k].l)+'</option>'; }).join("")
    +'<option value="">Automatique (déduit)</option>';
  el.innerHTML='<span class="lbl"><b>'+n+'</b> client'+(n>1?"s":"")+' sélectionné'+(n>1?"s":"")+'</span><span class="sp"></span>'
    +'<select class="rangesel cli-bulk-st" id="cliBulkStatus" aria-label="Changer le statut de la sélection">'+stOpts+'</select>'
    +'<button class="btn ghost" id="cliBulkClear">Tout désélectionner</button>'
    +'<button class="btn primary" id="cliBulkRel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Relancer la sélection</button>';
  el.querySelector("#cliBulkStatus").addEventListener("change",function(e){ var v=e.target.value; if(v==="__") return; cliBulkStatus(v); });
  el.querySelector("#cliBulkClear").onclick=function(){ cliSel.clear(); renderClients(); };
  el.querySelector("#cliBulkRel").onclick=cliBulkRelance;
}
// Statut en lot : même mécanique que saveClientStatusInline (optimiste local + POST /api/crm?kind=client par client).
// La sélection est CONSERVÉE (on peut enchaîner une autre action) ; « Tout désélectionner » reste explicite.
async function cliBulkStatus(status){
  var keys=Array.from(cliSel); if(!keys.length) return;
  keys.forEach(function(key){ var en=cliEnrich[key]||{}; cliEnrich[key]=Object.assign({}, en, { key:key, status:status }); });
  renderClients();                                    // visible tout de suite (même sur la démo)
  var label=(status && CLI_STC[status]) ? CLI_STC[status].l : "automatique";
  var pubkey=getStoredPublishKey();
  if(!pubkey){ toast(keys.length+" statut"+(keys.length>1?"s":"")+" modifié"+(keys.length>1?"s":"")+" (local) → "+label+" — connectez-vous pour partager."); return; }
  var ok=0;
  await Promise.all(keys.map(function(key){
    return fetch("/api/crm?kind=client",{method:"POST",headers:{Authorization:"Bearer "+pubkey,"Content-Type":"application/json"},body:JSON.stringify(cliEnrichPayload(key,{status:status}))})
      .then(function(r){ if(r.ok){ ok++; return r.json().then(function(j){ if(j&&j.client) cliEnrich[key]=j.client; }).catch(function(){}); } })
      .catch(function(){});
  }));
  toast(ok+"/"+keys.length+" statut"+(keys.length>1?"s":"")+" enregistré"+(keys.length>1?"s":"")+" (partagé) → "+label);
}
// Relance en lot : ouvre UN brouillon e-mail avec tous les destinataires en copie cachée (Cci) —
// respecte la vie privée (les prospects ne se voient pas entre eux) et reste une action réelle (comme cliRelance mono).
function cliBulkRelance(){
  var keys=Array.from(cliSel); var emails=[], noMail=0;
  keys.forEach(function(key){ var c=(cliCurrentList||[]).find(function(x){ return x.key===key; }); if(!c) return; var em=c.emails&&c.emails[0]; if(!em){ noMail++; return; } if(emails.indexOf(em)<0) emails.push(em); });
  if(!emails.length){ toast("Aucun e-mail parmi la sélection pour envoyer une relance."); return; }
  var subj=encodeURIComponent("Chaskis — suite à notre échange");
  var body=encodeURIComponent("Bonjour,\n\nJe me permets de revenir vers vous concernant votre projet de livraison avec Chaskis.\n\nBien à vous,");
  try{ window.location.href="mailto:?bcc="+encodeURIComponent(emails.join(","))+"&subject="+subj+"&body="+body; }catch(e){}
  var msg=emails.length+" destinataire"+(emails.length>1?"s":"")+" en copie cachée";
  if(noMail) msg+=" · "+noMail+" sans e-mail ignoré"+(noMail>1?"s":"");
  toast("Brouillon de relance ouvert ("+msg+")");
}
async function loadClientLeads(){
  cliLeadsLoaded=true;
  var key=getStoredPublishKey(); if(!key) return;              // non connecté -> liste dérivée des RDV (démo intacte)
  try{
    var res=await Promise.all([
      fetch("/api/crm?days=120",{headers:{Authorization:"Bearer "+key}}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch("/api/crm?kind=clients",{headers:{Authorization:"Bearer "+key}}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]);
    var changed=false;
    if(res[0]&&Array.isArray(res[0].leads)){ cliLeads=res[0].leads; changed=true; }
    if(res[1]&&Array.isArray(res[1].clients)){ cliEnrich={}; res[1].clients.forEach(function(e){ if(e&&e.key) cliEnrich[e.key]=e; }); changed=true; }
    if(changed){ var v=document.getElementById("view-clients"); if(v&&v.classList.contains("on")) renderClients(); }
  }catch(e){ /* silencieux : liste dérivée des RDV / démo intacte */ }
}
// Section « Suivi commercial » (enrichissement partagé) de la fiche client.
function cliSuiviHtml(c){
  var en=c.enrich||{};
  var opt=function(list,val){ return list.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===val?' selected':'')+'>'+o[1]+'</option>'; }).join(""); };
  return '<div class="cli-sec-h">Suivi commercial <span class="hint" style="margin:0;font-weight:400">partagé entre commerciaux</span></div>'
    +'<div class="cli-suivi">'
    +'<label class="cli-fld"><span>Statut</span><select class="statusel" id="cliStatusSel">'+opt(CLI_STATUS_OPTS,en.status||"")+'</select></label>'
    +'<label class="cli-fld"><span>Offre souscrite</span><select class="statusel" id="cliOfferSel">'+opt(CLI_OFFER_OPTS,en.offer||"")+'</select></label>'
    +'<label class="cli-fld cli-fld-full"><span>Prochaine étape</span><input class="dInput" id="cliNextStep" value="'+escAttr(en.nextStep||"")+'" placeholder="ex. Rappeler mardi, envoyer le devis…" maxlength="160"></label>'
    +'<button class="btn primary sm" id="cliSaveSuivi"><i data-lucide="save"></i>Enregistrer le suivi</button>'
    +'</div>';
}
async function saveClientSuivi(key, ov){
  var pubkey=getStoredPublishKey();
  if(!pubkey){ toast("Connectez-vous pour enregistrer le suivi partagé."); return; }
  var g=function(id){ var el=ov.querySelector("#"+id); return el?(el.value||""):""; };
  var payload=cliEnrichPayload(key,{ status:g("cliStatusSel"), offer:g("cliOfferSel"), nextStep:g("cliNextStep") });
  try{
    var r=await fetch("/api/crm?kind=client",{method:"POST",headers:{Authorization:"Bearer "+pubkey,"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(r.status===401||r.status===403){ toast("Droits insuffisants pour modifier un client."); return; }
    var j=await r.json();
    if(j&&j.ok&&j.saved){ cliEnrich[key]=j.client||payload; toast("Suivi enregistré (partagé)"); var x=ov.querySelector(".thm-x"); if(x) x.click(); if(document.getElementById("view-clients").classList.contains("on")) renderClients(); }
    else toast("Enregistrement impossible : "+((j&&j.error)||"stockage indisponible"));
  }catch(e){ toast("Enregistrement impossible (réseau)"); }
}
// Changement de statut EN 1 CLIC depuis le tableau (colonne Statut éditable). Optimiste + partagé.
async function saveClientStatusInline(key, status){
  var en=cliEnrich[key]||{};
  cliEnrich[key]=Object.assign({}, en, { key:key, status:status });   // visible tout de suite (même sur la démo)
  renderClients();
  var pubkey=getStoredPublishKey();
  if(!pubkey){ toast("Statut modifié (local) — connectez-vous pour le partager."); return; }
  try{
    var r=await fetch("/api/crm?kind=client",{method:"POST",headers:{Authorization:"Bearer "+pubkey,"Content-Type":"application/json"},body:JSON.stringify(cliEnrichPayload(key,{status:status}))});
    if(r.ok){ var j=await r.json(); if(j&&j.client) cliEnrich[key]=j.client; toast("Statut enregistré (partagé)"); }
    else if(r.status===401||r.status===403) toast("Droits insuffisants pour modifier ce client.");
  }catch(e){ /* silencieux : le changement local reste affiché */ }
}
// Relance : ouvre un e-mail pré-rempli au contact du client (action directe depuis le tableau/la fiche).
// Relance depuis le tableau : on ouvre la FICHE sur le panneau de relance (édition + modèles dans l'interface),
// plutôt qu'un mailto « brut » (demande d'Alexandre : relancer depuis l'interface, avec options pratiques).
function cliRelance(key){ openClientCard(key, { relance:true }); }
function syncCliFilterBtn(){ var fb=document.getElementById("cliFilterBtn"); if(!fb) return; var n=cliFilterCount(); fb.classList.toggle("on",n>0); var lbl=fb.querySelector(".cli-fltn"); if(n){ if(!lbl){ lbl=document.createElement("span"); lbl.className="cli-fltn"; fb.appendChild(lbl); } lbl.textContent=n; } else if(lbl){ lbl.remove(); } }
// Fenêtre « Filtres » (même mécanisme centré) — CONTENU scalable : listes recherchables à cocher pour
// commercial/secteur (tiennent à 10+/15+), plage de dates du/au précise, chips multi bornées (statut/offre),
// raccourcis métier. Édition sur une copie `pend`, validée par Appliquer.
var CLI_STATUS_FILTER=["lead","rdv","seen","discussion","devis","active","lost"];
function openCliFilters(){
  var list=cliCurrentList||[]; var whos={}, secs={};
  list.forEach(function(c){ (c.owners||[]).forEach(function(w){ whos[w]=1; }); if(c.secteur) secs[c.secteur]=1; });
  var pend={ who:cliFilterAdv.who.slice(), secteur:cliFilterAdv.secteur.slice(), offer:cliFilterAdv.offer.slice(), statut:cliFilterAdv.statut.slice(), dateFrom:cliFilterAdv.dateFrom, dateTo:cliFilterAdv.dateTo, aRelancer:!!cliFilterAdv.aRelancer, rdvAVenir:!!cliFilterAdv.rdvAVenir, sansCommercial:!!cliFilterAdv.sansCommercial, avecCr:!!cliFilterAdv.avecCr };
  var loupe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
  var togB=function(k,label,ic){ return '<button type="button" class="cli-chip'+(pend[k]?" on":"")+'" data-tog="'+k+'"><i data-lucide="'+ic+'"></i>'+label+'</button>'; };
  var togChips=togB("aRelancer","À relancer","bell")+togB("rdvAVenir","RDV à venir","calendar-clock")+togB("sansCommercial","Sans commercial","user-x")+togB("avecCr","Avec compte-rendu","file-text");
  var statChips=CLI_STATUS_FILTER.map(function(k){ return '<button type="button" class="cli-chip'+(pend.statut.indexOf(k)>=0?" on":"")+'" data-multi="statut" data-val="'+k+'">'+escHtml((CLI_STC[k]||{}).l||k)+'</button>'; }).join("");
  var offChips=CLI_OFFER_OPTS.filter(function(o){return o[0];}).map(function(o){ return '<button type="button" class="cli-chip'+(pend.offer.indexOf(o[0])>=0?" on":"")+'" data-multi="offer" data-val="'+escAttr(o[0])+'">'+escHtml(o[1])+'</button>'; }).join("");
  function checklist(field,opts,avatar){ if(!opts.length) return '<div class="cli-mrow" style="color:var(--muted);cursor:default">Aucune valeur</div>'; return opts.map(function(o){ var av=avatar?'<span class="avatar xs" style="background:'+o.color+';color:#fff">'+o.ini+'</span>':''; return '<label class="cli-mrow" data-lab="'+escAttr(o.lab.toLowerCase())+'"><input type="checkbox" data-multi="'+field+'" value="'+escAttr(o.val)+'"'+(pend[field].indexOf(o.val)>=0?" checked":"")+'>'+av+'<span>'+escHtml(o.lab)+'</span></label>'; }).join(""); }
  var whoOpts=Object.keys(whos).sort().map(function(w){ var cc=commercialChip(w); return {val:w,lab:w,color:cc.color,ini:cc.ini}; });
  var secOpts=Object.keys(secs).sort().map(function(s){ return {val:s,lab:s}; });
  var presetChips=CLI_DATE_PRESETS.map(function(p){ return '<button type="button" class="cli-chip sm" data-preset="'+p[0]+'">'+escHtml(p[1])+'</button>'; }).join("")+'<button type="button" class="cli-chip sm" data-preset="clear">Effacer</button>';
  var ov=document.createElement("div"); ov.className="thm-ov"; ov.id="cliFiltOv";
  ov.innerHTML='<div class="thm-card" style="max-width:520px" role="dialog" aria-modal="true"><button class="thm-x" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
    +'<div class="cli-d-name" style="margin:0 30px 16px 0">Filtrer les clients</div>'
    +'<div class="cli-flt-grp"><span class="lbl">Vues rapides</span><div class="cli-chips">'+togChips+'</div></div>'
    +'<div class="cli-flt-grp"><span class="lbl">Statut</span><div class="cli-chips">'+statChips+'</div></div>'
    +'<div class="cli-flt-grp"><span class="lbl">Dernière activité</span><div class="cli-drow"><span>du</span><input type="date" id="fltFrom" value="'+escAttr(pend.dateFrom)+'"><span>au</span><input type="date" id="fltTo" value="'+escAttr(pend.dateTo)+'"></div><div class="cli-chips">'+presetChips+'</div></div>'
    +'<div class="cli-flt-grp cli-mgrp"><span class="lbl">Commercial</span><div class="cli-msearch">'+loupe+'<input type="search" placeholder="Rechercher un commercial…"></div><div class="cli-checklist">'+checklist("who",whoOpts,true)+'</div></div>'
    +'<div class="cli-flt-grp cli-mgrp"><span class="lbl">Secteur</span><div class="cli-msearch">'+loupe+'<input type="search" placeholder="Rechercher un secteur…"></div><div class="cli-checklist">'+checklist("secteur",secOpts,false)+'</div></div>'
    +'<div class="cli-flt-grp"><span class="lbl">Offre souscrite</span><div class="cli-chips">'+offChips+'</div></div>'
    +'<div class="cli-flt-actions"><button class="btn ghost" id="fltReset">Tout réinitialiser</button><button class="btn primary" id="fltApply">Appliquer</button></div>'
    +'</div>';
  document.body.appendChild(ov);
  function close(){ ov.remove(); document.removeEventListener("keydown",esc); }
  function esc(e){ if(e.key==="Escape") close(); }
  ov.querySelector(".thm-x").addEventListener("click",close);
  ov.addEventListener("mousedown",function(e){ if(e.target===ov) close(); });
  document.addEventListener("keydown",esc);
  ov.querySelectorAll("[data-tog]").forEach(function(b){ b.addEventListener("click",function(){ var k=b.getAttribute("data-tog"); pend[k]=!pend[k]; b.classList.toggle("on",pend[k]); }); });
  ov.querySelectorAll(".cli-chip[data-multi][data-val]").forEach(function(b){ b.addEventListener("click",function(){ var g=b.getAttribute("data-multi"), v=b.getAttribute("data-val"); var i=pend[g].indexOf(v); if(i>=0) pend[g].splice(i,1); else pend[g].push(v); b.classList.toggle("on",pend[g].indexOf(v)>=0); }); });
  ov.querySelectorAll(".cli-checklist input[type=checkbox]").forEach(function(cb){ cb.addEventListener("change",function(){ var g=cb.getAttribute("data-multi"), v=cb.value, i=pend[g].indexOf(v); if(cb.checked && i<0) pend[g].push(v); else if(!cb.checked && i>=0) pend[g].splice(i,1); }); });
  ov.querySelectorAll(".cli-mgrp").forEach(function(grp){ var si=grp.querySelector(".cli-msearch input"); if(!si) return; si.addEventListener("input",function(){ var q=si.value.toLowerCase(); grp.querySelectorAll(".cli-mrow").forEach(function(row){ if(!row.hasAttribute("data-lab")) return; row.style.display=(row.getAttribute("data-lab").indexOf(q)>=0)?"":"none"; }); }); });
  var ff=ov.querySelector("#fltFrom"), ft=ov.querySelector("#fltTo");
  ff.addEventListener("change",function(){ pend.dateFrom=ff.value; }); ft.addEventListener("change",function(){ pend.dateTo=ft.value; });
  ov.querySelectorAll("[data-preset]").forEach(function(b){ b.addEventListener("click",function(){ var p=b.getAttribute("data-preset"); if(p==="clear"){ pend.dateFrom=""; pend.dateTo=""; } else { pend.dateFrom=cliDatePresetFrom(p); pend.dateTo=""; } ff.value=pend.dateFrom; ft.value=pend.dateTo; }); });
  ov.querySelector("#fltApply").addEventListener("click",function(){ cliFilterAdv={ who:pend.who, secteur:pend.secteur, offer:pend.offer, statut:pend.statut, dateFrom:pend.dateFrom, dateTo:pend.dateTo, aRelancer:pend.aRelancer, rdvAVenir:pend.rdvAVenir, sansCommercial:pend.sansCommercial, avecCr:pend.avecCr }; cliPage=1; cliSel.clear(); close(); renderClients(); });
  ov.querySelector("#fltReset").addEventListener("click",function(){ cliFilterAdv=cliFilterEmpty(); cliPage=1; cliSel.clear(); close(); renderClients(); });
  refreshIcons();
}
// Modèles de relance e-mail (éditables dans la fiche) contextualisés au client.
function cliRelanceTemplates(c){
  var contact=(c.contacts&&c.contacts[0])||"";
  var hi="Bonjour"+(contact?" "+contact.split(/\s+/)[0]:"")+",";
  var o=(c.enrich&&c.enrich.offer)||c.offer||""; var of=CLI_OFFER_OPTS.filter(function(x){return x[0]===o;})[0]; var offerLbl=(of&&o)?of[1]:"";
  return [
    {label:"Après le rendez-vous", subject:"Chaskis — suite à notre rendez-vous", body:hi+"\n\nMerci pour le temps que vous m'avez accordé lors de notre échange. Comme convenu, je reste à votre disposition pour avancer sur votre projet de livraison avec Chaskis.\n\nBien à vous,"},
    {label:"Relancer le devis", subject:"Chaskis — votre offre"+(offerLbl?" "+offerLbl:""), body:hi+"\n\nJe reviens vers vous concernant l'offre"+(offerLbl?" "+offerLbl:"")+" que je vous ai transmise. Avez-vous pu en prendre connaissance ? Je reste disponible pour en discuter ou l'ajuster.\n\nBien à vous,"},
    {label:"Reprendre contact", subject:"Chaskis — reprise de contact", body:hi+"\n\nSans nouvelle de votre part, je me permets de revenir vers vous concernant votre projet de livraison. Souhaitez-vous que nous en reparlions ?\n\nBien à vous,"},
    {label:"Proposer un rendez-vous", subject:"Chaskis — proposition d'échange", body:hi+"\n\nSeriez-vous disponible pour un court échange afin de découvrir comment Chaskis peut vous accompagner sur vos livraisons ? Je m'adapte à vos disponibilités.\n\nBien à vous,"}
  ];
}
// Payload d'enrichissement COMPLET : préserve tous les champs (le POST écrase l'objet clients/<clé>, donc ne jamais
// omettre un champ existant sous peine de l'effacer — ex. lastRelanceAt lors d'un simple changement de statut).
function cliEnrichPayload(key, over){ var en=cliEnrich[key]||{}; return Object.assign({ key:key, status:en.status||"", offer:en.offer||"", nextStep:en.nextStep||"", lastRelanceAt:en.lastRelanceAt||"", lastRelanceKind:en.lastRelanceKind||"" }, over||{}); }
// Enregistre une relance (horodatée aujourd'hui) : local d'abord (démo), partagé si connecté ; MAJ en place de la fiche.
async function saveClientRelance(key, kind, ov){
  var now=new Date().toISOString();
  var en=cliEnrich[key]||{}; cliEnrich[key]=Object.assign({}, en, { key:key, lastRelanceAt:now, lastRelanceKind:kind||"" });
  var d=""; try{ d=new Date(now).toLocaleDateString("fr-CH",{day:"2-digit",month:"short",year:"numeric"}); }catch(e){}
  if(ov){ var k=ov.querySelector("#cliKpiRel"); if(k){ k.textContent=d; k.className="cli-kpi-v sub"; } }
  toast("Relance enregistrée"+(kind?" — "+kind:"")+(d?" ("+d+")":""));
  var pubkey=getStoredPublishKey(); if(!pubkey) return;   // démo : déjà reflété localement
  try{ await fetch("/api/crm?kind=client",{method:"POST",headers:{Authorization:"Bearer "+pubkey,"Content-Type":"application/json"},body:JSON.stringify(cliEnrichPayload(key,{lastRelanceAt:now,lastRelanceKind:kind||""}))}); }catch(e){}
}
function openClientCard(key, opts){
  opts=opts||{};
  var c=cliCurrentList.find(function(x){return x.key===key;});
  if(!c){ cliCurrentList=cliBuildIndex(); c=cliCurrentList.find(function(x){return x.key===key;}); } // robuste : ouvrable depuis une autre page (fiche RDV)
  if(!c) return;
  var en=c.enrich||{};
  var mailBtns=c.emails.map(function(e){return '<a class="lead-lnk" href="mailto:'+escAttr(e)+'"><i data-lucide="mail"></i>'+escHtml(e)+'</a>';}).join("");
  var telBtns=c.phones.map(function(p){return '<a class="lead-lnk" href="tel:'+escAttr(String(p).replace(/\s+/g,""))+'"><i data-lucide="phone"></i>'+escHtml(p)+'</a>';}).join("");
  // RDV triés du + récent au + ancien = fil de suivi ; chaque ligne montre QUI (avatar+nom) et QUAND, et
  // se déplie au clic pour révéler le compte-rendu attribué (répond à « où est le compte-rendu de ce RDV »).
  var rdvSorted=c.rdvs.slice().sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  var rdvRows=rdvSorted.length? rdvSorted.map(function(r){
      var stc=(typeof RDV_STC!=="undefined"&&RDV_STC[r.st])||{l:r.st||"—",c:"#8a8c89",bg:"#eee"};
      var cc=commercialChip(r.who);
      var when=escHtml((r.day||"")+" "+(r.mon||"")+(r.time?" · "+r.time:""));
      var detail;
      if(r.compteRendu){ var crd=""; try{ crd=r.compteRenduAt?new Date(r.compteRenduAt).toLocaleString("fr-CH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):""; }catch(e){}
        detail='<div class="cli-rdv-cr"><div class="cli-rdv-cr-h">Compte-rendu · '+escHtml(cc.full)+(crd?" · "+escHtml(crd):"")+'</div><div class="cli-cr-t">'+escHtml(r.compteRendu)+'</div></div>'; }
      else if(r.note){ detail='<div class="cli-rdv-cr"><div class="cli-cr-t">'+escHtml(r.note)+'</div></div>'; }
      else { detail='<div class="cli-rdv-cr"><div class="hint" style="margin:0">Pas encore de compte-rendu pour ce rendez-vous.</div></div>'; }
      return '<div class="cli-rdv-item"><div class="cli-rdv-row" data-rdvtoggle role="button" tabindex="0">'
        +'<span class="cli-rdv-who"><span class="avatar xs" style="background:'+cc.color+';color:#fff">'+cc.ini+'</span>'+escHtml(r.who||"—")+'</span>'
        +'<span class="cli-rdv-d">'+when+'</span>'
        +'<span class="cli-rdv-s" style="color:'+stc.c+';background:'+stc.bg+'">'+escHtml(stc.l)+'</span>'
        +'<span class="cli-rdv-su">'+escHtml(r.sujet||"")+'</span>'
        +'<span class="cli-rdv-caret"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>'
        +'</div><div class="cli-rdv-detail" hidden>'+detail+'</div></div>';
    }).join("") : '<p class="hint" style="margin:0">Aucun rendez-vous pour ce client.</p>';
  var recaps=c.recaps.slice().sort(function(a,b){return String(b.at||"").localeCompare(String(a.at||""));});
  // Compte-rendu ATTRIBUÉ : avatar + nom du commercial (via son RDV) · date · sujet du RDV.
  var crHtml=recaps.length? recaps.map(function(cr){ var d=""; try{ d=cr.at?new Date(cr.at).toLocaleString("fr-CH",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):""; }catch(e){}
      var who=(cr.rdv&&cr.rdv.who)||""; var cc=who?commercialChip(who):null;
      var hd='<div class="cli-cr-hd">'+(cc?'<span class="avatar xs" style="background:'+cc.color+';color:#fff">'+cc.ini+'</span>':'')+(who?'<span class="cli-cr-au">'+escHtml(who)+'</span>':'')+(d?'<span class="cli-cr-when">'+escHtml(d)+'</span>':'')+((cr.rdv&&cr.rdv.sujet)?'<span class="cli-cr-su">'+escHtml(cr.rdv.sujet)+'</span>':'')+'</div>';
      return '<div class="cli-cr">'+hd+'<div class="cli-cr-t">'+escHtml(cr.text)+'</div></div>'; }).join("") : '<p class="hint" style="margin:0">Aucun compte-rendu. Utilisez le copilote pendant un rendez-vous pour en générer un.</p>';
  var leadHtml=c.leads.length? '<div class="cli-sec-h">Demandes reçues ('+c.leads.length+')</div>'+c.leads.map(function(l){ var d=""; try{ d=l.receivedAt?new Date(l.receivedAt).toLocaleDateString("fr-CH"):""; }catch(e){} return '<div class="cli-lead">'+escHtml((l.summary||"Demande")+(d?" · "+d:""))+(l.newsletter?' <span class="ex-tag" style="color:#0F6E56;background:#E1F5EE">newsletter ok</span>':'')+'</div>'; }).join("") : "";
  // Bandeau de métriques clés (résumé en un coup d'œil : combien de RDV, le dernier, la dernière relance, la suite).
  var lastRdv=rdvSorted[0], lastRdvV, lastRdvCls="";
  if(lastRdv){ var lc=commercialChip(lastRdv.who); lastRdvV='<span class="avatar xs" style="background:'+lc.color+';color:#fff">'+lc.ini+'</span>'+escHtml((lastRdv.day||"")+" "+(lastRdv.mon||"")); }
  else { lastRdvV="Aucun"; lastRdvCls=" dim"; }
  var relV, relCls;
  if(en.lastRelanceAt){ var rd=""; try{ rd=new Date(en.lastRelanceAt).toLocaleDateString("fr-CH",{day:"2-digit",month:"short",year:"numeric"}); }catch(e){} relV=escHtml(rd||"—"); relCls=" sub"; }
  else { relV="Jamais"; relCls=" dim"; }
  var nextStep=en.nextStep||c.nextStep||"";
  var kpisHtml='<div class="cli-kpis">'
    +'<div class="cli-kpi"><div class="cli-kpi-k">Rendez-vous</div><div class="cli-kpi-v">'+c.rdvs.length+'</div></div>'
    +'<div class="cli-kpi"><div class="cli-kpi-k">Dernier RDV</div><div class="cli-kpi-v'+lastRdvCls+'">'+lastRdvV+'</div></div>'
    +'<div class="cli-kpi"><div class="cli-kpi-k">Dernière relance</div><div class="cli-kpi-v'+relCls+'" id="cliKpiRel">'+relV+'</div></div>'
    +'<div class="cli-kpi"><div class="cli-kpi-k">Prochaine étape</div><div class="cli-kpi-v'+(nextStep?" sub":" dim")+'">'+(nextStep?escHtml(nextStep):"—")+'</div></div>'
    +'</div>';
  // Relance par e-mail intégrée : modèles éditables → ouverture messagerie + horodatage (pas de mailto « brut »).
  var tpls=cliRelanceTemplates(c);
  var relanceHtml = c.emails[0] ? (
      '<div class="cli-relance" id="cliRelancePanel"'+(opts.relance?"":" hidden")+'>'
      +'<div class="cli-rel-row"><input class="dInput" id="cliRelSubj" maxlength="160" aria-label="Objet de l\'e-mail" value="'+escAttr(tpls[0].subject)+'">'
        +'<select class="cli-rel-tpl" id="cliRelTpl" aria-label="Modèle de message">'+tpls.map(function(t,i){ return '<option value="'+i+'">'+escHtml(t.label)+'</option>'; }).join("")+'</select></div>'
      +'<textarea class="dArea" id="cliRelBody" maxlength="2000" aria-label="Message">'+escHtml(tpls[0].body)+'</textarea>'
      +'<div class="cli-relance-acts"><button class="btn primary sm" id="cliRelSend"><i data-lucide="send"></i>Ouvrir dans ma messagerie</button>'
      +'<button class="btn sec-b sm" id="cliRelMark"><i data-lucide="check"></i>Marquer comme relancé</button></div>'
      +'</div>'
    ) : "";
  var ov=document.createElement("div"); ov.className="thm-ov"; ov.id="cliCardOv";
  ov.innerHTML='<div class="thm-card cli-detail" role="dialog" aria-modal="true"><button class="thm-x" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'
    +'<div class="cli-d-hd"><div class="cli-d-hd-l"><span class="avatar lg">'+initials(c.name)+'</span><div class="cli-d-hd-tx"><div class="cli-d-name">'+escHtml(c.name)+'</div>'+(c.secteur?'<div class="cli-d-sec">'+escHtml(c.secteur)+'</div>':'')+'</div></div><span class="cli-badge" style="color:'+c.status.c+';background:'+c.status.bg+'">'+escHtml(c.status.lbl)+'</span></div>'
    +kpisHtml
    +((mailBtns||telBtns)?'<div class="cli-d-contact">'+mailBtns+telBtns+'</div>':'')
    +'<div class="cli-d-actions"><button class="btn primary sm" data-cli-cop><i data-lucide="compass"></i>Piloter avec le copilote</button>'+(c.emails[0]?'<button class="btn sec-b sm" id="cliRelToggle"><i data-lucide="mail"></i>Relancer par e-mail</button>':'')+'</div>'
    +relanceHtml
    +cliSuiviHtml(c)
    +'<div class="cli-sec-h">Rendez-vous ('+c.rdvs.length+')</div><div class="cli-rdv-list">'+rdvRows+'</div>'
    +'<div class="cli-sec-h">Comptes-rendus ('+c.recaps.length+')</div><div class="cli-cr-list">'+crHtml+'</div>'
    +leadHtml
    +'</div>';
  document.body.appendChild(ov);
  function close(){ ov.remove(); document.removeEventListener("keydown",esc); }
  function esc(e){ if(e.key==="Escape") close(); }
  ov.querySelector(".thm-x").addEventListener("click",close);
  var cop=ov.querySelector("[data-cli-cop]"); if(cop) cop.addEventListener("click",function(){ close(); prepareCopilotForClient(key); });
  var stSel=ov.querySelector("#cliStatusSel"); if(stSel && typeof enhanceSelect==="function") enhanceSelect(stSel);
  var ofSel=ov.querySelector("#cliOfferSel"); if(ofSel && typeof enhanceSelect==="function") enhanceSelect(ofSel);
  var sv=ov.querySelector("#cliSaveSuivi"); if(sv) sv.addEventListener("click",function(){ saveClientSuivi(key, ov); });
  // Relance par e-mail : dépliage + choix d'un modèle + envoi/marquage
  var relPanel=ov.querySelector("#cliRelancePanel"), relToggle=ov.querySelector("#cliRelToggle");
  if(relToggle&&relPanel){ relToggle.addEventListener("click",function(){ if(relPanel.hasAttribute("hidden")){ relPanel.removeAttribute("hidden"); try{ relPanel.scrollIntoView({block:"nearest"}); }catch(e){} } else relPanel.setAttribute("hidden",""); }); }
  if(relPanel){
    var subjEl=relPanel.querySelector("#cliRelSubj"), bodyEl=relPanel.querySelector("#cliRelBody");
    relPanel.dataset.kind=tpls[0].label;
    var tplSel=relPanel.querySelector("#cliRelTpl");
    if(tplSel){ tplSel.addEventListener("change",function(){ var t=tpls[+tplSel.value]; if(!t) return; subjEl.value=t.subject; bodyEl.value=t.body; relPanel.dataset.kind=t.label; }); if(typeof enhanceSelect==="function") enhanceSelect(tplSel); }
    var sb=relPanel.querySelector("#cliRelSend"); if(sb) sb.addEventListener("click",function(){ var url="mailto:"+encodeURIComponent(c.emails[0]||"")+"?subject="+encodeURIComponent(subjEl.value||"")+"&body="+encodeURIComponent(bodyEl.value||""); try{ window.location.href=url; }catch(e){} saveClientRelance(key, relPanel.dataset.kind||"", ov); });
    var mb=relPanel.querySelector("#cliRelMark"); if(mb) mb.addEventListener("click",function(){ saveClientRelance(key, relPanel.dataset.kind||"", ov); });
  }
  if(opts.relance && relPanel){ try{ relPanel.scrollIntoView({block:"nearest"}); }catch(e){} }
  ov.querySelectorAll("[data-rdvtoggle]").forEach(function(row){ function tog(){ var it=row.parentNode; var d=it.querySelector(".cli-rdv-detail"); if(!d) return; if(d.hasAttribute("hidden")){ d.removeAttribute("hidden"); it.classList.add("open"); } else { d.setAttribute("hidden",""); it.classList.remove("open"); } } row.addEventListener("click",tog); row.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); tog(); } }); });
  ov.addEventListener("mousedown",function(e){ if(e.target===ov) close(); });
  document.addEventListener("keydown",esc); refreshIcons();
}
// Depuis une fiche client : lance le copilote pré-rempli. Si le client a un RDV, on réutilise le lien
// RDV<->copilote (prepareRdvCopilot) ; sinon prospect libre (pré-remplissage direct).
function prepareCopilotForClient(key){
  var c=(cliCurrentList||[]).find(function(x){return x.key===key;}); if(!c) return;
  var rdv=c.rdvs.filter(function(r){return r.st==="avenir";})[0]||c.rdvs[0];
  if(rdv){ var i=rdvData.indexOf(rdv); if(i>=0){ prepareRdvCopilot(i); return; } }
  if(typeof copHasWork==="function" && copHasWork() && !confirm("Un copilote est déjà en cours. Le remplacer par ce client ?")) return;
  copState=copBlank(); copState.company=c.name||""; copState.contact=c.contacts[0]||""; copState.email=c.emails[0]||"";
  if(c.secteur && RDV_SECTEUR_TO_COP[c.secteur]) copState.ans.secteur=RDV_SECTEUR_TO_COP[c.secteur];
  copSave(); showView("copilot"); renderCopilot(); toast("Copilote préparé pour "+(c.name||"ce client"));
}

/* ============================================================
   Rendez-vous module
   ============================================================ */
/* statuts sémantiques : à venir = bleu (planifié), honoré = vert (réussi), annulé = gris (neutre), no-show = rouge (problème) */
const RDV_STC={
  avenir:{l:"À venir",       c:"#185FA5", bg:"#E6F1FB", solid:"#378ADD"},
  honore:{l:"Honoré",        c:"#0F6E56", bg:"#E1F5EE", solid:"#1D9E75"},
  refuse:{l:"Pas intéressé", c:"#8a4b3a", bg:"#F6ECE7", solid:"#C47A5E"},
  annule:{l:"Annulé",        c:"#5F5E5A", bg:"#F1EFE8", solid:"#B4B2A9"},
  noshow:{l:"No-show",       c:"#A32D2D", bg:"#FCEBEB", solid:"#E24B4A"}
};
const RDV_REASONS=[["Tarif jugé trop élevé",38],["Pas le bon moment",27],["Parti à la concurrence",19],["Sans réponse / injoignable",16]];
/* agrégat 30 jours par personne (source unique et cohérente pour équipe + statuts + raisons + cartes).
   Distinct de la liste ci-dessous, qui ne montre que les rendez-vous récents/à venir. */
// Jeu de DÉMO du tableau d'équipe (Jean-Christophe inclus pour rester cohérent avec rdvData, où il a un RDV).
// Sert de repli tant que Calendly n'est pas connecté ; sinon les chiffres sont calculés sur les vrais RDV.
const TEAM_STATS={
  Sarah:{avenir:2, honores:15, annules:3, noshow:2, clients:5},
  Marc: {avenir:2, honores:11, annules:3, noshow:2, clients:3},
  "Jean-Christophe":{avenir:1, honores:6, annules:1, noshow:1, clients:2}
};
// Compte les RDV réels par personne (répartis par statut). clients=null : la conversion n'est PAS dérivable
// des RDV (il faut la source d'abonnement du back-office) -> marquée « exemple ».
function teamCountsFromRdv(who){
  const a={avenir:0,honores:0,annules:0,noshow:0,clients:null};
  (typeof rdvData!=="undefined"?rdvData:[]).forEach(r=>{ if(!r||!r.who) return; if(who&&who!=="all"&&r.who!==who) return;
    if(r.st==="avenir") a.avenir++; else if(r.st==="honore") a.honores++; else if(r.st==="noshow") a.noshow++; else if(r.st==="annule"||r.st==="refuse") a.annules++; });
  return a;
}
// Agrégat équipe : RÉEL calculé sur les vrais RDV quand Calendly est connecté (rdvLiveOn), sinon DÉMO (TEAM_STATS).
function teamAgg(who){
  const live=(typeof rdvLiveOn!=="undefined"&&rdvLiveOn);
  let a;
  if(live){ a=teamCountsFromRdv(who); a.clients=0; a.convReal=false; }   // conversion non calculable en live -> exemple
  else { a={avenir:0,honores:0,annules:0,noshow:0,clients:0,convReal:false};
    Object.keys(TEAM_STATS).forEach(p=>{ if(who&&who!=="all"&&p!==who) return; const s=TEAM_STATS[p];
      a.avenir+=s.avenir; a.honores+=s.honores; a.annules+=s.annules; a.noshow+=s.noshow; a.clients+=s.clients; }); }
  a.live=live;
  a.past=a.honores+a.annules+a.noshow; a.total=a.past+a.avenir;
  a.presence=a.past?Math.round(a.honores/a.past*100):0;
  a.conversion=a.honores?Math.round(a.clients/a.honores*100):0;
  return a;
}
const MFULL={"janv.":"janvier","févr.":"février","mars":"mars","avr.":"avril","avril":"avril","mai":"mai","juin":"juin","juil.":"juillet","août":"août","sept.":"septembre","oct.":"octobre","nov.":"novembre","déc.":"décembre"};
let rdvData=[
  {day:"2",mon:"juil.",time:"10:00",client:"Boucherie Dubois",contact:"Pierre Dubois",tel:"+41 22 311 22 09",email:"contact@boucherie-dubois.ch",secteur:"Restauration",volume:"10 à 30",sujet:"Découverte",who:"Sarah",mode:"tel",st:"avenir",note:""},
  {day:"2",mon:"juil.",time:"15:00",client:"Pharmacie du Lac",contact:"Claire Fontaine",tel:"+41 22 736 44 10",email:"accueil@pharmaciedulac.ch",secteur:"Médical / Pharma",volume:"30 à 100",sujet:"Mise en place Flex",who:"Marc",mode:"tel",st:"avenir",note:""},
  {day:"4",mon:"juil.",time:"09:00",client:"Atelier Vélo Plus",contact:"Thomas Girard",tel:"",email:"hello@atelierveloplus.ch",secteur:"E-commerce / Retail",volume:"Moins de 10",link:"meet.google.com/qdb-yrkp-xza",sujet:"Devis Dédié",who:"Sarah",mode:"visio",st:"avenir",note:""},
  {day:"7",mon:"juil.",time:"11:00",client:"Café des Bains",contact:"Sofia Marchetti",tel:"+41 22 321 57 30",email:"resa@cafedesbains.ch",secteur:"Restauration",volume:"10 à 30",sujet:"Découverte",who:"Marc",mode:"tel",st:"avenir",note:""},
  {day:"28",mon:"juin",time:"11:00",client:"Cabinet Morand",contact:"Antoine Morand",tel:"",email:"contact@cabinet-morand.ch",secteur:"Juridique / Notarial",volume:"Moins de 10",link:"meet.google.com/hxa-mnbq-rpo",sujet:"Découverte",who:"Sarah",mode:"visio",st:"honore",note:"Devis envoyé, relance le 5 juil."},
  {day:"27",mon:"juin",time:"15:30",client:"Restaurant Sole",contact:"Luca Bianchi",tel:"+41 22 738 16 24",email:"info@restaurant-sole.ch",secteur:"Restauration",volume:"30 à 100",sujet:"Suivi mensuel",who:"Marc",mode:"tel",st:"honore",note:"Satisfait, passe en Dédié"},
  {day:"26",mon:"juin",time:"16:00",client:"Fleuriste Camélia",contact:"Nadia Berger",tel:"+41 22 344 28 71",email:"bonjour@camelia-fleurs.ch",secteur:"E-commerce / Retail",volume:"Moins de 10",sujet:"Question tarifs",who:"Sarah",mode:"tel",st:"refuse",note:"Trouve l'offre trop chère, ne souhaite pas être relancée."},
  {day:"25",mon:"juin",time:"09:30",client:"Librairie Page 12",contact:"Élise Favre",tel:"",email:"libraire@page12.ch",secteur:"E-commerce / Retail",volume:"10 à 30",link:"meet.google.com/vwo-ktsd-ign",sujet:"Découverte",who:"Marc",mode:"visio",st:"noshow",note:"Relancer par mail",relance:{sent:true,date:"27 juin"}},
  {day:"24",mon:"juin",time:"14:00",client:"Établissements Vermeulen-Delacroix & Fils",contact:"Marie-Alexandra de Montmollin",tel:"",email:"contact@vermeulen-delacroix.ch",secteur:"Luxe / Bijouterie",volume:"Plus de 100",link:"meet.google.com/zpr-fmna-lqe",sujet:"Renouvellement du contrat Dédié",who:"Jean-Christophe",mode:"visio",st:"honore",note:"Décision attendue au prochain comité de direction"}
];
/* Persistance des rendez-vous : les changements de statut / relance survivent au rechargement. */
try{ const _rs=JSON.parse(localStorage.getItem("chaskis_rdv_v1")); if(Array.isArray(_rs)&&_rs.length) rdvData=_rs.filter(r=>r&&typeof r==="object").map(r=>{ if(!RDV_STC[r.st]) r.st="avenir"; return r; }); }catch(e){}
// rdvLiveOn : vrai quand rdvData vient de Calendly (live). On NE persiste alors PAS (sinon
// un changement de statut/note écraserait le jeu de démo dans localStorage, perdu au reload).
var rdvLiveOn=false;
function saveRdv(){ if(rdvLiveOn) return; try{ localStorage.setItem("chaskis_rdv_v1", JSON.stringify(rdvData)); }catch(e){ toast("Stockage plein : changement non enregistré."); } }
const RDV_PERIODS={
  "7j":{curR:"23-29 juin",prevR:"16-22 juin",chart:{labels:["lun 23","mar 24","mer 25","jeu 26","ven 27","sam 28","dim 29"],vals:[1,2,1,2,1,0,2]}},
  "30j":{curR:"1-30 juin",prevR:"1-31 mai",chart:{labels:["2-8 juin","9-15 juin","16-22 juin","23-30 juin"],vals:[5,7,6,9]}},
  "3m":{curR:"avr-juin 2026",prevR:"janv-mars 2026",chart:{labels:["avril","mai","juin"],vals:[18,22,27]}},
  "6m":{curR:"janv-juin 2026",prevR:"juil-déc 2025",chart:{labels:["janv.","févr.","mars","avr.","mai","juin"],vals:[14,16,19,18,22,27]}},
  "12m":{curR:"juil 2025 - juin 2026",prevR:"juil 2024 - juin 2025",chart:{labels:["juil.","août","sept.","oct.","nov.","déc.","janv.","févr.","mars","avr.","mai","juin"],vals:[10,8,12,15,17,14,14,16,19,18,22,27]}}
};
let rdvKey="30j";
const RDV_TODAY="2 juil.";           // "aujourd'hui" (démo) : date affichée pour une relance envoyée maintenant
let rdvAuto={on:false, delay:"2 semaines"};   // relance automatique (activable) après N sans réponse
let rdvWho="all";        // filtre "voir" : toute l'équipe ou une personne
let rdvOpenRow=-1;   // index de la ligne dépliée (fiche rendez-vous), -1 si aucune
let rdvSel=new Set();                     // sélection pour relance en masse
let rdvPage=1; const RDV_PER_PAGE=8;      // pagination de la liste
// Échappe pour insertion HTML SÛRE en nœud texte ET en valeur d'attribut (les guillemets " et '
// sont échappés en plus de < > & : indispensable car escHtml alimente aussi des title="..."/href="..."
// avec des données externes, ex. Calendly). Visuellement identique en texte (&quot; s'affiche « " »).
function escHtml(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

/* ---- calendriers connectés + workflow de connexion ---- */
let rdvCalendars=[
  {name:"Sarah Reinhardt",handle:"calendly.com/chaskis-sarah",topic:"Appels découverte"},
  {name:"Marc Dupont",handle:"calendly.com/chaskis-marc",topic:"Devis et suivi"}
];
let calFlow={open:false,step:1,name:"",link:""};
function initials(n){ return escHtml((n||"?").split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase()); }
function renderAccount(){
  const a=document.getElementById("rdvAccount"); if(!a) return;
  if(rdvCalendars.length){ const f=rdvCalendars[0], extra=rdvCalendars.length>1?" +"+(rdvCalendars.length-1):"";
    a.innerHTML='<span class="acct"><span class="avatar sm">'+initials(f.name)+'</span><span class="acct-i"><b>'+escHtml(f.name)+extra+'</b><span>● Connecté</span></span></span>';
  } else { a.innerHTML='<span class="acct off"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.4 18.4A9 9 0 1 0 5.6 5.6"/><path d="m2 2 20 20"/></svg>Aucun calendrier connecté</span>'; }
}
function renderCalendars(){
  renderAccount();
  const cnt=document.getElementById("rdvCalCount"); if(cnt) cnt.textContent=rdvCalendars.length;
  const l=document.getElementById("rdvCalList"); if(!l) return; l.innerHTML="";
  const add=document.createElement("button"); add.className="cal-add"; add.id="rdvAddCal"; add.title="Ajouter un Calendly";
  add.innerHTML='<span class="cal-add-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></span><span class="cn">Ajouter un Calendly</span>';
  add.addEventListener("click", openCalFlow); l.appendChild(add);
  rdvCalendars.forEach((c,i)=>{ const chip=document.createElement("div"); chip.className="cal-chip"; chip.title=c.topic;
    chip.innerHTML='<span class="avatar sm">'+initials(c.name)+'</span><span class="cn">'+escHtml(c.name)+'</span><button class="cal-x2" title="Déconnecter">✕</button>';
    chip.querySelector(".cal-x2").addEventListener("click",()=>{ if(!confirm("Déconnecter le Calendly de "+c.name+" ? Ses rendez-vous ne remonteront plus.")) return; rdvCalendars.splice(i,1); renderRdv(); toast("Calendly déconnecté"); });
    l.appendChild(chip); });
}
function openCalFlow(){ calFlow={open:true,step:1,name:"",link:""}; document.getElementById("calModalBg").classList.add("show"); renderCalFlow(); }
function closeCalFlow(){ calFlow={open:false,step:1,name:"",link:""}; document.getElementById("calModalBg").classList.remove("show"); }
function renderCalFlow(){
  const f=document.getElementById("calFlowBody"); if(!f) return;
  const steps='<div class="flow-steps">'+[1,2,3].map(s=>'<span class="fs'+(s<calFlow.step?" done":(s===calFlow.step?" on":""))+'">'+(s<calFlow.step?'✓':s)+'</span>').join('<i></i>')+'</div>';
  let body="";
  if(calFlow.step===1){
    body='<div class="formf"><label>Nom de la personne</label><input id="cfName" placeholder="Ex. Marc Dupont" value="'+escAttr(calFlow.name||"")+'"></div>'+
         '<div class="formf"><label>Lien Calendly</label><input id="cfLink" placeholder="calendly.com/votre-lien" value="'+escAttr(calFlow.link||"")+'"></div>'+
         '<div class="flow-acts"><button class="btn ghost" id="cfCancel">Annuler</button><button class="btn primary" id="cfNext">Suivant</button></div>';
  } else if(calFlow.step===2){
    body='<div class="flow-connecting"><div class="spin"></div>Connexion à Calendly…</div><div class="flow-acts"><button class="btn" id="cfBack">Retour</button><button class="btn primary" id="cfNext">J\'ai autorisé l\'accès</button></div>';
  } else {
    body='<div class="flow-done"><span class="avatar lg">'+initials(calFlow.name)+'</span><div><div class="cn">'+escHtml(calFlow.name)+'</div><div class="ch">'+escHtml(calFlow.link||"calendly.com/…")+'</div><div class="cal-ok" style="margin-top:4px">● Connecté</div></div></div><div class="flow-acts"><button class="btn primary" id="cfFinish">Terminer</button></div>';
  }
  f.innerHTML=steps+body;
  if(calFlow.step===1){
    f.querySelector("#cfCancel").onclick=closeCalFlow;
    f.querySelector("#cfNext").onclick=()=>{ calFlow.name=f.querySelector("#cfName").value.trim(); calFlow.link=f.querySelector("#cfLink").value.trim(); if(!calFlow.name){ toast("Indiquez un nom"); return; } calFlow.step=2; renderCalFlow(); };
  } else if(calFlow.step===2){
    f.querySelector("#cfBack").onclick=()=>{ calFlow.step=1; renderCalFlow(); };
    f.querySelector("#cfNext").onclick=()=>{ calFlow.step=3; renderCalFlow(); };
  } else {
    f.querySelector("#cfFinish").onclick=()=>{ rdvCalendars.push({name:calFlow.name,handle:calFlow.link||"calendly.com/…",topic:"Rendez-vous"}); closeCalFlow(); renderRdv(); toast("Calendly connecté"); };
  }
}
document.getElementById("calClose").addEventListener("click", closeCalFlow);
document.getElementById("calModalBg").addEventListener("click",(e)=>{ if(e.target.id==="calModalBg") closeCalFlow(); });

/* lignes labellisées compactes (raisons) */
function renderBars(id, data, color){
  const w=document.getElementById(id); if(!w) return; w.innerHTML="";
  const max=Math.max.apply(null,data.map(d=>d[1]));
  data.forEach(d=>{ const row=document.createElement("div"); row.className="barrow tipped";
    row._tip='<div class="tt-h">'+d[0]+'</div><div class="tt-row"><span>Part</span><b>'+d[1]+' %</b></div>';
    row.innerHTML='<span class="bl">'+d[0]+'</span><span class="bt"><span class="bf" style="width:'+Math.round(d[1]/max*100)+'%;background:'+(color||"var(--teal)")+'"></span></span><span class="bp">'+d[1]+' %</span>';
    w.appendChild(row); });
}

function renderRdvTable(){
  const b=document.getElementById("rdvBody"); if(!b) return; b.innerHTML="";
  const f=(document.getElementById("rdvFilter")||{}).value||"all";
  const idxs=[]; rdvData.forEach((r,i)=>{ if(rdvWho!=="all"&&r.who!==rdvWho) return; if(f!=="all"&&r.st!==f) return; idxs.push(i); });
  const total=idxs.length, pages=Math.max(1,Math.ceil(total/RDV_PER_PAGE));
  if(rdvPage>pages) rdvPage=pages; if(rdvPage<1) rdvPage=1;
  const start=(rdvPage-1)*RDV_PER_PAGE, pageIdxs=idxs.slice(start,start+RDV_PER_PAGE);
  if(!total){ const tr=document.createElement("tr"); tr.innerHTML='<td colspan="9" style="color:var(--muted);padding:14px">Aucun rendez-vous pour ce filtre.</td>'; b.appendChild(tr); }
  pageIdxs.forEach(i=>{ const r=rdvData[i];
    const sc=RDV_STC[r.st]||RDV_STC.avenir, past=(r.st!=="avenir"), sent=r.relance&&r.relance.sent;
    const relok = past && r.st!=="refuse";
    const open=(rdvOpenRow===i);
    const arrowSvg='<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="'+sc.c+'" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg>';
    const sel='<select class="statusel" style="background-color:'+sc.bg+';color:'+sc.c+';border-color:'+sc.bg+';font-weight:500;background-image:url(\''+("data:image/svg+xml,"+encodeURIComponent(arrowSvg))+'\')">'+Object.keys(RDV_STC).map(k=>'<option value="'+k+'"'+(k===r.st?" selected":"")+'>'+RDV_STC[k].l+'</option>').join("")+'</select>';
    const preview = r.note ? escHtml(r.note.length>26?r.note.slice(0,26)+"…":r.note) : "—";
    let relCell;
    if(!relok){ relCell='<span style="color:var(--muted);font-size:12px">'+(r.st==="refuse"?"ne pas relancer":"—")+'</span>'; }
    else if(sent){ relCell='<span class="rel-done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Relancé le '+(r.relance.date||"?")+'</span>'; }
    else { relCell='<button class="iconbtn" data-rel="1" title="Relancer ce client (action rapide)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Relancer</button>'; }
    const chk = (relok && !sent) ? '<input type="checkbox" class="rsel"'+(rdvSel.has(i)?" checked":"")+'>' : '';
    const tr=document.createElement("tr"); tr.className="rdv-row"+(open?" row-open":"");
    tr.innerHTML='<td class="chk">'+chk+'</td>'+
      '<td><div class="dt-d">'+r.day+' '+r.mon+'</div><div class="dt-t">'+r.time+'</div></td>'+
      '<td><div class="cl-co" title="'+escHtml(r.client)+'">'+escHtml(r.client)+'</div>'+(r.contact?'<div class="cl-ct" title="'+escHtml(r.contact)+'">'+escHtml(r.contact)+'</div>':'')+'</td>'+
      '<td>'+escHtml(r.sujet)+'</td>'+
      '<td style="white-space:nowrap"><span class="who"><span class="avatar xs">'+initials(r.who)+'</span><span class="who-n" title="'+escHtml(r.who)+'">'+escHtml(r.who)+'</span></span></td>'+
      '<td style="white-space:nowrap">'+sel+'</td>'+
      '<td><button class="notecell'+(r.note?'':' empty')+'"'+(r.note?' title="'+escHtml(r.note)+'"':'')+'>'+preview+'</button></td>'+
      '<td style="white-space:nowrap">'+relCell+'</td>'+
      '<td class="rdv-exp" title="Ouvrir la fiche (coordonnées, note, relance)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></td>';
    // clic sur la ligne : ouvre la fiche dans le panneau droit
    tr.addEventListener("click",()=>openRdvDrawer(i));
    // les contrôles interactifs ne doivent pas ouvrir le panneau
    const st=tr.querySelector(".statusel");
    st.addEventListener("change",e=>{ e.stopPropagation(); rdvData[i].st=e.target.value; rdvSel.delete(i); saveRdv(); renderRdv(); });
    enhanceSelect(st);
    const cb=tr.querySelector(".rsel"); if(cb){ cb.addEventListener("click",e=>e.stopPropagation()); cb.addEventListener("change",e=>{ if(e.target.checked) rdvSel.add(i); else rdvSel.delete(i); renderRdvBulk(); }); }
    // relance en action rapide (un clic, sans ouvrir le panneau)
    const rb=tr.querySelector('[data-rel]'); if(rb){ rb.addEventListener("click",e=>{ e.stopPropagation(); rdvData[i].relance={sent:true,date:RDV_TODAY}; rdvSel.delete(i); saveRdv(); toast("Relance envoyée à "+rdvData[i].client+" (simulé)"); renderRdv(); }); }
    b.appendChild(tr);
  });
  renderPager(total,pages,start,pageIdxs.length);
  renderRdvBulk();
  refreshIcons();
  // le panneau reste synchronisé : si aucune ligne active, on le referme
  const dw=document.getElementById("rdvDrawer");
  if(dw && rdvOpenRow<0){ dw.classList.remove("show"); const sc=document.getElementById("rdvScrim"); if(sc) sc.classList.remove("show"); }
}
function renderPager(total,pages,start,count){
  const el=document.getElementById("rdvPager"); if(!el) return;
  if(pages<=1){ el.innerHTML=""; return; }
  const chevL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
  const chevR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
  const btn=(n,lbl,cls,dis)=>'<button class="pg-btn'+(cls?" "+cls:"")+'" data-pg="'+n+'"'+(dis?" disabled":"")+'>'+lbl+'</button>';
  const win=[]; for(let n=1;n<=pages;n++){ if(n===1||n===pages||Math.abs(n-rdvPage)<=1) win.push(n); }
  let nums="",last=0; win.forEach(n=>{ if(n-last>1) nums+='<span class="pg-ell">…</span>'; nums+=btn(n,String(n),n===rdvPage?"on":""); last=n; });
  el.innerHTML='<span class="pg-info">'+(start+1)+'–'+(start+count)+' sur '+total+' rendez-vous</span>'+
    '<span class="pg-ctrl">'+btn(rdvPage-1,chevL,"",rdvPage<=1)+nums+btn(rdvPage+1,chevR,"",rdvPage>=pages)+'</span>';
  el.querySelectorAll(".pg-btn[data-pg]").forEach(bt=>{ if(bt.disabled) return; bt.addEventListener("click",()=>{ const n=+bt.dataset.pg; if(n>=1&&n<=pages&&n!==rdvPage){ rdvPage=n; rdvOpenRow=-1; renderRdvTable(); } }); });
}
function renderRdvBulk(){
  const el=document.getElementById("rdvBulk"); if(!el) return;
  const n=rdvSel.size;
  if(!n){ el.style.display="none"; el.innerHTML=""; return; }
  el.style.display="";
  el.innerHTML='<span class="lbl"><b>'+n+'</b> rendez-vous sélectionné'+(n>1?"s":"")+'</span><span class="sp"></span><button class="btn ghost" id="bulkClear">Tout désélectionner</button><button class="btn primary" id="bulkRel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Relancer la sélection</button>';
  el.querySelector("#bulkRel").onclick=()=>{ let c=0; rdvSel.forEach(i=>{ const r=rdvData[i]; if(r && r.st!=="avenir" && r.st!=="refuse" && !(r.relance&&r.relance.sent)){ r.relance={sent:true,date:RDV_TODAY}; c++; } }); rdvSel.clear(); saveRdv(); toast(c+" relance"+(c>1?"s":"")+" envoyée"+(c>1?"s":"")+" (simulé)"); renderRdv(); };
  el.querySelector("#bulkClear").onclick=()=>{ rdvSel.clear(); renderRdvTable(); };
}
// Compte-rendu rattaché au RDV : affichage + saisie/édition MANUELLE (RDV sur place ou sans copilote).
// Persiste comme le copilote (saveRdvOverride en live, sinon saveRdv). Bloc et éditeur séparés pour un
// échange DOM in-place dans le tiroir (pas d'état global).
function rdvCrBlock(r){
  var cr=r.compteRendu||"";
  if(cr){ return '<div class="fiche-lbl" style="margin:0 0 4px">Compte-rendu'+(r.compteRenduAt?' · '+escHtml(fmtShort(r.compteRenduAt)):'')+'</div>'+
    '<div class="cr-box">'+escHtml(cr)+'</div>'+
    '<button class="btn sec-b sm" id="dCrEdit" style="margin-top:6px"><i data-lucide="pencil"></i>Modifier le compte-rendu</button>'; }
  return '<button class="btn sec-b" id="dCrEdit" style="width:100%;justify-content:center"><i data-lucide="file-pen-line"></i>Rédiger le compte-rendu</button>'+
    '<div class="fiche-hint" style="margin:6px 0 0">Rendez-vous sur place ou sans le copilote ? Rédigez le compte-rendu ici.</div>';
}
function rdvCrEditor(r){
  return '<div class="fiche-lbl" style="margin:0 0 4px">Compte-rendu</div>'+
    '<textarea class="dArea" id="dCrText" rows="6" placeholder="Points clés de l\'échange, besoin, offre chiffrée, prochaine étape…">'+escHtml(r.compteRendu||"")+'</textarea>'+
    '<div style="display:flex;gap:8px;margin-top:2px"><button class="btn primary sm" id="dCrSave"><i data-lucide="save"></i>Enregistrer</button><button class="btn ghost sm" id="dCrCancel">Annuler</button></div>';
}
function saveRdvCr(i,text){
  var r=rdvData[i]; if(!r) return; r.compteRendu=text; r.compteRenduAt=new Date().toISOString();
  if(typeof rdvLiveOn!=="undefined" && rdvLiveOn) saveRdvOverride(r.calendlyUri||rdvStableKey(r),{compteRendu:r.compteRendu,compteRenduAt:r.compteRenduAt}); else saveRdv();
}
function rdvFicheInner(i){
  const r=rdvData[i];
  const past=(r.st!=="avenir"), sent=r.relance&&r.relance.sent, relok=past&&r.st!=="refuse";
  const telClean=(r.tel||"").replace(/[^+0-9]/g,"");

  const mi = r.mode==="visio" ? {label:"Visio",icon:"video",cls:"visio"} : {label:"Appel",icon:"phone",cls:"tel"};

  // coordonnées : selon le mode (appel = numéro, visio = lien)
  let acts="";
  if(r.mode==="visio"){
    if(r.link) acts+='<a class="fiche-act" href="https://'+escAttr(r.link)+'" target="_blank" rel="noopener"><span class="fa-ic"><i data-lucide="video"></i></span><span class="fa-tx"><span class="fa-l">Rejoindre la visio</span><span class="fa-v">'+escHtml(r.link)+'</span></span></a>';
  } else {
    if(r.tel) acts+='<a class="fiche-act" href="tel:'+telClean+'"><span class="fa-ic"><i data-lucide="phone"></i></span><span class="fa-tx"><span class="fa-l">Appeler '+escHtml(r.contact||r.client)+'</span><span class="fa-v">'+escHtml(r.tel)+'</span></span></a>';
  }
  if(r.email) acts+='<a class="fiche-act" href="mailto:'+escAttr(r.email)+'"><span class="fa-ic"><i data-lucide="mail"></i></span><span class="fa-tx"><span class="fa-l">Écrire un email</span><span class="fa-v">'+escHtml(r.email)+'</span></span></a>';
  if(!acts) acts='<p class="fiche-hint">Aucune coordonnée renseignée.</p>';

  // relance : état/action compact, en ligne avec l'enregistrement de la note
  let relInline;
  if(sent) relInline='<span class="rel-mini ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>Relancé le '+r.relance.date+'</span>';
  else if(r.st==="refuse") relInline='<span class="rel-mini muted">Client à ne pas relancer</span>';
  else if(!relok) relInline='<span class="rel-mini muted">Relance disponible après le rendez-vous</span>';
  else relInline='<button class="btn" id="dRelSend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Relancer le client</button>';

  const head='<div class="fiche-hd"><div class="who-lg"><span class="avatar lg">'+initials(r.client)+'</span>'+
    '<div class="who-tx"><div class="nm" title="'+escHtml(r.client)+'">'+escHtml(r.client)+'</div><div class="sb">'+escHtml(r.sujet)+' · '+r.day+' '+r.mon+' à '+r.time+'</div></div></div>'+
    '<div class="hd-r"><span class="fmode fmode-'+mi.cls+'"><i data-lucide="'+mi.icon+'"></i>'+mi.label+'</span>'+
    '<button class="x-close" id="dClose" title="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>';

  // contexte renseigné par le prospect à la réservation (l'email est repris dans les actions de contact, pas ici)
  const infoItems=[["Interlocuteur",r.contact],["Secteur",r.secteur],["Volume estimé",r.volume?r.volume+" / jour":""]].filter(x=>x[1]);
  const info=infoItems.length?'<div class="fiche-info">'+infoItems.map(x=>'<div class="fiche-ir"><span class="k">'+x[0]+'</span><span class="v" title="'+escHtml(x[1])+'">'+escHtml(x[1])+'</span></div>').join('')+'</div>':'';

  // Entrée copilote + compte-rendu rattaché (affiché, modifiable, ou à rédiger après coup).
  const prep='<button class="btn" id="dPrepare" style="width:100%;justify-content:center;margin-bottom:10px"><i data-lucide="compass"></i>Préparer / piloter avec le copilote</button>'+
    '<button class="btn sec-b" id="dClient" style="width:100%;justify-content:center;margin-bottom:10px"><i data-lucide="contact-round"></i>Voir la fiche client</button>'+
    '<div id="dCrArea" style="margin-bottom:10px">'+rdvCrBlock(r)+'</div>';

  // 2 colonnes cohérentes : gauche = le prospect (qui + comment le joindre), droite = votre suivi
  const cols='<div class="fiche-cols">'+
    '<div class="fiche-col"><div class="fiche-lbl">Le prospect</div>'+info+'<div class="fiche-acts">'+acts+'</div></div>'+
    '<div class="fiche-col"><div class="fiche-lbl">Votre suivi</div>'+prep+
      '<div class="fiche-reassign" style="margin-bottom:10px"><label for="dWho" style="display:block;font-size:12px;color:#6b7280;margin:0 0 4px;font-weight:600">Commercial attribué</label><select id="dWho" class="rangesel" style="width:100%">'+rdvOwnersList().map(function(o){return '<option'+(o===r.who?' selected':'')+'>'+escHtml(o)+'</option>';}).join('')+'</select></div>'+
      '<textarea class="dArea" id="dNote" rows="5" placeholder="Compte-rendu de l\'échange, prochaines étapes, devis envoyé…">'+escHtml(r.note||"")+'</textarea>'+
      '<div class="note-foot"><button class="btn" id="dNoteSave">Enregistrer la note</button>'+relInline+'</div>'+
    '</div>'+
  '</div>';

  return '<div class="rdv-fiche">'+head+cols+'</div>';
}
function openRdvDrawer(i){
  rdvOpenRow=i;
  const d=document.getElementById("rdvDrawer"), s=document.getElementById("rdvScrim");
  d.innerHTML=rdvFicheInner(i);
  s.classList.add("show"); d.classList.add("show"); refreshIcons();
  const ns=d.querySelector("#dNoteSave"); if(ns) ns.onclick=()=>{ rdvData[i].note=d.querySelector("#dNote").value.trim(); saveRdv(); toast("Note enregistrée"); openRdvDrawer(i); };
  const send=d.querySelector("#dRelSend"); if(send) send.onclick=()=>{ rdvData[i].relance={sent:true,date:RDV_TODAY}; saveRdv(); toast("Relance envoyée à "+rdvData[i].client+" (simulé)"); openRdvDrawer(i); };
  const cl=d.querySelector("#dClose"); if(cl) cl.onclick=closeRdvDrawer;
  const prep=d.querySelector("#dPrepare"); if(prep) prep.onclick=()=>prepareRdvCopilot(i);
  const dcli=d.querySelector("#dClient"); if(dcli) dcli.onclick=()=>{ closeRdvDrawer(); openClientCard(cliKeyFor(rdvData[i])); };
  const wsel=d.querySelector("#dWho"); if(wsel) wsel.onchange=()=>{ const v=wsel.value; if(!v||v===rdvData[i].who) return; rdvData[i].who=v; rdvData[i].assignedBy="manuel"; if(rdvLiveOn) saveRdvOverride(rdvData[i].calendlyUri||rdvStableKey(rdvData[i]),{who:v,assignedBy:"manuel"}); else saveRdv(); toast("Rendez-vous réattribué à "+v); renderRdv(); openRdvDrawer(i); };
  // Compte-rendu : rédiger / modifier après coup (échange DOM in-place dans le tiroir)
  (function wireCr(){ const area=d.querySelector("#dCrArea"); if(!area) return;
    const ed=area.querySelector("#dCrEdit"); if(!ed) return;
    ed.onclick=()=>{ area.innerHTML=rdvCrEditor(rdvData[i]); refreshIcons(); const ta=area.querySelector("#dCrText"); if(ta) ta.focus();
      area.querySelector("#dCrSave").onclick=()=>{ const t=(area.querySelector("#dCrText").value||"").trim(); if(!t){ toast("Le compte-rendu est vide."); return; } saveRdvCr(i,t); toast("Compte-rendu enregistré"); openRdvDrawer(i); };
      area.querySelector("#dCrCancel").onclick=()=>{ area.innerHTML=rdvCrBlock(rdvData[i]); refreshIcons(); wireCr(); };
    };
  })();
  renderRdvTable();
}
function closeRdvDrawer(){ rdvOpenRow=-1; renderRdvTable(); }
/* Clé stable d'un RDV pour rattacher le compte-rendu du copilote : calendlyUri (live) sinon
   dérivée du client + date (démo). */
function rdvStableKey(r){ if(!r) return ""; return r.calendlyUri ? r.calendlyUri : ((r.client||"")+"|"+(r.day||"")+(r.mon||"")+"|"+(r.time||"")); }
var RDV_SECTEUR_TO_COP={ "Restauration":"Restauration","Médical / Pharma":"Santé / pharma","E-commerce / Retail":"E-commerce","Juridique / Notarial":"Autre","Luxe / Bijouterie":"Retail" };
function rdvVolumeToNum(v){ v=String(v||""); var n=40; if(/moins de 10/i.test(v)) n=8; else if(/10 à 30/i.test(v)) n=20; else if(/30 à 100/i.test(v)) n=60; else if(/plus de 100/i.test(v)) n=120; else { var m=v.match(/\d+/); if(m) n=+m[0]; } return Math.max(1, Math.min(200, n)); } /* borné aux limites du slider */
/* Vrai si le copilote contient un travail en cours (à ne pas écraser sans confirmation). */
function copHasWork(){ try{ return !!((copState.ans&&Object.keys(copState.ans).length)||(copState.notes||"").trim()||copState.company||copState.rdvKey); }catch(e){ return false; } }
/* ENTRÉE du workflow copilote : depuis un RDV, ouvre le copilote PRÉ-REMPLI et le LIE au RDV
   (le compte-rendu y sera rattaché au « Terminer »). */
function prepareRdvCopilot(i){
  var r=rdvData[i]; if(!r) return;
  // Ne pas écraser un copilote en cours sans confirmation (comme « Nouveau RDV »).
  if(copHasWork() && !confirm("Un copilote est en cours. Le remplacer par la préparation de « "+(r.client||"ce rendez-vous")+" » ? Les infos non « Terminées » seront perdues.")) return;
  copState=copBlank();
  copState.company=r.client||""; copState.contact=r.contact||""; copState.email=r.email||"";
  copState.rdvKey=rdvStableKey(r); copState.rdvLabel=(r.client||"")+" · "+(r.day||"")+" "+(r.mon||"")+(r.time?" "+r.time:"");
  var sec=RDV_SECTEUR_TO_COP[r.secteur]; if(sec) copState.ans.secteur=sec;
  if(r.volume) copState.sim.volume=rdvVolumeToNum(r.volume);
  copSave(); closeRdvDrawer(); showView("copilot"); renderCopilot();
  toast("Copilote préparé pour "+(r.client||"ce rendez-vous"));
}
function renderRdvStatus(){
  const bar=document.getElementById("rdvStatusBar"), leg=document.getElementById("rdvStatusLeg"); if(!bar||!leg) return;
  const a=teamAgg(rdvWho);
  const data=[["Honorés",a.honores,"#1D9E75"],["Annulés",a.annules,"#B4B2A9"],["No-show",a.noshow,"#E24B4A"]];
  const total=a.past||1;
  bar.innerHTML=""; leg.innerHTML=""; leg.className="statleg";
  data.forEach(d=>{ const pc=Math.round(d[1]/total*100);
    const seg=document.createElement("div"); seg.className="seg tipped"; seg.style.width=pc+"%"; seg.style.background=d[2];
    seg._tip='<div class="tt-h">'+d[0]+'</div><div class="tt-row"><span>Rendez-vous</span><b>'+d[1]+'</b></div><div class="tt-row"><span>Part</span><span>'+pc+' %</span></div>';
    bar.appendChild(seg);
    const r=document.createElement("div"); r.className="r";
    r.innerHTML='<span class="dot" style="background:'+d[2]+'"></span><span class="nm">'+d[0]+'</span><span class="ct">'+d[1]+'</span><span class="pc">'+pc+' %</span>';
    leg.appendChild(r); });
  setTxt("rdvStatusCap", a.past+" rendez-vous passés sur la période");
}
function rdvPeriodLabel(){ return {"7j":"les 7 derniers jours","30j":"les 30 derniers jours","3m":"les 3 derniers mois","6m":"les 6 derniers mois","12m":"les 12 derniers mois"}[rdvKey]||"la période"; }
/* ---- zoom des graphes : + / - (et molette) parcourent les échelles de temps ---- */
const RDV_ZOOM=["7j","30j","3m","6m","12m"];
const STAT_ZOOM=["hier","7j","30j","3m","6m","12m"];
function setSelectValue(id,val){ const s=document.getElementById(id); if(s){ s.value=val; if(s._ddSync) s._ddSync(); } }
function updateZoomBtns(order,key,outId,inId){ const i=order.indexOf(key), out=document.getElementById(outId), inn=document.getElementById(inId); if(out) out.disabled=(i>=order.length-1); if(inn) inn.disabled=(i<=0); }
function rdvZoom(dir){ let i=RDV_ZOOM.indexOf(rdvKey); if(i<0)i=RDV_ZOOM.indexOf("30j"); const ni=Math.min(RDV_ZOOM.length-1,Math.max(0,i+dir)); if(ni!==i){ rdvKey=RDV_ZOOM[ni]; setSelectValue("rdvRange",rdvKey); renderRdv(); } }
function statZoom(dir){ let i=STAT_ZOOM.indexOf(statKey); if(i<0)i=STAT_ZOOM.indexOf("30j"); const ni=Math.min(STAT_ZOOM.length-1,Math.max(0,i+dir)); if(ni!==i){ statKey=STAT_ZOOM[ni]; setSelectValue("statRange",statKey); const c=document.getElementById("statCustom"); if(c)c.classList.remove("show"); renderStats(); } }
function renderTeam(){
  const t=document.getElementById("rdvTeamBody"); if(!t) return; t.innerHTML="";
  const live=(typeof rdvLiveOn!=="undefined"&&rdvLiveOn);
  // Source : RÉELLE (comptée sur les vrais RDV par personne) quand Calendly est connecté, sinon DÉMO (TEAM_STATS).
  let rows;
  if(live){
    const by={};
    rdvData.forEach(r=>{ if(!r||!r.who) return; const s=by[r.who]||(by[r.who]={name:r.who,avenir:0,honores:0,annules:0,noshow:0,clients:null});
      if(r.st==="avenir") s.avenir++; else if(r.st==="honore") s.honores++; else if(r.st==="noshow") s.noshow++; else if(r.st==="annule"||r.st==="refuse") s.annules++; });
    rows=Object.keys(by).sort().map(k=>by[k]);
  } else {
    rows=Object.keys(TEAM_STATS).map(p=>Object.assign({name:p}, TEAM_STATS[p]));
  }
  if(!rows.length){ const tr=document.createElement("tr"); tr.innerHTML='<td colspan="6" style="color:var(--muted);padding:12px">Aucun rendez-vous sur la période.</td>'; t.appendChild(tr); }
  rows.forEach(s=>{
    const past=s.honores+s.annules+s.noshow, total=past+s.avenir;
    const pres=past?Math.round(s.honores/past*100):0;
    // Conversion : JAMAIS calculable ici (pas de source d'abonnement) -> toujours « exemple ».
    // En démo on montre un % illustratif étiqueté ; en réel il n'y a pas de chiffre -> « à brancher ».
    const convCell=(s.clients!=null)
      ? (s.honores?Math.round(s.clients/s.honores*100):0)+' % <span class="ex-tag">exemple</span><span class="frac">'+s.clients+' / '+s.honores+' honorés (démo)</span>'
      : '<span class="ex-tag">exemple</span><span class="frac">à brancher sur le back-office</span>';
    const tr=document.createElement("tr");
    tr.innerHTML='<td><span class="who"><span class="avatar xs">'+initials(s.name)+'</span>'+escHtml(s.name)+'</span></td>'+
      '<td style="text-align:center;font-weight:600">'+total+'</td>'+
      '<td style="text-align:center">'+s.avenir+'</td><td style="text-align:center">'+s.honores+'</td>'+
      '<td style="text-align:center">'+pres+' %<span class="frac">'+s.honores+' / '+past+' passés</span></td>'+
      '<td style="text-align:center;font-weight:600">'+convCell+'</td>';
    t.appendChild(tr);
  });
  var note=document.getElementById("rdvTeamNote");
  if(note){ note.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><div>'+(live
      ? 'Rendez-vous et présence <b>calculés sur vos vrais rendez-vous</b>. La <b>conversion reste un exemple</b> : elle nécessite les abonnements du back-office (source non branchée).'
      : 'Chiffres d\'<b>exemple</b> tant que Calendly n\'est pas connecté. Une fois connecté, rendez-vous et présence seront calculés sur vos vrais rendez-vous ; la conversion restera un exemple (source d\'abonnement du back-office).')+'</div>'; }
  setTxt("rdvTeamPeriod", rdvPeriodLabel());
  refreshIcons();
}
/* Synchronisation des vrais rendez-vous depuis Calendly (endpoint /api/calendly).
   Additif et à repli SÛR : en cas d'absence de clé, d'endpoint non configuré (501) ou
   d'erreur, on NE touche PAS à rdvData -> les données de démo restent affichées.
   Les données live sont gardées en mémoire (rafraîchies à chaque synchro / ouverture de
   la vue) ; elles ne remplacent jamais définitivement le jeu de démo dans le code.
   (rdvLiveOn est déclaré plus haut, près de saveRdv, pour garder le garde-fou de persistance.) */
/* Réattribution manuelle persistée : l'admin/lead commercial peut réassigner un RDV à un
   autre commercial. Pour les RDV Calendly (identifiés par calendlyUri), le choix est stocké
   à part et RÉ-APPLIQUÉ après chaque synchronisation (sinon la synchro écraserait le choix). */
const RDV_OVR_KEY="chaskis_rdv_overrides";
function loadRdvOverrides(){ try{ return JSON.parse(localStorage.getItem(RDV_OVR_KEY))||{}; }catch(e){ return {}; } }
function saveRdvOverride(uri, patch){ if(!uri) return; try{ const m=loadRdvOverrides(); m[uri]=Object.assign(m[uri]||{}, patch); localStorage.setItem(RDV_OVR_KEY, JSON.stringify(m)); }catch(e){} }
function applyRdvOverrides(){ const m=loadRdvOverrides(); rdvData.forEach(r=>{ if(!r) return; const k=(r.calendlyUri&&m[r.calendlyUri])?r.calendlyUri:(m[rdvStableKey(r)]?rdvStableKey(r):null); if(k) Object.assign(r, m[k]); }); } /* clé = calendlyUri sinon clé de repli (RDV live sans uri) */
function rdvOwnersList(){ const s=new Set(["Sarah","Marc","Jean-Christophe"]); rdvData.forEach(r=>{ if(r&&r.who) s.add(r.who); }); return Array.from(s); }
function syncCalendlyRdv(silent){
  const key=getStoredPublishKey();
  if(!key){ if(!silent) toast("Renseignez d'abord la clé d'accès (via le bouton Publier)."); return; }
  const btn=document.getElementById("rdvSyncBtn"); if(btn) btn.disabled=true;
  fetch("/api/calendly",{headers:{"Authorization":"Bearer "+key}})
    .then(r=>r.json().then(j=>({status:r.status,j})).catch(()=>({status:r.status,j:null})))
    .then(({status,j})=>{
      if(status===200 && j && j.ok && Array.isArray(j.rdv)){
        rdvData=j.rdv.map(r=>Object.assign({},r)); applyRdvOverrides(); rdvLiveOn=true; rdvOpenRow=-1; rdvSel.clear(); rdvPage=1; renderRdv();
        if(!silent){ let m="Rendez-vous synchronisés depuis Calendly ("+j.count+")"; if(j.truncated) m+=" — volume élevé, liste partielle"; toast(m); }
      } else if(status===501){ if(!silent) toast("Calendly pas encore connecté côté serveur — données de démonstration affichées."); }
      else if(status===401){ if(!silent) toast("Accès refusé : vérifiez la clé (bouton Publier)."); }
      else { if(!silent) toast((j&&j.error)?("Calendly : "+j.error):"Échec de la synchronisation Calendly."); }
    })
    .catch(()=>{ if(!silent) toast("Réseau indisponible pour Calendly."); })
    .finally(()=>{ const b=document.getElementById("rdvSyncBtn"); if(b) b.disabled=false; });
}
function renderRdv(){
  renderCalendars();
  const scoped = rdvWho==="all" ? rdvData : rdvData.filter(r=>r.who===rdvWho);
  // prochain rendez-vous (hero)
  const hero=document.getElementById("rdvHero");
  const ups=scoped.filter(r=>r.st==="avenir"), next=ups[0], others=ups.slice(1);
  if(hero){
    let html;
    if(next){
      const telC=(next.tel||"").replace(/[^+0-9]/g,"");
      let callBtn='';
      if(next.mode==="visio" && next.link){ callBtn='<a class="btn primary sm" id="rdvHeroCall" href="https://'+escHtml(next.link)+'" target="_blank" rel="noopener" title="'+escHtml(next.link)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>Rejoindre</a>'; }
      else if(telC){ callBtn='<a class="btn primary sm" id="rdvHeroCall" href="tel:'+telC+'" title="'+escHtml(next.tel)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z"/></svg>Appeler</a>'; }
      const cal=(d,m,t)=>'<div class="up-cal"><div class="up-cal-h"><span class="up-dn">'+d+'</span><span class="up-dm">'+m+'</span></div><span class="up-tt">'+t+'</span></div>';
      // sujet et interlocuteur sur DEUX lignes distinctes (tenaient mal sur une seule)
      const sub=o=>'<div class="up-ct" title="'+escHtml(o.sujet)+'">'+escHtml(o.sujet)+'</div>'+
        (o.contact?'<div class="up-ct up-ct2" title="'+escHtml(o.contact)+'">'+escHtml(o.contact)+'</div>':'');
      const who=o=>'<span class="up-who"><span class="avatar xs">'+initials(o.who)+'</span><span class="up-who-n">'+escHtml(o.who)+'</span></span>';
      // cartes côte à côte dans la bande. La "prochain" est juste plus large + mise en avant : sujet en badge, responsable + CTA en ligne (CTA à droite)
      let cards='<div class="up-card up-next">'+cal(next.day,next.mon,next.time)+
        '<div class="up-body">'+
        '<div class="up-top"><span class="up-tag">Prochain rendez-vous</span>'+(next.sujet?'<span class="up-badge">'+escHtml(next.sujet)+'</span>':'')+'</div>'+
        '<div class="up-c" title="'+escHtml(next.client)+'">'+escHtml(next.client)+'</div>'+
        (next.contact?'<div class="up-ct up-ct2" title="'+escHtml(next.contact)+'">'+escHtml(next.contact)+'</div>':'')+
        '<div class="up-foot">'+who(next)+(callBtn?'<div class="up-cta">'+callBtn+'</div>':'')+'</div>'+
        '</div></div>';
      cards+=others.slice(0,10).map(o=>'<div class="up-card">'+cal(o.day,o.mon,o.time)+
        '<div class="up-body">'+
        '<div class="up-c" title="'+escHtml(o.client)+'">'+escHtml(o.client)+'</div>'+
        '<div class="up-mid">'+sub(o)+'</div>'+
        '<div class="up-foot">'+who(o)+'</div>'+
        '</div></div>').join("");
      if(others.length>10) cards+='<div class="up-more">+'+(others.length-10)+'</div>';
      html='<div class="rdv-up-row">'+cards+'</div>';
    } else {
      html='<div class="rdv-up-row"><div class="up-card up-next" style="width:auto;min-width:260px"><div class="up-body"><div class="up-tag">Prochain rendez-vous</div><div class="up-c">Aucun rendez-vous à venir</div><div class="up-ct">Les nouvelles réservations apparaîtront ici.</div></div></div></div>';
    }
    hero.innerHTML=html;
  }
  // cartes (selon le périmètre sélectionné) — icônes colorées par sens
  const avenir=ups.length;
  const agg=teamAgg(rdvWho);
  const ICOL={blue:["#E6F1FB","#185FA5"],violet:["#EEEDFE","#534AB7"],green:["#E1F5EE","#0F6E56"],red:["#FCEBEB","#A32D2D"]};
  const cw=document.getElementById("rdvCards");
  if(cw){ cw.innerHTML="";
    const rpc=RDV_PERIODS[rdvKey]||RDV_PERIODS["30j"], curR=rpc.curR, prevR=rpc.prevR;
    const tR=(k,v)=>'<div class="tt-row"><span>'+k+'</span><b>'+v+'</b></div>';
    const tS=(k,v)=>'<div class="tt-row"><span>'+k+'</span><span>'+v+'</span></div>';
    const exTag='<span class="ex-tag">exemple</span>';
    // RDV à venir = compte RÉEL (ups.length) ; présence RÉELLE quand Calendly connecté (agg.live) ;
    // « cette semaine » (non calculée) et conversion (pas de source d'abonnement) = toujours « exemple ».
    const cards=[
      {k:"RDV à venir", v:String(avenir), ic:"cal", col:"blue", badge:(agg.live?"":trendChip(2,"")), d:(agg.live?"planifiés dès aujourd'hui":"vs "+prevR),
        tip:'<div class="tt-h">Rendez-vous à venir</div>'+tR("Planifiés dès aujourd'hui",avenir)},
      {k:"Cette semaine", v:"3", ic:"clock", col:"violet", ex:true, d:"à honorer d'ici dimanche",
        tip:'<div class="tt-h">Cette semaine</div>'+tR("À honorer d'ici dimanche","3")},
      {k:"Taux de présence", v:agg.presence+" %", ic:"check", col:"green", ex:!agg.live, d:agg.honores+" honorés sur "+agg.past+" passés",
        tip:'<div class="tt-h">Taux de présence</div>'+tS("Rendez-vous honorés",agg.honores+" / "+agg.past+" passés")+tS(curR,agg.presence+" %")},
      {k:"Taux de conversion", v:(agg.live?"—":agg.conversion+" %"), ic:"target", col:"red", ex:true, d:(agg.live?"à brancher sur le back-office":agg.clients+" clients sur "+agg.honores+" honorés"),
        tip:'<div class="tt-h">Taux de conversion</div>'+(agg.live?tS("Source","abonnements du back-office (non branchée)"):tS("Devenus clients",agg.clients+" / "+agg.honores+" honorés"))}
    ];
    cards.forEach(c=>{ const el=document.createElement("div"); el.className="statc tipped"; const col=ICOL[c.col];
      el.innerHTML='<div class="top"><div class="ic-badge" style="background:'+col[0]+';color:'+col[1]+';border-radius:9px">'+sIcon(c.ic)+'</div>'+(c.ex?exTag:(c.badge||""))+'</div><div class="k">'+c.k+'</div><div class="v">'+c.v+'</div>'+(c.d?'<div class="d">'+c.d+'</div>':'');
      el._tip=c.tip;
      cw.appendChild(el); }); }
  // graphe d'évolution
  const rp=RDV_PERIODS[rdvKey]||RDV_PERIODS["30j"]; const prev=rp.chart.vals.map(v=>Math.round(v*0.85));
  drawLine(document.getElementById("rdvChart"), rp.chart.labels, rp.chart.vals, prev, "Rendez-vous");
  const cur=rp.chart.vals.reduce((a,b)=>a+b,0), pre=prev.reduce((a,b)=>a+b,0), delta=pre?Math.round((cur-pre)/pre*100):0;
  const cb=document.getElementById("rdvChartBadge"); if(cb) cb.innerHTML=trendChip(delta)+' <span style="color:var(--muted)">vs période préc.</span>';
  const cl=document.getElementById("rdvChartLeg"); if(cl) cl.innerHTML='<span class="li"><span class="dot" style="background:#4BB3A4"></span><span class="li-k">Actuelle</span><span class="li-v">'+rp.curR+'</span></span><span class="li"><span class="dot dash" style="background:#c4c9c4"></span><span class="li-k">Précédente</span><span class="li-v">'+rp.prevR+'</span></span>';
  updateZoomBtns(RDV_ZOOM,rdvKey,"rdvZoomOut","rdvZoomIn");
  // répartition des statuts (passés) + raisons de non-conversion
  renderRdvStatus();
  renderBars("rdvReasons", RDV_REASONS, "#C47A5E");
  // Raisons de non-conversion = exemple (nécessite la source d'abonnement du back-office, non branchée).
  var rc=document.getElementById("rdvReasonsCap");
  if(rc) rc.innerHTML='<span class="ex-tag">exemple</span> Répartition illustrative — la conversion réelle nécessite les abonnements du back-office';
  renderTeam();
  // liste
  renderRdvTable();
}
function renderRdvAuto(){
  const bar=document.getElementById("rdvAutoBar"); if(!bar) return;
  bar.classList.toggle("on", rdvAuto.on);
  const sw=document.getElementById("rdvAutoSwitch"); if(sw){ sw.classList.toggle("on",rdvAuto.on); sw.setAttribute("aria-checked",rdvAuto.on?"true":"false"); }
  const cfg=bar.querySelector(".autorel-cfg"); if(cfg) cfg.classList.toggle("off", !rdvAuto.on);
  const dl=document.getElementById("rdvAutoDelay"); if(dl){ dl.value=rdvAuto.delay; if(dl._ddSync) dl._ddSync(); }
}
function eligibleVisibleRdv(){
  const f=(document.getElementById("rdvFilter")||{}).value||"all"; const out=[];
  rdvData.forEach((r,i)=>{ if(rdvWho!=="all"&&r.who!==rdvWho) return; if(f!=="all"&&r.st!==f) return;
    if(r.st!=="avenir" && r.st!=="refuse" && !(r.relance&&r.relance.sent)) out.push(i); });
  return out;
}
/* ---- dropdown maison : remplace un <select> natif par un menu stylé ---- */
function closeAllDD(){ document.querySelectorAll(".dd.open").forEach(d=>{ if(d._close) d._close(); }); }
function enhanceSelect(sel){
  if(!sel || sel.dataset.enhanced) return; sel.dataset.enhanced="1";
  const status = sel.classList.contains("statusel");
  const block = sel.classList.contains("formfsel");
  const dd=document.createElement("span"); dd.className="dd"+(status?" dd-status":"")+(block?" dd-block":"");
  const btn=document.createElement("button"); btn.type="button"; btn.className="dd-btn"+(status?" dd-status-btn":"");
  const lbl=document.createElement("span"); lbl.className="dd-lbl"; btn.appendChild(lbl);
  btn.insertAdjacentHTML("beforeend",'<svg class="dd-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>');
  const menu=document.createElement("div"); menu.className="dd-menu"+(status?" dd-status-menu":"");
  [...sel.options].forEach((op,i)=>{ const it=document.createElement("div"); it.className="dd-opt";
    var _S = (typeof stcOf==="function") ? stcOf(op.value) : RDV_STC[op.value];
    const dot = status && _S ? '<span class="dd-dot" style="background:'+_S.solid+'"></span>' : '';
    // couleurs du statut passées en variables : le hover et l'option sélectionnée reprennent le look du badge du tableau
    if(status && _S){ it.style.setProperty("--so-bg",_S.bg); it.style.setProperty("--so-c",_S.c); }
    else if(status && op.value==="" && sel.dataset.stcBg){ it.style.setProperty("--so-bg",sel.dataset.stcBg); it.style.setProperty("--so-c",sel.dataset.stcColor||""); } // option « déduit » : couleur du statut réel
    it.innerHTML=dot+'<span class="dd-t">'+op.text+'</span><svg class="dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    it.addEventListener("click",e=>{ e.stopPropagation(); if(sel.selectedIndex!==i){ sel.selectedIndex=i; sync(); sel.dispatchEvent(new Event("change",{bubbles:true})); } close(); });
    menu.appendChild(it); });
  function sync(){ const op=sel.options[sel.selectedIndex]; lbl.textContent=op?op.text:"";
    menu.querySelectorAll(".dd-opt").forEach((el,i)=> el.classList.toggle("sel", i===sel.selectedIndex));
    if(status){ var st=((typeof stcOf==="function")?stcOf(sel.value):RDV_STC[sel.value])||(sel.dataset.stcBg?{bg:sel.dataset.stcBg,c:sel.dataset.stcColor}:null);
      if(st){ btn.style.backgroundColor=st.bg; btn.style.color=st.c; btn.style.borderColor=st.bg; } else { btn.style.backgroundColor=""; btn.style.color=""; btn.style.borderColor=""; } } }
  sel.style.display="none"; sel.parentNode.insertBefore(dd,sel); dd.appendChild(btn); dd.appendChild(sel); sync(); sel._ddSync=sync;
  function place(){ const r=btn.getBoundingClientRect(); menu.style.minWidth=Math.max(r.width,150)+"px";
    const mw=menu.offsetWidth, mh=menu.offsetHeight; let left=r.left, top=r.bottom+6;
    if(left+mw>window.innerWidth-8) left=Math.max(8, r.right-mw);
    if(top+mh>window.innerHeight-8 && r.top-6-mh>8) top=r.top-6-mh;
    menu.style.left=left+"px"; menu.style.top=top+"px"; }
  function open(){ closeAllDD(); document.body.appendChild(menu); dd.classList.add("open"); place();
    requestAnimationFrame(()=>menu.classList.add("open"));
    document.addEventListener("mousedown",onDoc,true); document.addEventListener("keydown",onKey,true);
    window.addEventListener("scroll",close,true); window.addEventListener("resize",close); }
  function close(){ dd.classList.remove("open"); menu.classList.remove("open"); if(menu.parentNode) menu.parentNode.removeChild(menu);
    document.removeEventListener("mousedown",onDoc,true); document.removeEventListener("keydown",onKey,true);
    window.removeEventListener("scroll",close,true); window.removeEventListener("resize",close); }
  function onDoc(e){ if(!dd.contains(e.target) && !menu.contains(e.target)) close(); }
  function onKey(e){ if(e.key==="Escape") close(); }
  btn.addEventListener("click",e=>{ e.stopPropagation(); dd.classList.contains("open")?close():open(); });
  dd._close=close;
}
(function wireRdv(){
  const asw=document.getElementById("rdvAutoSwitch"); if(asw) asw.addEventListener("click",()=>{ rdvAuto.on=!rdvAuto.on; renderRdvAuto(); toast(rdvAuto.on?"Relance automatique activée ("+rdvAuto.delay+" sans réponse, démo)":"Relance automatique désactivée"); });
  const adl=document.getElementById("rdvAutoDelay"); if(adl){ adl.addEventListener("change",e=>{ rdvAuto.delay=e.target.value; if(rdvAuto.on) toast("Relance automatique : "+rdvAuto.delay+" sans réponse"); }); enhanceSelect(adl); }
  renderRdvAuto();
  const sc=document.getElementById("rdvScrim"); if(sc) sc.addEventListener("click",closeRdvDrawer);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape" && document.getElementById("rdvDrawer").classList.contains("show")) closeRdvDrawer(); });
  const add=document.getElementById("rdvAddCal"); if(add) add.addEventListener("click",openCalFlow);
  const rg=document.getElementById("rdvRange"); if(rg) rg.addEventListener("change",e=>{ rdvKey=e.target.value; renderRdv(); });
  const wo=document.getElementById("rdvWhoSel"); if(wo) wo.addEventListener("change",e=>{ rdvWho=e.target.value; rdvOpenRow=-1; rdvSel.clear(); rdvPage=1; renderRdv(); });
  const ft=document.getElementById("rdvFilter"); if(ft) ft.addEventListener("change",()=>{ rdvOpenRow=-1; rdvSel.clear(); rdvPage=1; renderRdvTable(); });
  const sb=document.getElementById("rdvSyncBtn"); if(sb) sb.addEventListener("click",()=>syncCalendlyRdv(false));
  if(wo){ const whos=[...new Set(rdvData.map(r=>r.who).filter(Boolean))]; wo.innerHTML='<option value="all">Toute l\'équipe</option>'+whos.map(w=>'<option value="'+escAttr(w)+'">'+escHtml(w)+'</option>').join(""); }
  enhanceSelect(wo); enhanceSelect(rg); enhanceSelect(ft);
  const sa=document.getElementById("rdvSelAll"); if(sa) sa.addEventListener("change",e=>{ rdvSel.clear(); if(e.target.checked) eligibleVisibleRdv().forEach(i=>rdvSel.add(i)); renderRdvTable(); });
  document.getElementById("rdvZoomOut")&&document.getElementById("rdvZoomOut").addEventListener("click",()=>rdvZoom(1));
  document.getElementById("rdvZoomIn")&&document.getElementById("rdvZoomIn").addEventListener("click",()=>rdvZoom(-1));
  const rc=document.getElementById("rdvChart"); if(rc){ let t=0; rc.addEventListener("wheel",e=>{ e.preventDefault(); const now=Date.now(); if(now-t<220)return; t=now; rdvZoom(e.deltaY>0?1:-1); },{passive:false}); }
  window.addEventListener("resize",()=>{ const v=document.getElementById("view-rdv"); if(v&&v.classList.contains("on")){ const rp=RDV_PERIODS[rdvKey]||RDV_PERIODS["30j"]; drawLine(document.getElementById("rdvChart"),rp.chart.labels,rp.chart.vals,rp.chart.vals.map(x=>Math.round(x*0.85)),"Rendez-vous"); } });
})();

/* ============================================================
   Statistiques module
   ============================================================ */
const STAT_BASE={ visits:4280, uniques:3110,
  goals:[["Commander une course","cart",214],["Réserver un appel","cal",86],["Ouverture du chatbot","bot",920]],
  pages:[["Accueil",2680],["Commander une course",1140],["Postuler",520],["Mobilité",410],["FAQ / tarifs",330]],
  sources:[["Recherche Google",2054],["Direct",1113],["LinkedIn",599],["Instagram",342],["Autres",172]],
  devices:[["Mobile",62],["Ordinateur",34],["Tablette",4]],
  regions:[["Genève",46],["Lausanne",27],["Nyon",14],["Riviera",8],["Autres",5]] };
const STAT_PERIODS={
  hier:{label:"hier",short:"hier",curR:"lun 29 juin",prevR:"dim 28 juin",mult:0.039,dur:"2:08",chart:{labels:["0-6h","6-9h","9-12h","12-15h","15-18h","18-23h"],vals:[8,22,46,38,34,20]}},
  "7j":{label:"7 derniers jours",short:"7 j",curR:"23-29 juin",prevR:"16-22 juin",mult:0.243,dur:"2:11",chart:{labels:["lun 23/6","mar 24/6","mer 25/6","jeu 26/6","ven 27/6","sam 28/6","dim 29/6"],vals:[140,165,150,172,158,120,135]}},
  "30j":{label:"30 derniers jours",short:"30 j",curR:"1-30 juin",prevR:"1-31 mai",mult:1,dur:"2:14",chart:{labels:["2-8 juin","9-15 juin","16-22 juin","23-30 juin"],vals:[820,1010,900,1300]}},
  "3m":{label:"3 derniers mois",short:"3 mois",curR:"avr-juin 2026",prevR:"janv-mars 2026",mult:3.05,dur:"2:13",chart:{labels:["avril","mai","juin"],vals:[3600,4100,4280]}},
  "6m":{label:"6 derniers mois",short:"6 mois",curR:"janv-juin 2026",prevR:"juil-déc 2025",mult:5.9,dur:"2:12",chart:{labels:["janv.","févr.","mars","avril","mai","juin"],vals:[2400,2900,3300,3600,4100,4280]}},
  "12m":{label:"12 derniers mois",short:"12 mois",curR:"juil 2025 - juin 2026",prevR:"juil 2024 - juin 2025",mult:11.2,dur:"2:15",chart:{labels:["juil.","août","sept.","oct.","nov.","déc.","janv.","févr.","mars","avr.","mai","juin"],vals:[1800,1600,2200,2600,2900,2700,2400,2900,3300,3600,4100,4280]}}
};
/* palette catégorielle distincte et sobre : familles de teintes vraiment séparées (pas de bleu/violet voisins) */
const DEV_COLORS=["#4BB3A4","#6B5BCC","#9aa3ad"];                       /* teal · violet · gris */
const REG_COLORS=["#4BB3A4","#6B5BCC","#9aa3ad","#D9A45B","#C77E8E"];  /* teal · violet · gris · sable · rose poudré */
let statKey="30j";
function fmtK(n){ return n>=1000 ? (n/1000).toFixed(1).replace(".",",")+"k" : ""+Math.round(n); }
function nfr(n){ return Math.round(n).toLocaleString("fr-FR"); }
function setTxt(id,t){ const e=document.getElementById(id); if(e) e.textContent=t; }
function sIcon(n){ const m={
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  user:'<path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.4a1 1 0 0 0 1 .8h9a1 1 0 0 0 1-.8L20 7H6"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bot:'<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V5m-4 16 4-2 4 2"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  check:'<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>' };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(m[n]||"")+'</svg>'; }
function trendChip(pct,unit){
  if(pct==null||pct==="") return "";
  if(unit===undefined) unit=" %";
  const cls=pct>0?"up":(pct<0?"down":"flat");
  const arrow=pct===0?"":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="'+(pct>0?"m6 15 6-6 6 6":"m6 9 6 6 6-6")+'"/></svg>';
  const sign=pct>0?"+":(pct<0?"−":"");
  return '<span class="trend '+cls+'">'+arrow+sign+Math.abs(pct)+unit+'</span>';
}
function drawLine(svg, labels, vals, prev, metricLabel){
  if(!svg) return;
  const W=Math.max(320, svg.clientWidth||700), H=Math.max(140, Math.round(svg.clientHeight)||176), padL=6,padR=6,padT=22,padB=26;
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  const all=prev?vals.concat(prev):vals, max=Math.max.apply(null,all)*1.14, n=vals.length;
  const X=i=> padL + (W-padL-padR)*(n===1?0.5:i/(n-1));
  const Y=v=> padT + (H-padT-padB)*(1-v/max);
  const toPath=arr=>{ let d=""; arr.forEach((v,i)=> d+=(i?" L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)); return d; };
  const area="M"+X(0).toFixed(1)+" "+(H-padB)+" "+vals.map((v,i)=>"L"+X(i).toFixed(1)+" "+Y(v).toFixed(1)).join(" ")+" L"+X(n-1).toFixed(1)+" "+(H-padB)+" Z";
  let extra=""; vals.forEach((v,i)=>{
    const anchor=i===0?"start":(i===n-1?"end":"middle"), lx=i===0?padL:(i===n-1?(W-padR):X(i));
    extra+='<circle class="pt" cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="3"/>'+
      '<text class="ptlbl" x="'+lx.toFixed(1)+'" y="'+(Y(v)-8).toFixed(1)+'" text-anchor="'+anchor+'">'+fmtK(v)+'</text>'+
      '<text class="axislbl" x="'+lx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="'+anchor+'">'+labels[i]+'</text>'+
      '<circle class="tipped" cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="13" fill="transparent"/>'; });
  const prevLine=prev? '<path d="'+toPath(prev)+'" fill="none" stroke="#c4c9c4" stroke-width="1.6" stroke-dasharray="4 4" stroke-linejoin="round" stroke-linecap="round"/>' : "";
  svg.innerHTML='<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4BB3A4" stop-opacity="0.22"/><stop offset="1" stop-color="#4BB3A4" stop-opacity="0"/></linearGradient></defs>'+
    '<path d="'+area+'" fill="url(#lg)"/>'+prevLine+'<path d="'+toPath(vals)+'" fill="none" stroke="#4BB3A4" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>'+extra;
  svg.querySelectorAll("circle.tipped").forEach((c,i)=>{ const v=vals[i], pv=prev?prev[i]:null;
    let html='<div class="tt-h">'+labels[i]+'</div><div class="tt-row"><span>'+(metricLabel||"Visites")+'</span><b>'+nfr(v)+'</b></div>';
    if(pv!=null){ const dl=pv?Math.round((v-pv)/pv*100):0;
      html+='<div class="tt-row"><span>Période préc.</span><span>'+nfr(pv)+'</span></div><div class="tt-delta '+(dl>=0?"up":"down")+'">'+(dl>=0?"▲ +":"▼ ")+Math.abs(dl)+' %</div>'; }
    c._tip=html; });
}
function renderSplit(barId,legId,data,colors,tipLabel){
  const bar=document.getElementById(barId), leg=document.getElementById(legId); if(!bar||!leg) return;
  bar.innerHTML=""; leg.innerHTML="";
  data.forEach((d,i)=>{ const c=colors[i%colors.length];
    const seg=document.createElement("div"); seg.className="seg tipped"; seg.style.width=d[1]+"%"; seg.style.background=c;
    seg._tip='<div class="tt-h">'+d[0]+'</div><div class="tt-row"><span>'+(tipLabel||"Part des visiteurs")+'</span><b>'+d[1]+' %</b></div>'; bar.appendChild(seg);
    const li=document.createElement("div"); li.className="li"; li.innerHTML='<span class="dot" style="background:'+c+'"></span>'+d[0]+' · '+d[1]+'%'; leg.appendChild(li); });
}
function renderStats(){
  const p=STAT_PERIODS[statKey]; if(!p) return; const m=p.mult;
  const cw=document.getElementById("statCards"), sh=p.short, trends=[12,8,-4];
  const SICOL=[["#E6F1FB","#185FA5"],["#EEEDFE","#534AB7"],["#E1F5EE","#0F6E56"]];
  if(cw){ cw.innerHTML="";
    [["Visites",nfr(STAT_BASE.visits*m),"eye"],["Visiteurs uniques",nfr(STAT_BASE.uniques*m),"user"],["Durée moyenne",p.dur,"clock"]]
    .forEach((c,i)=>{ const el=document.createElement("div"); el.className="statc"; const col=SICOL[i]||SICOL[0];
      // Chiffres du haut = exemples de démonstration (l'audience réelle mesurée est dans le panneau dédié plus bas).
      el.innerHTML='<div class="top"><div class="ic-badge" style="background:'+col[0]+';color:'+col[1]+';border-radius:9px">'+sIcon(c[2])+'</div><span class="ex-tag">exemple</span></div><div class="k">'+c[0]+' · '+sh+'</div><div class="v">'+c[1]+'</div>';
      cw.appendChild(el); }); }
  const prevVals=p.chart.vals.map(v=>Math.round(v*0.88));
  drawLine(document.getElementById("statChart"), p.chart.labels, p.chart.vals, prevVals);
  const cur=p.chart.vals.reduce((a,b)=>a+b,0), pre=prevVals.reduce((a,b)=>a+b,0), delta=pre?Math.round((cur-pre)/pre*100):0;
  const cp=document.getElementById("statChartPeriod"); if(cp) cp.innerHTML=trendChip(delta)+' <span style="color:var(--muted)">vs période préc.</span>';
  updateZoomBtns(STAT_ZOOM,statKey,"statZoomOut","statZoomIn");
  const cl=document.getElementById("statChartLeg"); if(cl) cl.innerHTML='<span class="li"><span class="dot" style="background:#4BB3A4"></span><span class="li-k">Actuelle</span><span class="li-v">'+p.curR+'</span></span><span class="li"><span class="dot dash" style="background:#c4c9c4"></span><span class="li-k">Précédente</span><span class="li-v">'+p.prevR+'</span></span>';
  const gw=document.getElementById("statGoals");
  if(gw){ gw.innerHTML=""; STAT_BASE.goals.forEach(g=>{ const row=document.createElement("div"); row.className="goal";
    const rate=(g[2]/STAT_BASE.visits*100).toFixed(1).replace(".",",");
    row.innerHTML='<div class="gi">'+sIcon(g[1])+'</div><div class="gl">'+g[0]+'</div><div class="gv">'+nfr(g[2]*m)+'</div><span class="grate">'+rate+' % des visites</span>'; gw.appendChild(row); }); }
  const pg=document.getElementById("statPages");
  if(pg){ pg.innerHTML=""; STAT_BASE.pages.forEach(x=>{ const tr=document.createElement("tr"); tr.innerHTML='<td>'+x[0]+'</td><td style="text-align:right;font-weight:600">'+nfr(x[1]*m)+'</td>'; pg.appendChild(tr); }); }
  const tot=STAT_BASE.sources.reduce((a,s)=>a+s[1],0);
  const sb=document.getElementById("statSources");
  if(sb){ sb.innerHTML=""; STAT_BASE.sources.forEach(s=>{ const tr=document.createElement("tr");
    tr.innerHTML='<td>'+s[0]+'</td><td style="text-align:right;font-weight:600">'+nfr(s[1]*m)+'</td><td style="text-align:right;color:var(--muted)">'+Math.round(s[1]/tot*100)+' %</td>'; sb.appendChild(tr); }); }
  setTxt("statSrcPeriod", p.label);
  renderSplit("statDevBar","statDevLeg",STAT_BASE.devices,DEV_COLORS);
  renderSplit("statRegBar","statRegLeg",STAT_BASE.regions,REG_COLORS);
  const h=document.getElementById("statHeat");
  if(h){ h.innerHTML=""; const inten=[3,2,1,1,2,4,9,16,26,34,44,40,30,33,42,38,28,22,20,16,13,10,7,4];
    const mx=Math.max.apply(null,inten), sum=inten.reduce((a,b)=>a+b,0), tv=STAT_BASE.visits*m, peak=inten.indexOf(mx);
    inten.forEach((v,hr)=>{ const c=document.createElement("div"); c.className="h tipped"; const a=v/mx;
      c.style.height=Math.max(3,Math.round(a*58))+"px"; c.style.background='rgba(75,179,164,'+(0.35+a*0.55).toFixed(2)+')';
      const vis=Math.round(v/sum*tv), share=Math.round(v/sum*100);
      c._tip='<div class="tt-h">'+hr+'h - '+((hr+1)%24)+'h</div><div class="tt-row"><span>Visites</span><b>'+nfr(vis)+'</b></div><div class="tt-sub">'+share+' % du trafic du jour</div>'+(hr===peak?'<div class="tt-peak">Heure de pointe</div>':'');
      h.appendChild(c); }); }
  renderStatsReal();
  renderStatsServer();
}
/* Panneau « audience réelle (tous les visiteurs) » : agrégat du collecteur maison /api/collect
   (sans cookie, stocké sur Blob). Auth via la clé/jeton admin ; repli SILENCIEUX (panneau masqué)
   si pas connecté / endpoint absent / stockage inactif -> on garde le panneau « cet appareil ».
   Les chiffres de démo au-dessus restent la vitrine. */
function statsDaysFromKey(){ try{ var m=/(\d+)\s*j/.exec(statKey||""); if(m) return Math.min(90,Math.max(1,+m[1])); }catch(e){} return 30; }
var _srvStats=null; /* cache 60s pour limiter les appels list (le panneau est re-rendu à chaque zoom/plage) */
function paintStatsServer(w,d){
  var PLBL={ "/":"Accueil","/index.html":"Accueil","/mobilite":"Mobilité","/mobilite.html":"Mobilité","/postuler":"Postuler","/postuler.html":"Postuler","/commander":"Commander","/commander.html":"Commander","/dashboard":"Tableau de bord","/dashboard.html":"Tableau de bord","/app.html":"Suivi de commande" };
  var pl=function(p){ return PLBL[p]||p; };
  var t=d.totals||{pageviews:0};
  var pagesRows=(d.topPages||[]).slice(0,8).map(function(x){ return '<tr><td>'+escHtml(pl(x.p))+'</td><td style="text-align:right;font-weight:600">'+x.n+'</td></tr>'; }).join("")||'<tr><td class="hint">Pas encore de données</td><td></td></tr>';
  var refRows=(d.topRefs||[]).slice(0,8).map(function(x){ return '<tr><td>'+escHtml(x.r||"Accès direct")+'</td><td style="text-align:right;font-weight:600">'+x.n+'</td></tr>'; }).join("")||'<tr><td class="hint">Accès direct</td><td></td></tr>';
  w.style.display="";
  w.innerHTML='<div class="pan-head"><h4><span class="hic teal"><i data-lucide="bar-chart-3"></i></span> Audience réelle (tous les visiteurs)</h4><span class="hint" style="margin:0">sans cookie · '+(d.rangeDays||30)+' j</span></div>'
    +'<p class="hint" style="margin:2px 0 12px">Mesure agrégée de <b>tous les visiteurs</b> du site en ligne, collectée par notre propre serveur (sans cookie, sans outil tiers). Les chiffres tout en haut restent des exemples de démonstration.</p>'
    +'<div style="display:flex;gap:26px;flex-wrap:wrap;margin-bottom:14px">'
      +'<div><div style="font-size:26px;font-weight:700;color:var(--ink,#1a1a1a)">'+nfr(t.pageviews||0)+'</div><div class="hint" style="margin:0">pages vues</div></div>'
      +'<div><div style="font-size:26px;font-weight:700;color:var(--ink,#1a1a1a)">'+nfr(d.avgDailyVisitors||0)+'</div><div class="hint" style="margin:0">visiteurs / jour (moy.)</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:24px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:220px"><div style="font-weight:600;margin-bottom:6px">Pages les plus vues</div><table class="tbl"><tbody>'+pagesRows+'</tbody></table></div>'
      +'<div style="flex:1;min-width:220px"><div style="font-weight:600;margin-bottom:6px">Provenance</div><table class="tbl"><tbody>'+refRows+'</tbody></table></div>'
    +'</div>'
    +(d.truncated?'<p class="hint" style="margin-top:10px">Historique long : jours les plus récents affichés (fenêtre '+(d.rangeDays||30)+' j).</p>':'');
  if(typeof refreshIcons==="function") refreshIcons();
}
function renderStatsServer(){
  var w=document.getElementById("statServerPan"); if(!w) return;
  var key=(typeof getStoredPublishKey==="function")?getStoredPublishKey():"";
  if(!key){ w.style.display="none"; w.innerHTML=""; return; }
  var days=statsDaysFromKey();
  if(_srvStats && _srvStats.days===days && (Date.now()-_srvStats.at)<60000){ paintStatsServer(w,_srvStats.data); return; } /* cache 60s */
  fetch("/api/collect?days="+days,{ headers:{ Authorization:"Bearer "+key } })
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(d){
      if(!d||!d.ok||d.provider!=="blob"){ w.style.display="none"; w.innerHTML=""; return; }
      _srvStats={ days:days, at:Date.now(), data:d };
      paintStatsServer(w,d);
    })
    .catch(function(){ w.style.display="none"; w.innerHTML=""; });
}
/* Panneau « vraie mesure sur cet appareil » : lit chaskis_analytics_v1 (écrit sans cookie par
   assets/js/analytics.js sur les vraies visites). Additif : les données de démo au-dessus
   restent la vitrine ; ici, la preuve que la mesure réelle fonctionne déjà (par appareil ;
   l'agrégation multi-visiteurs viendra avec la mise en ligne). */
function renderStatsReal(){
  const w=document.getElementById("statRealPan"); if(!w) return;
  let s=null; try{ s=JSON.parse(localStorage.getItem("chaskis_analytics_v1")); }catch(e){}
  if(!s||!Array.isArray(s.events)||!s.events.length){ w.style.display="none"; w.innerHTML=""; return; }
  w.style.display="";
  const ev=s.events, n=ev.length; const byPage={}, bySrc={}; let mob=0, desk=0;
  ev.forEach(function(e){ const p=e.p||"/"; byPage[p]=(byPage[p]||0)+1; const r=(e.r||"Accès direct"); bySrc[r]=(bySrc[r]||0)+1; if((e.w||0)>0){ if(e.w<768) mob++; else desk++; } });
  const top=(o,k)=>Object.keys(o).map(x=>[x,o[x]]).sort((a,b)=>b[1]-a[1]).slice(0,k);
  const PLBL={ "/":"Accueil","/index.html":"Accueil","/mobilite":"Mobilité","/mobilite.html":"Mobilité","/postuler":"Postuler","/postuler.html":"Postuler","/commander":"Commander","/commander.html":"Commander","/dashboard":"Tableau de bord","/dashboard.html":"Tableau de bord" };
  const pl=p=>PLBL[p]||p;
  const dt=ts=>{ try{ return new Date(ts).toLocaleDateString("fr-CH",{day:"2-digit",month:"short"}); }catch(e){ return "?"; } };
  const pagesRows=top(byPage,6).map(x=>'<tr><td>'+escHtml(pl(x[0]))+'</td><td style="text-align:right;font-weight:600">'+x[1]+'</td></tr>').join("");
  const srcRows=top(bySrc,6).map(x=>'<tr><td>'+escHtml(x[0])+'</td><td style="text-align:right;font-weight:600">'+x[1]+'</td></tr>').join("");
  const mobShare=(mob+desk)?Math.round(mob/(mob+desk)*100):0;
  w.innerHTML='<div class="pan-head"><h4><span class="hic teal"><i data-lucide="activity"></i></span> Mesuré réellement sur cet appareil</h4><span class="hint" style="margin:0">sans cookie</span></div>'
    +'<p class="hint" style="margin:2px 0 12px">Vraie mesure de fréquentation, déjà active (premier bloc concret du chantier Statistiques). Ici uniquement les visites de <b>cet appareil</b> ; l\'agrégation de tous les visiteurs viendra avec la mise en ligne. Les chiffres plus haut restent des exemples de démonstration.</p>'
    +'<div style="display:flex;gap:26px;flex-wrap:wrap;margin-bottom:14px">'
      +'<div><div style="font-size:26px;font-weight:700;color:var(--ink,#1a1a1a)">'+n+'</div><div class="hint" style="margin:0">page'+(n>1?"s":"")+' vue'+(n>1?"s":"")+'</div></div>'
      +'<div><div style="font-size:26px;font-weight:700;color:var(--ink,#1a1a1a)">'+mobShare+'%</div><div class="hint" style="margin:0">sur mobile</div></div>'
      +'<div><div style="font-size:15px;font-weight:600;color:var(--ink,#1a1a1a);margin-top:7px">'+dt(s.firstAt||ev[0].t)+' → '+dt(s.lastAt||ev[n-1].t)+'</div><div class="hint" style="margin:0">période mesurée</div></div>'
    +'</div>'
    +'<div style="display:flex;gap:24px;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:220px"><div style="font-weight:600;margin-bottom:6px">Pages les plus vues</div><table class="tbl"><tbody>'+pagesRows+'</tbody></table></div>'
      +'<div style="flex:1;min-width:220px"><div style="font-weight:600;margin-bottom:6px">Provenance</div><table class="tbl"><tbody>'+srcRows+'</tbody></table></div>'
    +'</div>';
  refreshIcons();
}
/* infobulle de données partagée (globale, pour toutes les vues) */
(function tipSystem(){
  const stip=document.createElement("div"); stip.id="stip"; document.body.appendChild(stip);
  document.addEventListener("mousemove",e=>{
    const t=e.target&&e.target.closest?e.target.closest(".tipped"):null;
    if(!t||!t._tip){ stip.classList.remove("show"); return; }
    stip.innerHTML=t._tip; stip.classList.add("show");
    let x=e.clientX+14, y=e.clientY-stip.offsetHeight-12;
    if(x+stip.offsetWidth>window.innerWidth-8) x=e.clientX-stip.offsetWidth-14;
    if(y<8) y=e.clientY+18;
    stip.style.left=x+"px"; stip.style.top=y+"px";
  });
})();
(function wireStats(){
  const sel=document.getElementById("statRange");
  if(sel) sel.addEventListener("change",e=>{ const v=e.target.value;
    document.getElementById("statCustom").classList.toggle("show", v==="custom");
    if(v!=="custom"){ statKey=v; renderStats(); } });
  enhanceSelect(sel);
  const apply=()=>{
    const ff=document.getElementById("statFrom"), tt=document.getElementById("statTo");
    const fv=ff&&ff.value, tv=tt&&tt.value; if(!fv||!tv) return;
    let d1=new Date(fv), d2=new Date(tv); if(isNaN(+d1)||isNaN(+d2)) return;
    if(d2<d1){ const tmp=d1; d1=d2; d2=tmp; }
    const days=Math.max(1, Math.round((d2-d1)/86400000)+1);
    const buckets=[["hier",1],["7j",7],["30j",30],["3m",90],["6m",180],["12m",365]];
    let key="30j", best=Infinity; buckets.forEach(b=>{ const diff=Math.abs(b[1]-days); if(diff<best){ best=diff; key=b[0]; } });
    statKey=key; renderStats();
    toast("Plage d'environ "+days+" j : période « "+((STAT_PERIODS[key]||{}).label||key)+" » affichée");
  };
  const f=document.getElementById("statFrom"), t=document.getElementById("statTo");
  if(f) f.addEventListener("change",apply); if(t) t.addEventListener("change",apply);
  document.getElementById("statZoomOut")&&document.getElementById("statZoomOut").addEventListener("click",()=>statZoom(1));
  document.getElementById("statZoomIn")&&document.getElementById("statZoomIn").addEventListener("click",()=>statZoom(-1));
  const sc=document.getElementById("statChart"); if(sc){ let t2=0; sc.addEventListener("wheel",e=>{ e.preventDefault(); const now=Date.now(); if(now-t2<220)return; t2=now; statZoom(e.deltaY>0?1:-1); },{passive:false}); }
  window.addEventListener("resize",()=>{ const sv=document.getElementById("view-stats"); if(sv&&sv.classList.contains("on")){ const p=STAT_PERIODS[statKey]; drawLine(document.getElementById("statChart"),p.chart.labels,p.chart.vals); } });
})();

/* ============================================================
   Boot
   ============================================================ */
function refreshIcons(){ try{ if(window.lucide) lucide.createIcons({ attrs:{ "stroke-width":1.5 } }); }catch(e){} }

/* ============================================================
   Utilisateurs & rôles (POC : login simulé via sélecteur de profil ;
   la vraie authentification arrivera avec un backend à la mise en ligne)
   ============================================================ */
const USERS_KEY="chaskis_users", ACCESS_KEY="chaskis_role_access", CAPS_KEY="chaskis_role_caps";
const DEFAULT_USERS=[
  {id:"alex", name:"Alex Moreira", email:"alex@chaskis.ch", role:"admin", color:"#534AB7"},
  {id:"sarah", name:"Sarah Benoit", email:"sarah@chaskis.ch", role:"commercial", color:"#0F6E56"},
  {id:"marc", name:"Marc Girard", email:"marc@chaskis.ch", role:"leadcommercial", color:"#9A6A15"},
  {id:"lea", name:"Léa Fontaine", email:"lea@chaskis.ch", role:"editor", color:"#C0407B"}
];
/* Rôles : source unique (ordre, libellé, couleur). Ajouter un rôle = une entrée ici + un preset dans DEFAULT_ROLE_CAPS. */
const ROLE_ORDER=["admin","commercial","leadcommercial","editor"];
const ROLES={ admin:{label:"Administrateur"}, commercial:{label:"Commercial"}, leadcommercial:{label:"Lead commercial"}, editor:{label:"Éditeur"} };
const ROLE_COLORS={ admin:"#534AB7", commercial:"#0F6E56", leadcommercial:"#2F6FE0", editor:"#C0407B" };
function roleColor(role){ return ROLE_COLORS[role]||"#534AB7"; }
function roleLabel(role){ return (ROLES[role]||ROLES.admin).label; }
/* Catalogue des capacités : la source unique de vérité des droits. Une capacité = une action précise.
   Ajouter un droit = ajouter une ligne dans le bon groupe, il apparaît partout (matrice + exceptions).
   La capacité "<module>.view" = "a accès à la page". Les autres = actions dans la page (à brancher ensuite). */
const CAP_GROUPS=[
  {mod:"dashboard", label:"Tableau de bord", ic:"layout-dashboard", caps:[["dashboard.view","Voir le tableau de bord"]]},
  {mod:"editor", label:"Édition du site", ic:"square-pen", caps:[["editor.view","Ouvrir l'éditeur"],["editor.edit","Modifier les contenus"],["editor.publish","Publier en ligne"]]},
  {mod:"structure", label:"Structure & stratégie", ic:"route", caps:[["structure.view","Voir la structure du site"]]},
  {mod:"media", label:"Médiathèque", ic:"image", caps:[["media.view","Voir la médiathèque"],["media.import","Importer un média"],["media.delete","Supprimer un média"]]},
  {mod:"versions", label:"Versions", ic:"history", caps:[["versions.view","Voir l'historique"],["versions.restore","Restaurer une version"]]},
  {mod:"chatbot", label:"Chatbot", ic:"bot", caps:[["chatbot.view","Voir le chatbot"],["chatbot.edit","Modifier la configuration"],["chatbot.sources","Gérer les sources"]]},
  {mod:"clients", label:"Clients", ic:"contact-round", caps:[["clients.view","Voir les clients et les demandes"],["clients.edit","Modifier une fiche / convertir une demande"]]},
  {mod:"rdv", label:"Rendez-vous", ic:"calendar", caps:[["rdv.view","Voir les rendez-vous"],["rdv.edit","Modifier une fiche"],["rdv.assign","Attribuer un commercial"],["rdv.relance","Gérer la relance automatique"],["rdv.export","Exporter la liste"]]},
  {mod:"copilot", label:"Copilote RDV", ic:"compass", caps:[["copilot.view","Utiliser le copilote"]]},
  {mod:"stats", label:"Statistiques", ic:"bar-chart-3", caps:[["stats.view","Voir les statistiques"],["stats.export","Exporter les statistiques"]]},
  {mod:"perf", label:"Performance", ic:"gauge", caps:[["perf.view","Voir la performance"]]},
  {mod:"affiliation", label:"Affiliation", ic:"handshake", caps:[["affiliation.view","Voir l'affiliation"],["affiliation.manage","Gérer les partenaires"]]},
  {mod:"users", label:"Utilisateurs & accès", ic:"users", caps:[["users.view","Voir les utilisateurs"],["users.manage","Gérer les comptes et les droits"]]}
];
const CAP_LABEL={}; CAP_GROUPS.forEach(g=>g.caps.forEach(c=>CAP_LABEL[c[0]]=c[1]));
function isCap(k){ return !!CAP_LABEL[k]; }
/* Preset par défaut de chaque rôle (l'admin a tout, géré à part). Éditable via la matrice. */
const DEFAULT_ROLE_CAPS={
  commercial:["dashboard.view","rdv.view","rdv.edit","copilot.view","clients.view","clients.edit"],
  leadcommercial:["dashboard.view","rdv.view","rdv.edit","rdv.assign","rdv.relance","rdv.export","copilot.view","stats.view","affiliation.view","clients.view","clients.edit"],
  editor:["dashboard.view","editor.view","editor.edit","structure.view","media.view","media.import","media.delete","versions.view","chatbot.view","chatbot.edit"]
};
const USER_COLORS=["#534AB7","#0F6E56","#9A6A15","#C0407B","#2F6FE0","#0EA5A0","#B0518F"];
let adminUsers=loadUsers(), roleCaps=loadRoleCaps();
function normUser(u){ if(!Array.isArray(u.grant)) u.grant=[]; if(!Array.isArray(u.deny)) u.deny=[]; return u; }
function loadUsers(){ try{ const s=JSON.parse(localStorage.getItem(USERS_KEY)); if(s&&s.length) return s.map(normUser); }catch(e){} return JSON.parse(JSON.stringify(DEFAULT_USERS)).map(normUser); }
function saveUsers(){ try{ localStorage.setItem(USERS_KEY, JSON.stringify(adminUsers)); }catch(e){} }
function loadRoleCaps(){
  const base=JSON.parse(JSON.stringify(DEFAULT_ROLE_CAPS));
  try{ const s=JSON.parse(localStorage.getItem(CAPS_KEY)); if(s) return Object.assign(base,s); }catch(e){}
  /* migration douce depuis l'ancien modèle "par page" -> capacités .view */
  try{ const old=JSON.parse(localStorage.getItem(ACCESS_KEY)); if(old){ Object.keys(old).forEach(r=>{ const set=new Set(base[r]||[]); (old[r]||[]).forEach(p=>set.add(p+".view")); set.add("dashboard.view"); base[r]=[...set]; }); } }catch(e){}
  return base;
}
function saveRoleCaps(){ try{ localStorage.setItem(CAPS_KEY, JSON.stringify(roleCaps)); }catch(e){} }
function currentUser(){ const id=loadUI().user; return adminUsers.find(u=>u.id===id)||adminUsers[0]; }
/* Moteur de droits : capacités effectives = preset du rôle + ajouts perso - retraits perso. L'admin a tout. */
function userCaps(u){ if(!u) return new Set(); if(u.role==="admin") return "*";
  const s=new Set(roleCaps[u.role]||[]); (u.grant||[]).forEach(k=>s.add(k)); (u.deny||[]).forEach(k=>s.delete(k)); return s; }
function can(cap, u){ u=u||currentUser(); const c=userCaps(u); return c==="*"||c.has(cap); }
function canView(name){ if(name==="dashboard"||name==="notes"||name==="progress") return true; return can(name+".view"); }
function userInitials(u){ return (u.name||"?").trim().split(/\s+/).map(w=>w[0]||"").slice(0,2).join("").toUpperCase(); }
function renderUserChip(){ const u=currentUser();
  const ava=document.getElementById("tbAva"); if(ava){ ava.textContent=userInitials(u); ava.style.setProperty("--c",roleColor(u.role)); }
  const n=document.getElementById("tbUserN"); if(n) n.textContent=u.name;
  const rr=document.getElementById("tbUserR"); if(rr) rr.textContent=roleLabel(u.role); }
function applyRole(){
  const admin=currentUser().role==="admin";
  document.querySelectorAll("#navlist .nav-i[data-view]").forEach(b=>{ b.style.display=canView(b.dataset.view)?"":"none"; });
  try{ applyProgressBadges(); }catch(e){}
  document.querySelectorAll("#navlist .nav-sep").forEach(s=>{ s.style.display=admin?"":"none"; });
  const app=document.querySelector(".app"); if(app) app.setAttribute("data-role", currentUser().role);
  renderUserChip(); applyEnvNav(); }
/* la vue Suivi technique (dev only) est masquée en environnement de production */
function applyEnvNav(){ const dev=getEnv()==="dev"; document.querySelectorAll("[data-devonly]").forEach(el=>{ const allowed = dev && (!el.dataset.view || canView(el.dataset.view)); el.style.display=allowed?"":"none"; });
  document.querySelectorAll("[data-prodonly]").forEach(el=>{ el.style.display = dev ? "none" : ""; }); }
function switchUser(id){ saveUI({user:id}); applyRole(); closeUserMenu();
  const cur=loadUI().view; showView(!cur||!canView(cur)?"dashboard":cur);
  toast("Connecté en tant que "+currentUser().name+" · "+roleLabel(currentUser().role)); }
function openUserMenu(){ closeUserMenu(); const btn=document.getElementById("tbUser"); if(!btn) return; const cur=currentUser();
  const m=document.createElement("div"); m.className="sb-user-menu"; m.id="sbUserMenu";
  m.innerHTML='<div class="sb-um-hd">Se connecter en tant que (démo)</div>'+adminUsers.map(u=>'<button class="sb-um-opt'+(u.id===cur.id?" on":"")+'" data-u="'+u.id+'"><span class="sb-um-ava" style="background:'+roleColor(u.role)+'">'+userInitials(u)+'</span><span class="sb-um-tx"><span class="sb-um-n">'+escHtml(u.name)+'</span><span class="sb-um-r">'+roleLabel(u.role)+'</span></span><svg class="sb-um-chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></button>').join("")+'<div class="sb-um-foot">La vraie authentification arrivera avec la mise en ligne.</div>';
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect(); m.style.top=(r.bottom+8)+"px"; m.style.right=Math.max(8,innerWidth-r.right)+"px";
  m.querySelectorAll("[data-u]").forEach(b=>b.addEventListener("click",()=>switchUser(b.dataset.u)));
  setTimeout(()=>document.addEventListener("mousedown",umOutside,true),0); }
function umOutside(e){ const m=document.getElementById("sbUserMenu"), btn=document.getElementById("tbUser"); if(m && !m.contains(e.target) && btn && !btn.contains(e.target)) closeUserMenu(); }
function closeUserMenu(){ const m=document.getElementById("sbUserMenu"); if(m) m.remove(); document.removeEventListener("mousedown",umOutside,true); }
function logout(){
  // Déconnexion RÉELLE si Clerk est chargé (auth active) ; sinon message démo (aperçu local/sans Clerk).
  try{ if(window.Clerk && typeof window.Clerk.signOut==="function"){ toast("Déconnexion…"); window.Clerk.signOut().then(function(){ try{ location.reload(); }catch(e){} }).catch(function(){ toast("Déconnexion impossible pour le moment."); }); return; } }catch(e){}
  toast("Déconnexion (démo) · connectez-vous via l'écran d'authentification en ligne.");
}

/* ---- environnement (dev / prod) + version du back-office ---- */
function getEnv(){ return loadUI().env==="prod" ? "prod" : "dev"; }
function setEnv(env){ env=(env==="prod")?"prod":"dev"; saveUI({env}); renderBuild(); document.querySelector(".app")?.setAttribute("data-env",env);
  applyEnvNav(); if(env==="prod" && (loadUI().view==="tech")) showView("dashboard");
  toast(env==="prod"?"Environnement : production (le site en ligne)":"Environnement : développement (brouillon de travail)"); }
function renderBuild(){ const el=document.getElementById("sbBuild"); if(!el) return; const env=getEnv();
  el.innerHTML='<span class="sb-build-env '+env+'">'+(env==="prod"?"prod":"dev")+'</span><span class="sb-build-v">v'+ADMIN_BUILD.version+'</span>';
  document.querySelector(".app")?.setAttribute("data-env",env); }
const BM_CHK='<svg class="bm-chk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
function openBuildMenu(){ closeBuildMenu(); const btn=document.getElementById("sbBuild"); if(!btn) return; const env=getEnv();
  const opts=[["dev","Développement","Brouillon de travail, non public"],["prod","Production","Le site réellement en ligne"]];
  const m=document.createElement("div"); m.className="build-menu"; m.id="buildMenu";
  m.innerHTML='<div class="bm-hd">Environnement</div>'+opts.map(o=>'<button class="bm-opt'+(o[0]===env?" on":"")+'" data-env="'+o[0]+'"><span class="bm-dot '+o[0]+'"></span><span class="bm-tx"><span class="bm-n">'+o[1]+'</span><span class="bm-s">'+o[2]+'</span></span>'+BM_CHK+'</button>').join("")
    +'<div class="bm-foot">Back-office Chaskis · v'+ADMIN_BUILD.version+'</div>';
  document.body.appendChild(m);
  const r=btn.getBoundingClientRect(); m.style.left=Math.max(8,r.left)+"px"; m.style.bottom=(innerHeight-r.top+8)+"px";
  m.querySelectorAll("[data-env]").forEach(b=>b.addEventListener("click",()=>{ setEnv(b.dataset.env); closeBuildMenu(); }));
  setTimeout(()=>document.addEventListener("mousedown",bmOutside,true),0); }
function bmOutside(e){ const m=document.getElementById("buildMenu"), btn=document.getElementById("sbBuild"); if(m && !m.contains(e.target) && btn && !btn.contains(e.target)) closeBuildMenu(); }
function closeBuildMenu(){ const m=document.getElementById("buildMenu"); if(m) m.remove(); document.removeEventListener("mousedown",bmOutside,true); }

/* ============================================================
   Panneau Réglages (tiroir droit)
   ============================================================ */
const NOTIF_DEFAULT={ weekly:true, newRdv:true, published:true };
function getNotif(){ return Object.assign({}, NOTIF_DEFAULT, loadUI().notif||{}); }
function setNotif(k,v){ const n=getNotif(); n[k]=v; saveUI({notif:n}); }
function setToggleRow(t,s,on,attrs){ return '<div class="set-row"><div class="set-row-tx"><div class="set-row-t">'+t+'</div>'+(s?'<div class="set-row-s">'+s+'</div>':'')+'</div><button class="switch'+(on?" on":"")+'" role="switch" aria-checked="'+on+'" '+attrs+'><span class="k"></span></button></div>'; }
function openSettings(){ renderSettings(); const sc=document.getElementById("setScrim"), dr=document.getElementById("setDrawer"); sc.classList.add("show"); dr.classList.add("show"); dr.setAttribute("aria-hidden","false"); document.addEventListener("keydown",setEsc); }
function closeSettings(){ const sc=document.getElementById("setScrim"), dr=document.getElementById("setDrawer"); if(sc) sc.classList.remove("show"); if(dr){ dr.classList.remove("show"); dr.setAttribute("aria-hidden","true"); } document.removeEventListener("keydown",setEsc); }
function setEsc(e){ if(e.key==="Escape") closeSettings(); }
function renderSettings(){ const b=document.getElementById("setBody"); if(!b) return; const u=currentUser(), env=getEnv(), n=getNotif(), mini=!!loadUI().mini;
  const envOpt=(k,name,s)=>'<button type="button" class="set-env-opt'+(env===k?" on":"")+'" data-env="'+k+'"><span class="set-env-dot '+k+'"></span><span class="set-env-tx"><span class="set-env-n">'+name+'</span><span class="set-env-s">'+s+'</span></span>'+BM_CHK.replace("bm-chk","set-env-chk")+'</button>';
  b.innerHTML=
    '<div class="set-sec"><div class="set-sec-t"><i data-lucide="user"></i>Profil</div>'
      +'<div class="set-prof"><span class="avatar" style="background:'+roleColor(u.role)+';color:#fff">'+userInitials(u)+'</span><div class="set-prof-tx"><div class="set-prof-n">'+escHtml(u.name)+'</div><div class="set-prof-r"><span class="dot" style="background:'+roleColor(u.role)+'"></span>'+roleLabel(u.role)+'</div></div></div>'
      +'<div class="set-fields"><div class="formf" style="margin:0"><label>Nom complet</label><input id="setName" value="'+escHtml(u.name)+'"></div><div class="formf" style="margin:0"><label>Email</label><input id="setEmail" value="'+escHtml(u.email||"")+'" placeholder="prenom@chaskis.ch"></div></div></div>'
    +'<div class="set-sec"><div class="set-sec-t"><i data-lucide="server"></i>Environnement</div><div class="set-env">'+envOpt("dev","Développement","Brouillon de travail, non public")+envOpt("prod","Production","Le site réellement en ligne")+'</div></div>'
    +'<div class="set-sec"><div class="set-sec-t"><i data-lucide="sliders-horizontal"></i>Préférences d\'affichage</div><div class="set-card">'
      +setToggleRow("Menu réduit par défaut","La barre latérale s\'ouvre repliée à la connexion",mini,'id="setMini"')
      +'<div class="set-row"><div class="set-row-tx"><div class="set-row-t">Langue d\'édition par défaut</div><div class="set-row-s">La langue montrée à l\'ouverture de l\'éditeur</div></div><div class="seg set-seg" id="setLang"><button data-l="fr" class="'+(currentLang==="fr"?"on":"")+'">FR</button><button data-l="en" class="'+(currentLang==="en"?"on":"")+'">EN</button></div></div>'
    +'</div></div>'
    +'<div class="set-sec"><div class="set-sec-t"><i data-lucide="bell"></i>Notifications <span style="color:var(--muted);font-weight:400">· démo</span></div><div class="set-card">'
      +setToggleRow("Résumé hebdomadaire","Un email chaque lundi avec l\'activité du site",n.weekly,'data-n="weekly"')
      +setToggleRow("Nouveau rendez-vous","Alerte à chaque prise de rendez-vous",n.newRdv,'data-n="newRdv"')
      +setToggleRow("Version publiée","Alerte quand une mise en ligne est faite",n.published,'data-n="published"')
    +'</div></div>'
    +'<div class="set-sec"><div class="set-sec-t"><i data-lucide="info"></i>À propos</div><div class="set-card">'
      +'<div class="set-about-v"><span class="set-about">Back-office Chaskis</span><b class="set-about" style="color:var(--ink)">v'+ADMIN_BUILD.version+'</b></div>'
      +'<div class="set-about-v"><span class="set-about">Environnement</span><span class="sb-build-env '+env+'" style="font-size:10.5px">'+(env==="prod"?"prod":"dev")+'</span></div>'
      +'<div class="set-about-v"><span class="set-about">Support technique</span><b class="set-about" style="color:var(--ink)">'+GAMMA+'</b></div>'
    +'</div><p class="set-about" style="margin:10px 2px 0">L\'authentification réelle (mots de passe, invitations) arrivera à la mise en ligne.</p></div>';
  // profil
  const nm=document.getElementById("setName"); if(nm) nm.addEventListener("input",()=>{ u.name=nm.value; saveUsers(); renderUserChip(); const pn=b.querySelector(".set-prof-n"); if(pn) pn.textContent=nm.value; });
  const em=document.getElementById("setEmail"); if(em) em.addEventListener("input",()=>{ u.email=em.value; saveUsers(); });
  // environnement
  b.querySelectorAll("[data-env]").forEach(o=>o.addEventListener("click",()=>{ setEnv(o.dataset.env); renderSettings(); }));
  // préférences
  const mn=document.getElementById("setMini"); if(mn) mn.addEventListener("click",()=>{ const on=!mn.classList.contains("on"); mn.classList.toggle("on",on); mn.setAttribute("aria-checked",on); app.classList.toggle("mini",on); saveUI({mini:on}); });
  b.querySelectorAll("#setLang button").forEach(bt=>bt.addEventListener("click",()=>{ currentLang=bt.dataset.l; saveUI({editLang:currentLang}); b.querySelectorAll("#setLang button").forEach(x=>x.classList.toggle("on",x===bt)); document.querySelectorAll("#lang button").forEach(x=>x.classList.toggle("on",x.dataset.lang===currentLang)); if(WIN&&typeof WIN.setLang==="function"){ try{ WIN.setLang(currentLang); }catch(e){} } if(typeof applyTextForLang==="function") applyTextForLang(); toast(currentLang==="en"?"Édition en anglais":"Édition en français"); }));
  // notifications
  b.querySelectorAll("[data-n]").forEach(sw=>sw.addEventListener("click",()=>{ const on=!sw.classList.contains("on"); sw.classList.toggle("on",on); sw.setAttribute("aria-checked",on); setNotif(sw.dataset.n,on); }));
  refreshIcons();
}

(function boot(){
  const ui=loadUI();
  applyRole();
  const tb=document.getElementById("tbUser"); if(tb) tb.addEventListener("click",openUserMenu);
  const lo=document.getElementById("sbLogout"); if(lo) lo.addEventListener("click",logout);
  renderBuild(); const sbb=document.getElementById("sbBuild"); if(sbb) sbb.addEventListener("click",openBuildMenu);
  const setBtn=document.getElementById("settingsBtn"); if(setBtn) setBtn.addEventListener("click",openSettings);
  const setCl=document.getElementById("setClose"); if(setCl) setCl.addEventListener("click",closeSettings);
  const setSc=document.getElementById("setScrim"); if(setSc) setSc.addEventListener("click",closeSettings);
  if(ui.editLang==="en"||ui.editLang==="fr") currentLang=ui.editLang;
  applyResponsiveNav();
  refreshIcons();
  renderSecList();
  if(changeCount(draft).total) setSaved();
  updateDashboard();
  let start = ui.view && TITLES[ui.view] ? ui.view : "dashboard";
  if(!canView(start)) start = "dashboard";
  showView(start);
  seedMediaStatic().then(()=>{ renderAllMedia(); updateDashboard(); });
})();
