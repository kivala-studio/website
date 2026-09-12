const Arrow = () => <span aria-hidden="true">↗</span>;

function Brand() {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>invest<span className="brand-dot">.</span>ao</span>;
}

function Chart({ small = false }: { small?: boolean }) {
  return <svg className={small ? "mini-chart" : "portfolio-chart"} viewBox="0 0 320 130" fill="none" aria-hidden="true">{!small && <path d="M0 30H320M0 75H320M0 120H320" stroke="currentColor" opacity=".09" />}<path d="M0 112L16 105L29 111L42 91L55 98L70 77L83 85L97 69L110 74L125 54L138 65L151 47L165 56L180 37L193 43L207 22L220 31L235 18L249 26L263 9L278 18L292 8L305 14L320 2" stroke="currentColor" strokeWidth={small ? 5 : 2.5} strokeLinejoin="round" /></svg>;
}

function AppPreview() {
  return <div className="app-scene" role="img" aria-label="Pré-visualização ilustrativa da Invest.ao com carteira, gráfico e títulos angolanos. Todos os valores são fictícios.">
    <div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" />
    <span className="scene-label">UMA NOVA PERSPECTIVA.<br />O MESMO PAÍS.</span>
    <div className="floating-card market-card"><span className="market-symbol">↗</span><div><strong>O mercado, mais perto.</strong><span>Angola. Na palma da mão.</span></div><span className="live-dot" /></div>
    <div className="phone"><div className="phone-status"><b>9:41</b><span className="dynamic-island" /><span>▮▮▮ ▰</span></div><div className="phone-content">
      <div className="phone-heading"><Brand /><span className="avatar">M</span></div><p className="phone-greeting">Olá, Maria <span>☀</span></p><h3>O teu futuro começa aqui.</h3>
      <div className="balance-card"><span>A minha carteira <span aria-hidden="true">◉</span></span><strong>1.250.000<span> Kz</span></strong><small>↗ +8,24% <span>este mês</span></small><Chart /><div className="chart-months"><span>ABR</span><span>MAI</span><span>JUN</span><span>JUL</span><span>AGO</span></div></div>
      <div className="phone-section-title"><b>A acompanhar</b><span>Ver todos ↗</span></div>
      {[{ name: "BAI", desc: "Banco Angolano de Investimentos", value: "64.500 Kz", change: "+2,38%", tone: "blue" }, { name: "BCGA", desc: "Banco Caixa Geral Angola", value: "12.800 Kz", change: "+1,16%", tone: "orange" }].map(asset => <div className="asset-row" key={asset.name}><span className={`asset-logo ${asset.tone}`}>{asset.name === "BAI" ? "bai" : "c"}</span><div className="asset-name"><b>{asset.name}</b><small>{asset.desc}</small></div><div className="asset-value"><b>{asset.value}</b><small>{asset.change}</small></div></div>)}
      <div className="phone-tabs"><span className="selected">▦<small>Visão geral</small></span><span>⌕<small>Mercado</small></span><span>▤<small>Carteira</small></span><span>◯<small>Perfil</small></span></div>
    </div></div>
    <div className="floating-card insight-card"><span className="insight-icon">✳</span><span>Menos ruído.<br /><strong>Mais perspectiva.</strong></span></div><span className="preview-caption">Pré-visualização ilustrativa · valores fictícios</span>
  </div>;
}

const questions = [
  ["O que é a Invest.ao?", "É uma aplicação para acompanhar o mercado de capitais angolano. Reúne informação sobre títulos, favoritos, carteira e actualizações do mercado num só lugar."],
  ["Posso comprar e vender títulos na aplicação?", "A Invest.ao é uma ferramenta de informação e acompanhamento. A compra e venda de títulos é realizada através de intermediários financeiros autorizados."],
  ["A aplicação já está disponível?", "Estamos a preparar o lançamento para iPhone. O acesso à App Store será publicado nesta página quando a aplicação estiver disponível."],
  ["Os valores apresentados nesta página são reais?", "Não. A pré-visualização usa valores fictícios para ilustrar a experiência. A informação apresentada não constitui uma recomendação de investimento."],
];

export default function Home() {
  return <>
    <a className="skip-link" href="#conteudo">Saltar para o conteúdo</a>
    <header className="site-header container"><a href="#" aria-label="Invest.ao — início"><Brand /></a><nav aria-label="Navegação principal"><a href="#funcionalidades">A aplicação</a><a href="#como-funciona">Como funciona</a><a href="#perguntas">Perguntas frequentes</a></nav><a className="button button-small" href="#lancamento">Conhecer a Invest.ao <Arrow /></a></header>
    <main id="conteudo">
      <section className="hero container" aria-labelledby="hero-title"><div className="hero-copy"><span className="eyebrow"><span className="live-dot" /> FEITA PARA O MERCADO ANGOLANO</span><h1 id="hero-title">O teu próximo<br />capítulo começa<br />com <em>perspectiva.</em></h1><p>O mercado angolano, a tua carteira e o que realmente importa. Tudo numa aplicação pensada para acompanhares o teu futuro.</p><div className="hero-actions"><a className="button" href="#funcionalidades">Explorar a aplicação <Arrow /></a><span className="availability"><span aria-hidden="true">◉</span> Em breve para iPhone</span></div><div className="hero-footnote"><span className="little-star" aria-hidden="true">✳</span><span>Feita em Angola.<br /><strong>Para quem acredita no que vem a seguir.</strong></span></div></div><AppPreview /></section>
      <div className="market-strip"><div className="container"><span>UM NOVO OLHAR SOBRE</span><strong>O mercado angolano</strong><i /><span>Acções</span><span>Obrigações</span><span>Informação de mercado</span><span className="strip-end">Tudo mais próximo <Arrow /></span></div></div>
      <section className="features container section-space" id="funcionalidades"><div className="section-heading"><div><span className="eyebrow">MAIS CLAREZA. MAIS CONTROLO.</span><h2>Uma visão completa.<br /><em>À tua maneira.</em></h2></div><p>Do primeiro olhar ao acompanhamento diário, dá espaço ao que importa nas tuas decisões.</p></div><div className="feature-grid">
        <article className="feature-card feature-market"><span className="feature-number">01 / EXPLORAR</span><div className="market-illustration" aria-hidden="true"><div><span className="asset-logo blue">bai</span><b>BAI</b><Chart small /></div><div><span className="asset-logo orange">c</span><b>BCGA</b><Chart small /></div><span className="illustration-tag">O teu mercado. Mais acessível.</span></div><h3>Angola, em perspectiva.</h3><p>Descobre títulos do mercado angolano e consulta informação para compreender o que estás a acompanhar.</p></article>
        <article className="feature-card feature-portfolio"><span className="feature-number">02 / ACOMPANHAR</span><div className="allocation-illustration" aria-hidden="true"><div className="allocation-ring"><span>A tua<br /><b>carteira</b></span></div><div className="allocation-key"><span><i />Acções</span><span><i />Obrigações</span><span><i />O teu futuro</span></div></div><h3>Cada posição, no seu lugar.</h3><p>Organiza a tua carteira e acompanha as tuas posições com uma visão simples do conjunto.</p></article>
        <article className="feature-card feature-news"><span className="feature-number">03 / DESCOBRIR</span><div className="news-illustration" aria-hidden="true"><span className="news-icon">✳</span><div><small>O TEU RADAR</small><strong>Mais contexto.<br />Melhores perguntas.</strong></div><div className="news-line" /><div className="news-line short" /></div><h3>Perto do que importa.</h3><p>Guarda os teus favoritos e acompanha as actualizações sobre o mercado e os títulos que te interessam.</p></article>
      </div></section>
      <section className="how-section" id="como-funciona"><div className="container how-layout"><div><span className="eyebrow">O PRIMEIRO PASSO É TEU.</span><h2>Não precisas de saber tudo.<br /><em>Precisas de começar a conhecer.</em></h2><p>Uma experiência clara, pensada para caber no teu dia — e crescer contigo.</p><a className="text-link" href="#lancamento">Conhece o que vem a seguir <Arrow /></a></div><ol className="steps"><li><span>01</span><div><h3>Descobre o mercado</h3><p>Explora os títulos e conhece as empresas que fazem parte da economia angolana.</p></div></li><li><span>02</span><div><h3>Cria a tua perspectiva</h3><p>Escolhe os teus favoritos e reúne o que queres acompanhar.</p></div></li><li><span>03</span><div><h3>Acompanha com intenção</h3><p>Consulta a tua carteira e mantém o contexto por perto, dia após dia.</p></div></li></ol></div></section>
      <section className="faq container section-space" id="perguntas"><div><span className="eyebrow">SEM COMPLICAÇÕES.</span><h2>Antes do<br /><em>primeiro passo.</em></h2></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      <section className="launch container" id="lancamento"><div className="launch-decoration" aria-hidden="true">↗</div><span className="eyebrow">O FUTURO TEM RAÍZES AQUI.</span><h2>Angola tem potencial.<br /><em>A tua perspectiva também.</em></h2><p>Estamos a preparar uma nova forma de acompanhar<br className="desktop-break" /> o mercado angolano. Em breve, no teu iPhone.</p><span className="launch-pill"><span className="live-dot" /> Lançamento em preparação</span><small>O link para a App Store será publicado aqui.</small></section>
    </main>
    <footer className="container"><div className="footer-top"><a href="#" aria-label="Invest.ao — voltar ao início"><Brand /></a><span>O teu mercado. A tua perspectiva.</span><a href="#conteudo">Voltar ao topo ↑</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Invest.ao · Feita em Angola</span><p>Informação para acompanhar o mercado. Não constitui aconselhamento financeiro nem uma plataforma de negociação. Investir envolve riscos.</p></div></footer>
  </>;
}
