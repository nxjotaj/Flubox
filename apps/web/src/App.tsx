import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  LogOut,
  Plus,
  Settings,
  CreditCard,
  FileText,
  BarChart3,
  Bell,
  Images,
  Layers,
} from "lucide-react";
import "./App.css";
const API = "http://localhost:3000/api/v1";
async function api(p: string, t = "", o: RequestInit = {}) {
  const multipart = o.body instanceof FormData;
  const perform = (token: string) =>
    fetch(API + p, {
      ...o,
      headers: {
        ...(!multipart ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let r = await perform(t),
    b = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== "/auth/refresh" && localStorage.refreshToken) {
    const rr = await fetch(API + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: localStorage.refreshToken }),
    });
    if (rr.ok) {
      const renewed = await rr.json();
      localStorage.token = renewed.accessToken;
      r = await perform(renewed.accessToken);
      b = await r.json().catch(() => ({}));
    } else {
      localStorage.clear();
      location.reload();
    }
  }
  if (r.status === 401 && p !== "/auth/login" && !localStorage.refreshToken) {
    localStorage.clear();
    location.reload();
  }
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
          localStorage.refreshToken = x.refreshToken;
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
  const [e, setE] = useState(""),[forgot,setForgot]=useState(false),[reset,setReset]=useState(false),[info,setInfo]=useState("");
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
  async function recover(x:FormEvent<HTMLFormElement>){x.preventDefault();const email=String(new FormData(x.currentTarget).get('email'));const r=await api('/auth/forgot-password','',{method:'POST',body:JSON.stringify({email})});setInfo(r.developmentToken?`Token de desenvolvimento: ${r.developmentToken}`:'Se o e-mail existir, enviaremos as instruções.')}
  async function resetPassword(x:FormEvent<HTMLFormElement>){x.preventDefault();const d=Object.fromEntries(new FormData(x.currentTarget));await api('/auth/reset-password','',{method:'POST',body:JSON.stringify(d)});setInfo('Senha redefinida. Volte ao login.');setReset(false);setForgot(false)}
  return (
    <main className="login">
      <form onSubmit={reset?resetPassword:forgot?recover:go}>
        <Logo />
        <h1>{reset?'Redefinir senha':forgot?'Recuperar senha':'Gestão Dropshipping'}</h1>
        <p>Controle produtos, lojistas, pagamentos e expedições.</p>
        {!reset&&<label>
          E-mail
          <input name="email" type="email" defaultValue="admin@flubox.local" />
        </label>}
        {!forgot&&!reset&&<label>
          Senha
          <input name="password" type="password" defaultValue="Admin@12345" />
        </label>}{reset&&<><label>Token de recuperação<input name="token" required/></label><label>Nova senha<input name="password" type="password" minLength={10} required/></label></>}
        {e && <i>{e}</i>}
        {info&&<div className="msg">{info}</div>}<button>{reset?'Salvar nova senha':forgot?'Enviar recuperação':'Entrar no sistema'}</button><button type="button" className="link" onClick={()=>{setReset(false);setForgot(!forgot)}}>{forgot||reset?'Voltar ao login':'Esqueci minha senha'}</button>{forgot&&<button type="button" className="link" onClick={()=>{setForgot(false);setReset(true)}}>Já tenho o token</button>}
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
  const [notifications,setNotifications]=useState(false);
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
          ["reports", "Relatórios", BarChart3],
          ["settings", "Empresa e Pix", Settings],
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
          <span className="header-actions"><button onClick={()=>setNotifications(true)} aria-label="Notificações"><Bell size={19}/></button><b>
            {user.name} · {user.role}
          </b></span>
        </header>
        <main>
          {p === "dashboard" ? (
            <Dashboard t={token} go={setP} />
          ) : p === "products" ? (
            <Products t={token} admin={user.role !== "SELLER"} />
          ) : p === "sellers" ? (
            <Sellers t={token} />
          ) : p === "settings" ? (
            <PlatformSettings t={token} />
          ) : p === "reports" ? (
            <Reports />
          ) : (
            <Orders t={token} seller={user.role === "SELLER"} />
          )}
        </main>
        {notifications&&<Notifications t={token} close={()=>setNotifications(false)}/>} 
      </section>
    </div>
  );
}
function Notifications({t,close}:any){const[xs,setXs]=useState<any[]>([]);useEffect(()=>{api('/notifications',t).then(setXs)},[t]);return <Modal title="Notificações" close={close}>{xs.length?xs.map(x=><div className="line" key={x.id}><span><b>{x.title}</b><small>{x.body}</small></span>{!x.readAt&&<button className="link" onClick={async()=>{await api('/notifications/'+x.id+'/read',t,{method:'PATCH'});setXs(xs.map(n=>n.id===x.id?{...n,readAt:new Date()}:n))}}>Marcar como lida</button>}</div>):<p>Nenhuma notificação.</p>}</Modal>}
function Dashboard({ t, go }: any) {
  const [data, setData] = useState<any>({
    orders: [],
    payments: [],
    lowStock: [],
    recent: [],
  });
  useEffect(() => {
    api("/dashboard", t).then(setData);
  }, [t]);
  return (
    <>
      <div className="cards">
        {[
          ["Produtos ativos", data.products || 0, "products"],
          ["Cadastros aguardando", data.pendingSellers || 0, "sellers"],
          [
            "Pedidos abertos",
            (data.orders || [])
              .filter((x: any) => !["SHIPPED", "CANCELLED"].includes(x.status))
              .reduce((a: number, x: any) => a + x._count, 0),
            "orders",
          ],
          [
            "Pagamentos em revisão",
            (data.payments || []).find((x: any) => x.status === "REVIEW")
              ?._count || 0,
            "orders",
          ],
        ].map((x) => (
          <article onClick={() => go(x[2])} className="clickable">
            <small>{x[0]}</small>
            <strong>{x[1]}</strong>
          </article>
        ))}
      </div>
      <div className="panel">
        <h3>Atalhos operacionais</h3>
        <div className="quick">
          <button onClick={() => go("orders")}>
            <ShoppingCart />
            Receber e processar pedidos
          </button>
          <button onClick={() => go("products")}>
            <Package />
            Produtos e estoque
          </button>
          <button onClick={() => go("sellers")}>
            <Users />
            Aprovar lojistas
          </button>
          <button onClick={() => go("settings")}>
            <CreditCard />
            Configurar empresa e Pix
          </button>
        </div>
        <h3>Estoque baixo</h3>
        <div className="mini-list">
          {(data.lowStock || []).map((x: any) => (
            <span>
              <b>{x.sku}</b> {x.name}
              <strong>{x.stockOnHand - x.reservedStock} un.</strong>
            </span>
          ))}
          {!data.lowStock?.length && <p>Nenhum alerta de estoque.</p>}
        </div>
      </div>
    </>
  );
}
function Products({ t, admin }: any) {
  const [xs, setXs] = useState<any[]>([]),
    [modal, setModal] = useState<any>(null),
    [stock, setStock] = useState<any>(null),
    [manage, setManage] = useState<any>(null),
    [msg, setMsg] = useState("");
  const load = () => api("/products", t).then(setXs);
  useEffect(() => {
    void load();
  }, [t]);
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
        method: modal.id ? "PUT" : "POST",
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
  async function download(format: string) {
    const r = await fetch(`${API}/exports/${format==='zip'?'catalog-images.zip':'catalog.'+format}`, { headers: { Authorization: `Bearer ${localStorage.token}` } });
    const blob = await r.blob(), link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = format==='zip'?'fotos-catalogo-flubox.zip':`catalogo-flubox.${format}`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function manageProduct(id:string){setManage(await api('/products/'+id,t))}
  return (
    <>
      <div className="tools">
        <input
          placeholder="Buscar produto"
          onChange={(e) =>
            api("/products?search=" + e.target.value, t).then(setXs)
          }
        />
        <span className="tool-actions"><button onClick={() => download('csv')}>Exportar CSV</button><button onClick={() => download('xlsx')}>Exportar Excel</button><button onClick={() => download('zip')}>Fotos ZIP</button>{admin && (
          <button onClick={() => setModal({})}>
            <Plus size={17} />
            Novo produto
          </button>
        )}</span>
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
                  <button className="link" onClick={() => manageProduct(x.id)}>Imagens e variações</button>
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
      {manage&&<ProductAssets product={manage} t={t} reload={()=>manageProduct(manage.id)} close={()=>setManage(null)}/>} 
    </>
  );
}
function ProductAssets({product,t,reload,close}:any){async function image(file:File){const f=new FormData();f.append('file',file);await api(`/products/${product.id}/images`,t,{method:'POST',body:f});reload()}async function variant(e:FormEvent<HTMLFormElement>){e.preventDefault();const d:any=Object.fromEntries(new FormData(e.currentTarget));d.stockOnHand=Number(d.stockOnHand);if(d.price)d.price=Number(d.price);d.attributes={description:d.attributes};await api(`/products/${product.id}/variants`,t,{method:'POST',body:JSON.stringify(d)});(e.target as HTMLFormElement).reset();reload()}return <Modal title={`Imagens e variações — ${product.sku}`} close={close}><h4>Imagens do produto</h4><label className="upload"><Images size={18}/>Adicionar foto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>e.target.files?.[0]&&image(e.target.files[0])}/></label><div className="asset-list">{product.files.filter((f:any)=>f.kind==='PRODUCT_IMAGE').map((f:any)=><div className="line" key={f.id}><span>{f.primary?'★ Principal · ':''}{f.filename}</span><span><button className="link" onClick={async()=>{await api(`/products/${product.id}/images/${f.id}/primary`,t,{method:'PATCH'});reload()}}>Tornar principal</button><button className="link" onClick={async()=>{if(confirm('Excluir esta imagem?')){await api(`/products/${product.id}/images/${f.id}`,t,{method:'DELETE'});reload()}}}>Excluir</button></span></div>)}</div><h4><Layers size={17}/> Variações</h4>{product.variants.map((v:any)=><div className="line" key={v.id}><span><b>{v.sku}</b> — {v.name}</span><span>{v.stockOnHand} un. · {v.price?money(v.price):'Preço do produto'}</span></div>)}<form className="grid compact" onSubmit={variant}><label>SKU da variação<input name="sku" required/></label><label>Nome<input name="name" required/></label><label>Preço opcional<input name="price" type="number" step="0.01"/></label><label>Estoque<input name="stockOnHand" type="number" min="0" required/></label><label className="wide">Atributos (cor, tamanho etc.)<input name="attributes"/></label><button className="wide">Adicionar variação</button></form></Modal>}
function Sellers({ t }: any) {
  const [xs, setXs] = useState<any[]>([]),
    [detail, setDetail] = useState<any>();
  const load = () => api("/sellers", t).then(setXs);
  useEffect(() => {
    void load();
  }, [t]);
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
function Orders({ t, seller }: any) {
  const [xs, setXs] = useState<any[]>([]),
    [detail, setDetail] = useState<any>(null),
    [filter, setFilter] = useState(""),
    [creating, setCreating] = useState(false),
    [products, setProducts] = useState<any[]>([]);
  const load = () =>
    api("/orders" + (filter ? "?status=" + filter : ""), t).then(setXs);
  useEffect(() => {
    void load();
  }, [t, filter]);
  async function open(id: string) {
    setDetail(await api("/orders/" + id, t));
  }
  async function upload(kind: string, file: File) {
    const f = new FormData();
    f.append("file", file);
    await api(`/orders/${detail.id}/files/${kind}`, t, {
      method: "POST",
      body: f,
    });
    await open(detail.id);
    load();
  }
  async function review(payment: any, status: string) {
    const reason = prompt("Motivo obrigatório da decisão:");
    if (!reason) return;
    await api(`/orders/payments/${payment.id}/review`, t, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    await open(detail.id);
    load();
  }
  async function ship() {
    const trackingCode = prompt("Código de rastreio (opcional):") || "";
    await api(`/orders/${detail.id}/ship`, t, {
      method: "PATCH",
      body: JSON.stringify({
        trackingCode,
        notes: "Expedição registrada pelo painel",
      }),
    });
    setDetail(null);
    load();
  }
  async function begin() { setProducts(await api('/products', t)); setCreating(true); }
  async function createOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const d:any=Object.fromEntries(new FormData(e.currentTarget));
    const order=await api('/orders',t,{method:'POST',body:JSON.stringify({recipientName:d.recipientName,recipientTaxId:d.recipientTaxId,recipientAddress:{postalCode:d.postalCode,street:d.street,number:d.number,neighborhood:d.neighborhood,city:d.city,state:d.state},items:[{productId:d.productId,quantity:Number(d.quantity)}]})});
    setCreating(false); await open(order.id); load();
  }
  return (
    <>
      <div className="tools">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos os pedidos</option>
          {[
            "AWAITING_PAYMENT",
            "PAYMENT_REVIEW",
            "DOCUMENTS_PENDING",
            "PAID",
            "SEPARATING",
            "READY_TO_SHIP",
            "SHIPPED",
            "CANCELLED",
          ].map((x) => (
            <option>{x}</option>
          ))}
        </select>
        <span className="tool-actions"><button onClick={load}>Atualizar pedidos</button>{seller&&<button onClick={begin}><Plus size={16}/>Novo pedido</button>}</span>
      </div>
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
              <button className="link" onClick={() => open(x.id)}>
                Abrir
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {creating&&<Modal title="Solicitar produto e gerar Pix" close={()=>setCreating(false)}><form className="grid" onSubmit={createOrder}><label className="wide">Produto<select name="productId">{products.map(p=><option key={p.id} value={p.id}>{p.sku} — {p.name} — {money(p.price)} ({p.stockOnHand-p.reservedStock} disponíveis)</option>)}</select></label><label>Quantidade<input name="quantity" type="number" min="1" defaultValue="1" required/></label><label>Destinatário<input name="recipientName" required/></label><label>CPF/CNPJ<input name="recipientTaxId"/></label><label>CEP<input name="postalCode" required/></label><label>Rua<input name="street" required/></label><label>Número<input name="number" required/></label><label>Bairro<input name="neighborhood" required/></label><label>Cidade<input name="city" required/></label><label>UF<input name="state" maxLength={2} required/></label><button className="wide">Reservar estoque e gerar Pix</button></form></Modal>}
      {detail && (
        <Modal title={"Pedido " + detail.number} close={() => setDetail(null)}>
          <div className="order-summary">
            <div>
              <small>Lojista</small>
              <b>{detail.seller.companyName || detail.seller.name}</b>
              <span>{detail.seller.email}</span>
            </div>
            <div>
              <small>Destinatário</small>
              <b>{detail.recipientName}</b>
              <span>{JSON.stringify(detail.recipientAddress)}</span>
            </div>
            <div>
              <small>Total</small>
              <b>{money(detail.total)}</b>
              <span>{detail.status}</span>
            </div>
          </div>
          <h4>Itens</h4>
          {detail.items.map((i: any) => (
            <div className="line">
              <span>
                {i.quantity}× {i.name} <small>{i.sku}</small>
              </span>
              <b>{money(Number(i.unitPrice) * i.quantity)}</b>
            </div>
          ))}
          <h4>Pagamento</h4>
          {detail.payments.map((p: any) => (
            <div className="payment">
              <span>
                <b>{p.provider}</b> · {p.status} · {money(p.amount)}
              </span>
              <code>{p.providerChargeId}</code>
              {p.status !== "CONFIRMED" && (
                <span>
                  <button
                    className="link"
                    onClick={() => review(p, "CONFIRMED")}
                  >
                    Aprovar manualmente
                  </button>
                  <button
                    className="link"
                    onClick={() => review(p, "REJECTED")}
                  >
                    Rejeitar
                  </button>
                </span>
              )}
            </div>
          ))}
          <h4>Etiqueta e documentos</h4>
          <div className="uploads">
            <Upload
              label="Comprovante"
              kind="PAYMENT_RECEIPT"
              onFile={upload}
            />
            <Upload label="Etiqueta" kind="SHIPPING_LABEL" onFile={upload} />
            <Upload label="Nota fiscal" kind="INVOICE" onFile={upload} />
            <Upload
              label="Declaração"
              kind="CONTENT_DECLARATION"
              onFile={upload}
            />
          </div>
          {detail.files.map((f: any) => (
            <button
              className="file"
              onClick={async () => {
                const x = await api("/files/" + f.id + "/url", t);
                window.open(x.url, "_blank");
              }}
            >
              <FileText size={16} />
              {f.kind}: {f.filename}
            </button>
          ))}
          <div className="actions">
            <button onClick={ship}>Registrar expedição</button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Upload({ label, kind, onFile }: any) {
  return (
    <label className="upload">
      {label}
      <input
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        onChange={(e) => e.target.files?.[0] && onFile(kind, e.target.files[0])}
      />
    </label>
  );
}
function Reports(){async function download(){const r=await fetch(API+'/exports/orders.xlsx',{headers:{Authorization:`Bearer ${localStorage.token}`}}),b=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='relatorio-pedidos.xlsx';a.click()}return <div className="panel"><h3>Relatórios consolidados</h3><p>Exporte pedidos processados, enviados, pendentes, valores e situação financeira em uma única planilha.</p><div className="quick"><button onClick={download}><BarChart3/>Baixar relatório completo de pedidos</button></div></div>}
function PlatformSettings({ t }: any) {
  const [x, setX] = useState<any>(null),
    [msg, setMsg] = useState("");
  useEffect(() => {
    api("/settings", t).then(setX);
  }, [t]);
  if (!x) return <p>Carregando configurações…</p>;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d: any = Object.fromEntries(new FormData(e.currentTarget));
    d.pickupAddress = {
      postalCode: d.postalCode,
      street: d.street,
      number: d.number,
      complement: d.complement,
      neighborhood: d.neighborhood,
      city: d.city,
      state: d.state,
    };
    [
      "postalCode",
      "street",
      "number",
      "complement",
      "neighborhood",
      "city",
      "state",
    ].forEach((k) => delete d[k]);
    try {
      setX(
        await api("/settings", t, { method: "PUT", body: JSON.stringify(d) }),
      );
      setMsg("Configurações salvas e registradas na auditoria.");
    } catch (z: any) {
      setMsg(z.message);
    }
  }
  const a = x.pickupAddress || {};
  return (
    <div className="panel settings">
      <h3>Dados da empresa e endereço de coleta</h3>
      <p>
        Este endereço deve ser informado pelos lojistas como origem/coleta nas
        plataformas de venda.
      </p>
      {msg && <div className="msg">{msg}</div>}
      <form className="grid" onSubmit={save}>
        {[
          ["companyName", "Razão social / nome"],
          ["taxId", "CNPJ / CPF"],
          ["email", "E-mail operacional"],
          ["phone", "Telefone"],
          ["postalCode", "CEP"],
          ["street", "Rua"],
          ["number", "Número"],
          ["complement", "Complemento"],
          ["neighborhood", "Bairro"],
          ["city", "Cidade"],
          ["state", "UF"],
        ].map(([n, l]) => (
          <label>
            {l}
            <input
              name={n}
              defaultValue={x[n] ?? a[n] ?? ""}
              required={!["complement"].includes(n)}
            />
          </label>
        ))}
        <h3 className="wide">Recebimento Pix</h3>
        <label>
          Modo
          <select name="pixMode" defaultValue={x.pixMode}>
            <option value="MANUAL">Conta/chave manual</option>
            <option value="API">Provedor com API</option>
            <option value="SIMULATED">Simulador de testes</option>
          </select>
        </label>
        <label>
          Provedor
          <input name="pixProvider" defaultValue={x.pixProvider} />
        </label>
        <label>
          Chave Pix
          <input name="pixKey" defaultValue={x.pixKey} />
        </label>
        <label>
          Beneficiário
          <input name="pixBeneficiary" defaultValue={x.pixBeneficiary} />
        </label>
        <label>
          Cidade Pix
          <input name="pixCity" defaultValue={x.pixCity} />
        </label>
        <label>
          URL da API
          <input name="pixApiUrl" defaultValue={x.pixApiUrl} />
        </label>
        <label className="wide">
          Token secreto da API
          <input
            name="pixApiToken"
            type="password"
            placeholder={
              x.pixApiTokenEncrypted
                ? "Token já configurado — deixe vazio para manter"
                : "Informe o token"
            }
          />
        </label>
        <button className="wide">Salvar empresa e Pix</button>
      </form>
    </div>
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
