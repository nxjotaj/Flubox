import {
  ArrowRight,
  Box,
  Check,
  ChevronRight,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Users,
  Zap,
} from 'lucide-react';

const steps = [
  {
    icon: Store,
    number: '01',
    title: 'Escolha produtos',
    description:
      'Explore fornecedores verificados, preços e estoque em tempo real.',
  },
  {
    icon: Zap,
    number: '02',
    title: 'Venda onde quiser',
    description: 'Use o catálogo para anunciar nos seus canais e marketplaces.',
  },
  {
    icon: Truck,
    number: '03',
    title: 'Nós conectamos tudo',
    description: 'O fornecedor prepara e envia. Você acompanha cada etapa.',
  },
];

const supplierBenefits = [
  'Novos canais de venda sem ampliar sua equipe comercial',
  'Pedidos, estoque e documentos organizados em um só lugar',
  'Reputação transparente para construir relações duradouras',
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Flubox — início">
          <span className="brand-mark" aria-hidden="true">
            <Box size={21} strokeWidth={2.6} />
          </span>
          <span>
            flu<span>box</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#fornecedores">Para fornecedores</a>
          <a href="#seguranca">Segurança</a>
        </nav>
        <div className="header-actions">
          <a className="text-link" href="/entrar">
            Entrar
          </a>
          <a className="button button-dark button-small" href="/cadastro">
            Criar conta <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> Dropshipping mais simples
          </div>
          <h1>
            Estoque de quem tem.
            <br />
            <em>Vendas de quem sabe.</em>
          </h1>
          <p>
            A plataforma que conecta fornecedores confiáveis a revendedores que
            querem crescer — sem estoque próprio, sem operação complicada.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/cadastro">
              Quero revender <ArrowRight size={18} />
            </a>
            <a className="button button-ghost" href="/cadastro">
              Sou fornecedor <ChevronRight size={18} />
            </a>
          </div>
          <div className="trust-line">
            <span>
              <ShieldCheck size={17} /> Fornecedores verificados
            </span>
            <span>
              <PackageCheck size={17} /> Operação rastreável
            </span>
          </div>
        </div>

        <div
          className="hero-visual"
          aria-label="Fluxo de uma venda pelo Flubox"
        >
          <div className="glow-orb" />
          <div className="flow-card">
            <div className="mini-icon orange">
              <Store size={19} />
            </div>
            <div>
              <small>Fornecedor</small>
              <strong>Produto em estoque</strong>
            </div>
            <span className="status-dot" />
          </div>
          <div className="flow-line">
            <span />
          </div>
          <div className="flow-core">
            <div className="core-ring">
              <Box size={38} strokeWidth={2.2} />
            </div>
            <strong>Flubox</strong>
            <span>conecta e acompanha</span>
          </div>
          <div className="flow-line">
            <span />
          </div>
          <div className="flow-card">
            <div className="mini-icon green">
              <Users size={19} />
            </div>
            <div>
              <small>Revendedor</small>
              <strong>Pedido confirmado</strong>
            </div>
            <span className="check-dot">
              <Check size={13} />
            </span>
          </div>
          <div className="floating-pill pill-one">
            <span>+1</span> nova venda
          </div>
          <div className="floating-pill pill-two">
            PIX confirmado <Check size={13} />
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Benefícios da plataforma">
        <div>
          <strong>100%</strong>
          <span>operação rastreável</span>
        </div>
        <div>
          <strong>1 painel</strong>
          <span>para toda a jornada</span>
        </div>
        <div>
          <strong>0 estoque</strong>
          <span>para começar a vender</span>
        </div>
        <div>
          <strong>PIX</strong>
          <span>pagamento simples</span>
        </div>
      </section>

      <section className="steps-section" id="como-funciona">
        <div className="section-heading">
          <span>Uma operação que flui</span>
          <h2>
            Da descoberta à entrega,
            <br />
            sem perder o controle.
          </h2>
          <p>Um fluxo claro para cada pessoa fazer o que sabe melhor.</p>
        </div>
        <div className="steps-grid">
          {steps.map(({ icon: Icon, number, title, description }) => (
            <article className="step-card" key={number}>
              <span className="step-number">{number}</span>
              <div className="step-icon">
                <Icon size={25} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="supplier-section" id="fornecedores">
        <div className="supplier-visual" aria-hidden="true">
          <div className="metric-card">
            <span>Operação desta semana</span>
            <strong>R$ 18.420</strong>
            <div className="bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <small>
              <span>↑ 18,4%</span> comparado à semana anterior
            </small>
          </div>
          <div className="order-card">
            <PackageCheck size={21} />
            <span>
              <strong>Pedido #4821</strong>Pronto para envio
            </span>
            <em>no prazo</em>
          </div>
        </div>
        <div className="supplier-copy">
          <span className="section-label">Para quem tem estoque</span>
          <h2>Transforme estoque em uma rede de vendas.</h2>
          <p>
            Ganhe alcance com revendedores ativos e mantenha a operação sob
            controle.
          </p>
          <ul>
            {supplierBenefits.map((benefit) => (
              <li key={benefit}>
                <Check size={16} />
                {benefit}
              </li>
            ))}
          </ul>
          <a href="/cadastro">
            Conheça a solução para fornecedores <ArrowRight size={17} />
          </a>
        </div>
      </section>

      <section className="security-section" id="seguranca">
        <ShieldCheck size={26} />
        <div>
          <strong>Confiança construída em cada etapa.</strong>
          <span>
            Dados protegidos, operações auditáveis e pagamentos confirmados no
            servidor.
          </span>
        </div>
        <a href="/seguranca">
          Como protegemos sua operação <ArrowRight size={16} />
        </a>
      </section>

      <footer>
        <a className="brand brand-footer" href="#inicio">
          <span className="brand-mark">
            <Box size={18} />
          </span>
          <span>
            flu<span>box</span>
          </span>
        </a>
        <p>Conectando estoque a novas possibilidades.</p>
        <span>© 2026 Flubox</span>
      </footer>
    </main>
  );
}
