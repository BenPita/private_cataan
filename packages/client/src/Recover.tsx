import { Component, type ReactNode } from 'react';
import { diag } from './diag';
import { t } from './i18n';

/**
 * Safety net: if a screen crashes, report it and redraw it (the game state
 * comes back from the server) instead of leaving an empty page. Only after
 * repeated crashes in a short time does it ask the player to reload.
 */
export class Recover extends Component<{ children: ReactNode }, { attempt: number; failed: boolean }> {
  state = { attempt: 0, failed: false };
  private crashes: number[] = [];

  static getDerivedStateFromError() {
    return null;
  }

  componentDidCatch(error: Error) {
    diag('crash', `${error.message} ${error.stack?.split('\n')[1]?.trim() ?? ''}`);
    const now = Date.now();
    this.crashes = [...this.crashes.filter((at) => now - at < 15_000), now];
    if (this.crashes.length > 3) this.setState({ failed: true });
    else this.setState((s) => ({ attempt: s.attempt + 1 }));
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="screen center">
          <div className="card parchment">
            <h2>{t('crashTitle')}</h2>
            <button className="btn primary wide big" onClick={() => location.reload()}>
              {t('reload')}
            </button>
          </div>
        </div>
      );
    }
    return <RecoverKey key={this.state.attempt}>{this.props.children}</RecoverKey>;
  }
}

function RecoverKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
