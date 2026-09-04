/* A página de entrada do rendorium.com.
   -------------------------------------
   Servida pelo worker quando o pedido chega pelo domínio raiz (ou www) —
   a app vive em app.rendorium.com e não se mistura. É uma página escrita à
   mão, sem dependências, com a mesma cara da app: quem clica em "Abrir a
   app" não pode sentir que mudou de produto.

   O Rendorium é um projeto pessoal, sem planos nem pagamentos — a página
   diz o que a ferramenta faz e mais nada. As funcionalidades vivem num
   carrossel: no telemóvel desliza-se, no computador há setas e pontos. */

const APP = 'https://app.rendorium.com';

// Constrói a página inteira (HTML, estilos e o guião do carrossel, tudo
// inline) e devolve-a como Response com uma hora de cache — a página muda
// quando se publica, não por pedido.
// Devolve: uma Response HTML com a página completa e uma hora de cache.
export function paginaLanding() {
  const html = `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Rendorium — o teu portefólio de arrendamento, arrumado</title>
<meta name="description" content="Imóveis, contratos, rendas, créditos e IRS num só sítio. Um projeto pessoal para senhorios portugueses.">
<meta property="og:title" content="Rendorium">
<meta property="og:description" content="O teu portefólio de arrendamento, arrumado. Imóveis, contratos, rendas e IRS num só sítio.">
<meta property="og:url" content="https://rendorium.com">
<link rel="icon" href="${APP}/icon-192.png">
<link rel="canonical" href="https://rendorium.com">
<style>
:root{color-scheme:light dark;
  --bg:#f7f8fa;--card:#fff;--ink:#17221d;--muted:#5a635e;--line:#e7ebe8;
  --accent:#244c3b;--accent-ink:#fff;--tint:#eef4f0;--chip:#f2f4f3}
@media(prefers-color-scheme:dark){:root{
  --bg:#12141b;--card:#1b1e28;--ink:#eef0f6;--muted:#9aa3b8;--line:#2b3040;
  --accent:#5ee0a8;--accent-ink:#0b1410;--tint:#18211c;--chip:#272b38}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:0 22px}
header{display:flex;align-items:center;gap:12px;padding:20px 0}
.logo{width:38px;height:38px;border-radius:11px;background:var(--accent);color:var(--accent-ink);
  display:grid;place-items:center;font-weight:800;font-size:19px}
.marca{font-weight:750;font-size:17px;letter-spacing:-.01em}
.spacer{flex:1}
a.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;
  border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--ink);
  text-decoration:none;font-weight:650;font-size:14.5px;min-height:44px}
a.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.hero{padding:60px 0 40px;max-width:660px}
.hero h1{font-size:clamp(30px,5.4vw,46px);line-height:1.1;letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
.hero p{font-size:17.5px;color:var(--muted);margin:0 0 26px;max-width:56ch}
.cta{display:flex;gap:10px;flex-wrap:wrap}
.faixa{font-size:12.5px;color:var(--muted);margin-top:14px}

/* ---- o carrossel das funcionalidades ---- */
.caro{position:relative;margin:28px 0 4px}
.tira{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;
  scrollbar-width:none;padding:4px 2px 6px;scroll-behavior:smooth}
.tira::-webkit-scrollbar{display:none}
.cartao{flex:0 0 min(300px,82vw);scroll-snap-align:start;background:var(--card);
  border:1px solid var(--line);border-radius:15px;padding:20px 21px;min-height:150px}
.cartao b{display:block;font-size:15.5px;margin-bottom:6px}
.cartao p{margin:0;font-size:14px;color:var(--muted);line-height:1.55}
.seta{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:40px;height:40px;
  border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);
  font-size:19px;line-height:1;cursor:pointer;display:grid;place-items:center;
  box-shadow:0 2px 10px rgba(0,0,0,.08)}
.seta[disabled]{opacity:.35;cursor:default}
.seta.esq{left:-14px}.seta.dir{right:-14px}
@media(hover:none),(max-width:700px){.seta{display:none}}
.pontos{display:flex;gap:7px;justify-content:center;padding:10px 0 0}
.pontos i{width:7px;height:7px;border-radius:50%;background:var(--line);transition:background .2s,width .2s}
.pontos i.on{background:var(--accent);width:18px;border-radius:99px}

.nota{background:var(--tint);border:1px solid var(--line);border-radius:15px;padding:18px 20px;
  font-size:14.5px;color:var(--muted);margin:36px 0 0;max-width:640px}
.nota b{color:var(--ink)}
footer{margin-top:56px;padding:22px 0 40px;border-top:1px solid var(--line);
  font-size:13px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap}
footer a{color:var(--muted)}
</style></head><body>
<div class="wrap">
  <header>
    <span class="logo">R</span><span class="marca">Rendorium</span>
    <span class="spacer"></span>
    <a class="btn" href="${APP}">Entrar</a>
  </header>

  <section class="hero">
    <h1>O teu portefólio de arrendamento, arrumado.</h1>
    <p>Imóveis, contratos, rendas, créditos e o IRS num só sítio — para senhorios
    que hoje gerem tudo em Excel, papel e memória.</p>
    <div class="cta">
      <a class="btn primary" href="${APP}">Criar conta</a>
      <a class="btn" href="${APP}">Abrir a app</a>
    </div>
    <div class="faixa">Funciona no browser, no telemóvel e como app instalada.</div>
  </section>

  <div class="caro">
    <button class="seta esq" id="sEsq" aria-label="Anterior">&#8249;</button>
    <div class="tira" id="tira">
      <div class="cartao"><b>Rendas sem esforço</b><p>O contrato gera o movimento planeado; todos os meses, um toque em «Confirmar» e a renda fica registada.</p></div>
      <div class="cartao"><b>Contratos e inquilinos</b><p>Fichas, prazos, caução e um contrato em PDF pronto a rever — com os teus dados e os do inquilino já lá dentro.</p></div>
      <div class="cartao"><b>Comproprietários a sério</b><p>Casa herdada a meias? Quotas, contas entre proprietários e partilha segura entre contas — cada um vê o que lhe toca.</p></div>
      <div class="cartao"><b>Créditos à habitação</b><p>Prestações com juros, capital e imposto do selo separados, amortizações e o plano até ao fim.</p></div>
      <div class="cartao"><b>Pronto para o IRS</b><p>Rendas e despesas organizadas por imóvel ao longo do ano — quando chegar o Anexo F, está tudo à mão.</p></div>
      <div class="cartao"><b>Os dados são teus</b><p>Cópias de segurança num toque, exportação em CSV, e a conta apaga-se quando quiseres. Sem letras pequenas.</p></div>
    </div>
    <button class="seta dir" id="sDir" aria-label="Seguinte">&#8250;</button>
    <div class="pontos" id="pontos" aria-hidden="true"></div>
  </div>

  <div class="nota"><b>Um projeto pessoal.</b> O Rendorium nasceu para gerir o meu próprio
  portefólio e está aberto a quem lhe quiser dar uso. Está em evolução constante — o que
  criares é teu, exporta-se quando quiseres, e a conta apaga-se num toque.</div>

  <footer>
    <span>© ${new Date().getFullYear()} Rendorium</span>
    <a href="${APP}">A app</a>
    <span>Termos e privacidade: dentro da app, em Definições → Aviso legal</span>
  </footer>
</div>
<script>
(function () {
  var tira = document.getElementById('tira');
  var pontos = document.getElementById('pontos');
  var esq = document.getElementById('sEsq'), dir = document.getElementById('sDir');
  var cartoes = tira.children.length;
  for (var i = 0; i < cartoes; i++) pontos.appendChild(document.createElement('i'));
  var passo = function () { return tira.children[0].offsetWidth + 12; };
  var pinta = function () {
    var i = Math.round(tira.scrollLeft / passo());
    var fim = tira.scrollLeft >= tira.scrollWidth - tira.clientWidth - 4;
    [].forEach.call(pontos.children, function (p, j) { p.className = j === i ? 'on' : ''; });
    esq.disabled = tira.scrollLeft < 4;
    dir.disabled = fim;
  };
  esq.onclick = function () { tira.scrollBy({ left: -passo(), behavior: 'smooth' }); };
  dir.onclick = function () { tira.scrollBy({ left: passo(), behavior: 'smooth' }); };
  tira.addEventListener('scroll', pinta, { passive: true });
  window.addEventListener('resize', pinta);
  pinta();
})();
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // a landing pode viver em cache: muda quando se publica, não por pedido
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
