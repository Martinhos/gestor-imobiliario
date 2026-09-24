/* ================= TEMA E ÁREA SEGURA =================
   A aparência que depende do aparelho: o tema claro, escuro ou automático
   (isDark, applyTheme, setTheme), as duas paletas dos gráficos (PAL_LIGHT e
   PAL_DARK, trocadas dentro do próprio PAL) e as margens da área segura
   (fitInsets, e o __setInsets que o wrapper Android chama). */
const PAL_LIGHT=['#2f7d5b','#7aa9d6','#d6a34a','#c56b68','#8a7bb8','#5aa8a0','#b58a5e','#9aa7a1','#6f8f76','#c2926a','#7e93b8','#a4b56c'];
const PAL_DARK=['#5ee0a8','#7aa9ff','#ffc35c','#ff8a80','#c89bff','#5ad0d8','#f0a06a','#b8c2d6','#8fd0a0','#ffb08a','#9fb8ff','#d4e07a'];
const PAL=PAL_LIGHT.slice();

/* ================= ÁREA SEGURA ================= */
/* O wrapper Android injeta os valores exatos. Fora dele, medimos o env() e,
   se der zero num ecrã sem barra do browser, assumimos uma barra de estado.
   Devolve: nada — quando é preciso, escreve a variável CSS --inset-top no <html>. */
function fitInsets(){
  const el=document.documentElement;
  if(window.__nativeInsets)return;
  let envTop=0;
  try{
    const d=document.createElement('div');
    d.style.cssText='position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);visibility:hidden';
    document.body.appendChild(d);envTop=d.offsetHeight;d.remove();
  }catch(e){}
  if(envTop>0)return;
  let full=false;
  try{full=window.screen&&Math.abs(screen.height-window.innerHeight)<52}catch(e){}
  if(full)el.style.setProperty('--inset-top','28px');
}
/* chamada pelo wrapper Android com as margens exatas da área segura (px); passa-as
   às variáveis CSS e marca-as como nativas, para o fitInsets deixar de adivinhar.
   Recebe: t — a margem de topo (número, px); b — a de fundo; l — a da esquerda; r — a da direita.
   Devolve: nada — escreve as variáveis CSS --inset-* no <html>. */
window.__setInsets=function(t,b,l,r){
  window.__nativeInsets=1;
  const s=document.documentElement.style;
  s.setProperty('--inset-top',t+'px');
  s.setProperty('--inset-bottom',b+'px');
  s.setProperty('--inset-left',l+'px');
  s.setProperty('--inset-right',r+'px');
};

/* ================= TEMA ================= */
/* uma so MediaQueryList, guardada: registar o ouvinte numa criada de fresco
   deixa-a sem referencias, e ha motores que a recolhem e param de avisar */
let _mq=null;
// a tal MediaQueryList do modo escuro, criada uma vez e reutilizada; se o matchMedia
// falhar, devolve um substituto inerte para o resto do código não ter de testar.
// Devolve: a MediaQueryList de '(prefers-color-scheme: dark)', ou o tal substituto inerte.
const mq=()=>{
  if(_mq)return _mq;
  try{_mq=window.matchMedia('(prefers-color-scheme: dark)')}
  catch(e){_mq={matches:false,addEventListener(){},addListener(){}}}
  return _mq;
};
// o tema efetivo é escuro? Sim com 'dark' explícito, ou em automático quando o sistema está escuro.
// Devolve: true se o tema efetivo for escuro; false caso contrário.
function isDark(){const t=db.settings.theme;return t==='dark'||(t!=='light'&&mq().matches)}
/* aplica o tema efetivo à página: classe .dark no <html>, paleta dos gráficos
   trocada dentro do próprio array PAL (quem lhe guarda referência vê as cores
   novas), e meta theme-color / color-scheme atualizados — a razão de o modo
   automático não fixar o color-scheme está na nota lá dentro.
   Devolve: nada — aplica o tema à página (classe, paleta e metas). */
function applyTheme(){
  const d=isDark();
  document.documentElement.classList.toggle('dark',d);
  PAL.splice(0,PAL.length,...(d?PAL_DARK:PAL_LIGHT));
  const m=document.getElementById('metaTheme');if(m)m.content=d?'#161a3a':'#1a3a2c';
  /* No modo automático não se fixa o esquema. Fixá-lo era um ciclo vicioso: o
     browser dizia "claro", a app escrevia color-scheme:light, e isso confirma
     ao browser que a página não sabe ser escura — deixando-o sem razão para
     mudar de ideias. Em automático dizemos que sabemos os dois e quem decide
     é ele; só uma escolha explícita fixa um deles. */
  const esq=db.settings.theme==='auto'?'light dark':(d?'dark':'light');
  const cs=document.querySelector('meta[name=color-scheme]');if(cs)cs.content=esq;
  /* «only light» e não «light»: com o telemóvel em modo escuro, o Chrome
     Android («tema escuro para sites») escurece à força páginas que se
     declaram só-claras — o «modo claro que não é bem claro». O only é o
     opt-out documentado desse escurecimento; no escuro não é preciso. */
  try{document.documentElement.style.colorScheme=(esq==='light'?'only light':esq)}catch(e){}
}
// escolhe o tema ('light', 'dark' ou 'auto'), grava nas definições e aplica já.
// Recebe: t — o tema a usar: 'light', 'dark' ou 'auto'.
// Devolve: nada — grava nas definições, aplica o tema e redesenha a vista.
function setTheme(t){db.settings.theme=t;save();applyTheme();render()}
/* o Safari so ganhou addEventListener em MediaQueryList na versao 14: sem o
   addListener antigo, os iPhones mais velhos nunca sabiam da mudanca */
(function(){
  const q=mq(),ao=()=>{if(db.settings.theme==='auto'){applyTheme();render()}};
  try{if(q.addEventListener)q.addEventListener('change',ao);else if(q.addListener)q.addListener(ao)}catch(e){}
})();
