import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  LogOut,
  Plus,
} from "lucide-react";
import "./App.css";
const API = "http://localhost:3000/api/v1";
async function api(p: string, t = "", o: RequestInit = {}) {
  const r = await fetch(API + p, {
      ...o,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    }),
    b = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Error(
      Array.isArray(b.message) ? b.message.join(", ") : b.message || "Erro",
    );
  return b;
}
export default function App() {
  const [t, setT] = useState(localStorage.token || ""),
    [u, setU] = useState<any>(JSON.parse(localStorage.user || "null"));
  if (!t)
    return (
      <Login
        done={(x: any) => {
          localStorage.token = x.accessToken;
          localStorage.user = JSON.stringify(x.user);
          setT(x.accessToken);
          setU(x.user);
        }}
      />
    );
  return (
    <System
      token={t}
      user={u}
      out={() => {
        localStorage.clear();
        setT("");
      }}
    />
  );
}
function Login({ done }: any) {
  const [e, setE] = useState("");
  async function go(x: FormEvent<HTMLFormElement>) {
    x.preventDefault();
    const f = new FormData(x.currentTarget);
    try {
      done(
        await api("/auth/login", "", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(f)),
        }),
      );
    } catch (z: any) {
      setE(z.message);
    }
  }
  return (
    <main className="login">
      <form onSubmit={go}>
        <Logo />
        <h1>Gestão Dropshipping</h1>
        <p>Controle produtos, lojistas, pagamentos e expedições.</p>
        <label>
          E-mail
          <input name="email" type="email" defaultValue="admin@flubox.local" />
        </label>
        <label>
          Senha
          <input name="password" type="password" defaultValue="Admin@12345" />
        </label>
        {e && <i>{e}</i>}
        <button>Entrar no sistema</button>
      </form>
    </main>
  );
}
function Logo() {
  return (
    <div className="logo">
      <b>F</b>
      <span>
        <strong>Flubox</strong>
        <small>Operação central</small>
      </span>
    </div>
  );
}
function System({ token, user, out }: any) {
  const [p, setP] = useState("dashboard");
  const nav: any[] =
    user.role === "SELLER"
      ? [
          ["dashboard", "Visão geral", LayoutDashboard],
          ["products", "Catálogo", Package],
          ["orders", "Meus pedidos", ShoppingCart],
        ]
      : [
          ["dashboard", "Visão geral", LayoutDashboard],
          ["products", "Produtos e estoque", Package],
          ["sellers", "Lojistas", Users],
          ["orders", "Pedidos e pagamentos", ShoppingCart],
        ];
  return (
    <div className="app">
      <aside>
        <Logo />
        <nav>
          {nav.map(([id, n, I]: any) => (
            <button className={p === id ? "on" : ""} onClick={() => setP(id)}>
              <I size={18} />
              {n}
            </button>
          ))}
        </nav>
        <button onClick={out}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>
      <section>
        <header>
          <div>
            <small>FLUBOX / {p.toUpperCase()}</small>
            <h2>{nav.find((x) => x[0] === p)?.[1]}</h2>
          </div>
          <b>
            {user.name} · {user.role}
          </b>
        </header>
        <main>
          {p === "dashboard" ? (
            <Dashboard t={token} />
          ) : p === "products" ? (
            <Products t={token} admin={user.role !== "SELLER"} />
          ) : p === "sellers" ? (
            <Sellers t={token} />
          ) : (
            <Orders t={token} />
          )}
        </main>
      </section>
    </div>
  );
}
function Dashboard({ t }: any) {
  const [p, setP] = useState<any[]>([]),
    [o, setO] = useState<any[]>([]);
  useEffect(() => {
    api("/products", t).then(setP);
    api("/orders", t).then(setO);
  }, [t]);
  return (
    <>
      <div className="cards">
        {[
          ["Produtos", p.length],
          [
            "Estoque disponível",
            p.reduce((a, x) => a + x.stockOnHand - x.reservedStock, 0),
          ],
          [
            "Pedidos abertos",
            o.filter((x) => !["SHIPPED", "CANCELLED"].includes(x.status))
              .length,
          ],
          ["Em revisão", o.filter((x) => x.status === "PAYMENT_REVIEW").length],
        ].map((x) => (
          <article>
            <small>{x[0]}</small>
            <strong>{x[1]}</strong>
          </article>
        ))}
      </div>
      <div className="panel">
        <h3>Operação conectada</h3>
        <p>Dados carregados da API e persistidos no PostgreSQL Supabase.</p>
      </div>
    </>
  );
}
function Products({ t, admin }: any) {
  const [xs, setXs] = useState<any[]>([]),
    [modal, setModal] = useState<any>(null),
    [stock, setStock] = useState<any>(null),
    [msg, setMsg] = useState("");
  const load = () => api("/products", t).then(setXs);
  useEffect(() => { void load(); }, [t]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    [
      "price",
      "weightGrams",
      "lengthMm",
      "widthMm",
      "heightMm",
      "initialStock",
    ].forEach((k) => {
      if (d[k] != null) d[k] = Number(d[k]);
    });
    try {
      await api(modal.id ? `/products/${modal.id}` : "/products", t, {
        method: modal.id ? "PATCH" : "POST",
        body: JSON.stringify(d),
      });
      setModal(null);
      load();
    } catch (z: any) {
      setMsg(z.message);
    }
  }
  async function move(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.quantity = Number(d.quantity);
    try {
      await api(`/products/${stock.id}/stock-movements`, t, {
        method: "POST",
        body: JSON.stringify(d),
      });
      setStock(null);
      load();
    } catch (z: any) {
      setMsg(z.message);
    }
  }
  return (
    <>
      <div className="tools">
        <input
          placeholder="Buscar produto"
          onChange={(e) =>
            api("/products?search=" + e.target.value, t).then(setXs)
          }
        />
        {admin && (
          <button onClick={() => setModal({})}>
            <Plus size={17} />
            Novo produto
          </button>
        )}
      </div>
      {msg && <div className="msg">{msg}</div>}
      <Table
        heads={["Produto", "SKU", "Preço", "Disponível", "Status", "Ações"]}
      >
        {xs.map((x) => (
          <tr>
            <td>
              <b>{x.name}</b>
              <small>{x.category}</small>
            </td>
            <td>{x.sku}</td>
            <td>{money(x.price)}</td>
            <td>{x.stockOnHand - x.reservedStock}</td>
            <td>
              <em>{x.status}</em>
            </td>
            <td>
              {admin && (
                <>
                  <button className="link" onClick={() => setModal(x)}>
                    Editar
                  </button>
                  <button className="link" onClick={() => setStock(x)}>
                    Estoque
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {modal && (
        <Modal
          title={modal.id ? "Editar produto" : "Novo produto"}
          close={() => setModal(null)}
        >
          <form className="grid" onSubmit={save}>
            {[
              ["sku", "SKU"],
              ["name", "Nome"],
              ["category", "Categoria"],
              ["brand", "Marca"],
              ["price", "Preço"],
              ["weightGrams", "Peso (g)"],
              ["lengthMm", "Comprimento (mm)"],
              ["widthMm", "Largura (mm)"],
              ["heightMm", "Altura (mm)"],
              ...(!modal.id ? [["initialStock", "Estoque inicial"]] : []),
            ].map(([n, l]) => (
              <label>
                {l}
                <input name={n} defaultValue={modal[n] || ""} required />
              </label>
            ))}
            <label className="wide">
              Descrição
              <textarea
                name="description"
                defaultValue={modal.description || ""}
                required
              />
            </label>
            <button className="wide">Salvar</button>
          </form>
        </Modal>
      )}
      {stock && (
        <Modal title={"Movimentar " + stock.sku} close={() => setStock(null)}>
          <form className="stack" onSubmit={move}>
            <label>
              Tipo
              <select name="type">
                <option>ENTRY</option>
                <option>ADJUSTMENT</option>
                <option>RETURN</option>
                <option>LOSS</option>
              </select>
            </label>
            <label>
              Quantidade
              <input name="quantity" type="number" min="1" />
            </label>
            <label>
              Motivo
              <textarea name="reason" required />
            </label>
            <button>Registrar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Sellers({ t }: any) {
  const [xs, setXs] = useState<any[]>([]),
    [detail, setDetail] = useState<any>();
  const load = () => api("/sellers", t).then(setXs);
  useEffect(() => { void load(); }, [t]);
  async function status(x: any, s: string) {
    const reason = prompt("Motivo obrigatório:");
    if (reason) {
      await api(`/sellers/${x.id}/status`, t, {
        method: "PATCH",
        body: JSON.stringify({ status: s, reason }),
      });
      load();
    }
  }
  return (
    <>
      <Table heads={["Lojista", "Empresa", "Documento", "Status", "Ações"]}>
        {xs.map((x) => (
          <tr>
            <td>
              <b>{x.name}</b>
              <small>{x.email}</small>
            </td>
            <td>{x.companyName || "—"}</td>
            <td>{x.taxId || "—"}</td>
            <td>
              <em>{x.status}</em>
            </td>
            <td>
              <button
                className="link"
                onClick={async () =>
                  setDetail(await api("/sellers/" + x.id, t))
                }
              >
                Dados
              </button>
              <button
                className="link"
                onClick={() =>
                  status(x, x.status === "APPROVED" ? "SUSPENDED" : "APPROVED")
                }
              >
                {x.status === "APPROVED" ? "Suspender" : "Aprovar"}
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {detail && (
        <Modal title="Cadastro completo" close={() => setDetail(null)}>
          <pre>{JSON.stringify(detail, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
function Orders({ t }: any) {
  const [xs, setXs] = useState<any[]>([]);
  useEffect(() => {
    api("/orders", t).then(setXs);
  }, [t]);
  return (
    <Table
      heads={[
        "Pedido",
        "Lojista / destinatário",
        "Total",
        "Pagamento",
        "Status",
        "Detalhes",
      ]}
    >
      {xs.map((x) => (
        <tr>
          <td>
            <b>{x.number}</b>
            <small>{new Date(x.createdAt).toLocaleString("pt-BR")}</small>
          </td>
          <td>{x.seller?.companyName || x.recipientName}</td>
          <td>{money(x.total)}</td>
          <td>{x.payments?.[0]?.status || "—"}</td>
          <td>
            <em>{x.status}</em>
          </td>
          <td>
            <button
              className="link"
              onClick={() => alert(JSON.stringify(x, null, 2))}
            >
              Abrir
            </button>
          </td>
        </tr>
      ))}
    </Table>
  );
}
function Table({ heads, children }: any) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {heads.map((x: string) => (
              <th>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Modal({ title, close, children }: any) {
  return (
    <div className="shade" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button onClick={close}>×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
function money(x: any) {
  return Number(x).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
