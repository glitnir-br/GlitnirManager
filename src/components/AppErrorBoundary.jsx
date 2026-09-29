import React from 'react';

export default class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Falha ao renderizar a aplicação:', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-xl">
          <h1 className="text-xl font-semibold">Não foi possível carregar o Glitnir Manager</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Atualize a página. Se o problema continuar, informe este erro ao administrador.
          </p>
          <button
            type="button"
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Atualizar página
          </button>
        </section>
      </main>
    );
  }
}
