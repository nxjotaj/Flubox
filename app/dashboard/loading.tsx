export default function DashboardLoading() {
  return (
    <main className="dashboard-loading" aria-label="Carregando painel">
      <div className="loading-sidebar" />
      <section>
        <div className="loading-header" />
        <div className="loading-block large" />
        <div className="loading-block" />
      </section>
    </main>
  );
}
