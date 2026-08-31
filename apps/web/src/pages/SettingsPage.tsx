import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api } from "../lib/api";
import { Loading, PageHeader } from "../components/ui";
type Settings = {
  companyName: string;
  taxId: string;
  phone: string;
  email: string;
  pickupAddress: Record<string, string>;
  pixMode: "MANUAL" | "API" | "SIMULATED";
  pixKey?: string;
  pixBeneficiary?: string;
  pixCity?: string;
  pixProvider?: string;
  pixApiUrl?: string;
  pixApiToken?: string;
};
const initial: Settings = {
  companyName: "",
  taxId: "",
  phone: "",
  email: "",
  pickupAddress: {
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
    zipCode: "",
  },
  pixMode: "SIMULATED",
};
export function SettingsPage({
  section,
}: {
  section: "company" | "pix" | "profile" | "team" | "security";
}) {
  const [data, setData] = useState<Settings | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Settings>("/settings")
      .then((x) =>
        setData({
          ...initial,
          ...x,
          pickupAddress: { ...initial.pickupAddress, ...x.pickupAddress },
        }),
      )
      .catch((e) => setMessage(e.message));
  }, []);
  if (!data) return <Loading />;
  const set = (k: keyof Settings, v: unknown) => setData({ ...data, [k]: v });
  const addr = (k: string, v: string) =>
    setData({ ...data, pickupAddress: { ...data.pickupAddress, [k]: v } });
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await api("/settings", { method: "PUT", body: JSON.stringify(data) });
      setMessage("Configurações salvas com sucesso.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };
  if (section === "team")
    return (
      <>
        <PageHeader
          title="Equipe e permissões"
          description="Papéis administrativos e acesso por domínio."
        />
        <section className="panel">
          <h2>Administradores e colaboradores</h2>
          <p>
            A conta administradora mantém acesso total. A migração de permissões
            granulares será aplicada antes de permitir convites de
            colaboradores.
          </p>
        </section>
      </>
    );
  if (section === "security")
    return (
      <>
        <PageHeader
          title="Segurança, notificações e privacidade"
          description="Sessões, credenciais e preferências LGPD."
        />
        <section className="settings-grid">
          <article className="panel">
            <h2>Sessões ativas</h2>
            <p>
              Revogue acessos desconhecidos e troque sua senha periodicamente.
            </p>
            <button className="secondary">Gerenciar sessões</button>
          </article>
          <article className="panel">
            <h2>Privacidade e LGPD</h2>
            <p>
              Controle retenção, consentimentos e solicitações de encerramento.
            </p>
            <button className="secondary">Abrir preferências</button>
          </article>
        </section>
      </>
    );
  if (section === "profile")
    return (
      <>
        <PageHeader
          title="Perfil e segurança"
          description="Dados pessoais, acesso e preferências da conta."
        />
        <section className="panel">
          <p>
            As alterações do perfil pessoal e senha são tratadas separadamente
            dos dados empresariais.
          </p>
          <button className="secondary">Solicitar troca de senha</button>
        </section>
      </>
    );
  return (
    <>
      <PageHeader
        title={
          section === "pix" ? "Configuração Pix" : "Empresa, endereços e coleta"
        }
        description={
          section === "pix"
            ? "Defina cobrança manual, ambiente simulado ou integração por API."
            : "Dados utilizados pelos lojistas como endereço de coleta e devolução."
        }
      />
      <form
        className="form-sections"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {section === "company" ? (
          <>
            <section className="panel">
              <h2>Dados da empresa</h2>
              <div className="form-grid">
                <label>
                  Razão/nome empresarial
                  <input
                    value={data.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                </label>
                <label>
                  CPF/CNPJ
                  <input
                    value={data.taxId}
                    onChange={(e) => set("taxId", e.target.value)}
                  />
                </label>
                <label>
                  E-mail operacional
                  <input
                    type="email"
                    value={data.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </label>
                <label>
                  Telefone
                  <input
                    value={data.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="panel">
              <h2>Endereço de coleta</h2>
              <p>
                Este endereço deve ser usado pelo lojista como origem/coleta ao
                gerar a etiqueta no marketplace.
              </p>
              <div className="form-grid">
                {Object.entries(data.pickupAddress).map(([k, v]) => (
                  <label key={k}>
                    {(
                      {
                        street: "Logradouro",
                        number: "Número",
                        complement: "Complemento",
                        district: "Bairro",
                        city: "Cidade",
                        state: "UF",
                        zipCode: "CEP",
                      } as Record<string, string>
                    )[k] || k}
                    <input
                      value={v}
                      onChange={(e) => addr(k, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="panel">
            <h2>Recebimento via Pix</h2>
            <div className="form-grid">
              <label>
                Modo
                <select
                  value={data.pixMode}
                  onChange={(e) => set("pixMode", e.target.value)}
                >
                  <option value="SIMULATED">Simulado (desenvolvimento)</option>
                  <option value="MANUAL">Conta/chave manual</option>
                  <option value="API">Integração por API</option>
                </select>
              </label>
              <label>
                Chave Pix
                <input
                  value={data.pixKey || ""}
                  onChange={(e) => set("pixKey", e.target.value)}
                />
              </label>
              <label>
                Beneficiário
                <input
                  value={data.pixBeneficiary || ""}
                  onChange={(e) => set("pixBeneficiary", e.target.value)}
                />
              </label>
              <label>
                Cidade
                <input
                  value={data.pixCity || ""}
                  onChange={(e) => set("pixCity", e.target.value)}
                />
              </label>
              {data.pixMode === "API" && (
                <>
                  <label>
                    Provedor
                    <input
                      value={data.pixProvider || ""}
                      onChange={(e) => set("pixProvider", e.target.value)}
                    />
                  </label>
                  <label>
                    URL da API
                    <input
                      value={data.pixApiUrl || ""}
                      onChange={(e) => set("pixApiUrl", e.target.value)}
                    />
                  </label>
                  <label className="full">
                    Token secreto
                    <input
                      type="password"
                      value={data.pixApiToken || ""}
                      onChange={(e) => set("pixApiToken", e.target.value)}
                      autoComplete="new-password"
                    />
                    <small>
                      O segredo será armazenado somente no servidor.
                    </small>
                  </label>
                </>
              )}
            </div>
          </section>
        )}
        {message && (
          <div
            className={
              message.includes("sucesso") ? "success-panel" : "form-error"
            }
          >
            {message}
          </div>
        )}
        <div className="sticky-actions">
          <button className="primary" disabled={busy}>
            <Save /> {busy ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </form>
    </>
  );
}
