/* A página de entrada do rendorium.com.
   -------------------------------------
   Servida pelo worker quando o pedido chega pelo domínio raiz (ou www) —
   a app vive em app.rendorium.com e não se mistura. É uma página escrita à
   mão, sem dependências, com a mesma cara da app: quem clica em "Abrir a
   app" não pode sentir que mudou de produto.

   O estudo de mercado mandou aqui: a aquisição faz-se por conteúdo e
   ferramentas fiscais, e esta página é a fundação onde isso vai assentar. */

const APP = 'https://app.rendorium.com';

export function paginaLanding() {
  const html = `<!doctype html>
<html lang="pt"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Rendorium — o teu portefólio de arrendamento, arrumado</title>
<meta name="description" content="Imóveis, contratos, rendas, créditos e IRS num só sítio. Feito para senhorios portugueses com 1 a 10 imóveis. Grátis para começar.">
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
.hero{padding:52px 0 34px;max-width:640px}
.hero h1{font-size:clamp(30px,5.4vw,44px);line-height:1.12;letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
.hero p{font-size:17.5px;color:var(--muted);margin:0 0 24px;max-width:56ch}
.cta{display:flex;gap:10px;flex-wrap:wrap}
.faixa{font-size:12.5px;color:var(--muted);margin-top:14px}
.grelha{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;padding:22px 0 8px}
.cartao{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 19px}
.cartao b{display:block;font-size:15px;margin-bottom:5px}
.cartao p{margin:0;font-size:14px;color:var(--muted)}
h2{font-size:22px;letter-spacing:-.01em;margin:44px 0 4px}
.sub{color:var(--muted);font-size:14.5px;margin:0 0 14px}
.planos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;max-width:640px}
.plano{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
.plano.on{border-color:var(--accent)}
.plano .nome{font-weight:750}
.plano .preco{font-size:26px;font-weight:750;margin:6px 0 2px}
.plano .preco small{font-size:13px;font-weight:500;color:var(--muted)}
.plano ul{margin:10px 0 0;padding-left:18px;font-size:14px;color:var(--muted)}
.plano li{margin-bottom:6px}
.nota{background:var(--tint);border:1px solid var(--line);border-radius:14px;padding:16px 18px;
  font-size:14px;color:var(--muted);margin:34px 0 0;max-width:640px}
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
    <p>Imóveis, contratos, rendas, créditos e o IRS num só sítio — feito para senhorios
    portugueses que hoje gerem tudo em Excel, papel e memória.</p>
    <div class="cta">
      <a class="btn primary" href="${APP}">Criar conta grátis</a>
      <a class="btn" href="${APP}">Abrir a app</a>
    </div>
    <div class="faixa">Funciona no browser, no telemóvel e como app instalada. Sem cartão de crédito.</div>
  </section>

  <section class="grelha">
    <div class="cartao"><b>Rendas sem esforço</b><p>O contrato gera o movimento planeado; todos os meses, um toque em «Confirmar» e a renda fica registada.</p></div>
    <div class="cartao"><b>Contratos e inquilinos</b><p>Fichas, prazos, caução e um contrato em PDF pronto a rever — com os teus dados e os do inquilino já lá dentro.</p></div>
    <div class="cartao"><b>Comproprietários a sério</b><p>Casa herdada a meias? Quotas, contas entre proprietários e partilha segura entre contas — cada um vê o que lhe toca.</p></div>
    <div class="cartao"><b>Créditos à habitação</b><p>Prestações com juros, capital e imposto do selo separados, amortizações e o plano até ao fim.</p></div>
    <div class="cartao"><b>Pronto para o IRS</b><p>Rendas e despesas organizadas por imóvel ao longo do ano — quando chegar o Anexo F, está tudo à mão.</p></div>
    <div class="cartao"><b>Os dados são teus</b><p>Cópias de segurança num toque, exportação em CSV, e a conta apaga-se quando quiseres. Sem letras pequenas.</p></div>
  </section>

  <h2>Planos</h2>
  <p class="sub">Simples de propósito: paga-se pelo tamanho do portefólio, não por truques.</p>
  <section class="planos">
    <div class="plano on">
      <div class="nome">Gratuito</div>
      <div class="preco">0 €<small> /mês</small></div>
      <ul><li>Até 3 imóveis</li><li>Movimentos e créditos</li><li>Cópias e exportação</li></ul>
    </div>
    <div class="plano">
      <div class="nome">Plus</div>
      <div class="preco">Em breve</div>
      <ul><li>Até 10 imóveis</li><li>Contratos e movimentos planeados</li><li>Indicadores e estatísticas</li></ul>
    </div>
  </section>

  <div class="nota"><b>Fase experimental:</b> neste momento está tudo aberto e é grátis para toda a gente.
  Quando os planos entrarem em vigor, avisamos dentro da app com pelo menos 30 dias de antecedência —
  e nada do que criaste é apagado ou fica inacessível.</div>

  <footer>
    <span>© ${new Date().getFullYear()} Rendorium</span>
    <a href="${APP}">A app</a>
    <span>Termos e privacidade: dentro da app, em Definições → Aviso legal</span>
  </footer>
</div>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // a landing pode viver em cache: muda quando se publica, não por pedido
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
