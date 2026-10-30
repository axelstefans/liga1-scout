import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export interface TacticalSheetErrorBoundaryProps {
  resetKey?: number | string | null;
  children: React.ReactNode;
}

interface TacticalSheetErrorBoundaryState {
  hasError: boolean;
}

export class TacticalSheetErrorBoundary extends React.Component<
  TacticalSheetErrorBoundaryProps,
  TacticalSheetErrorBoundaryState
> {
  constructor(props: TacticalSheetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): TacticalSheetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      '[TacticalSheetErrorBoundary] Error rendering match report sheet:',
      error,
      errorInfo.componentStack
    );
  }

  componentDidUpdate(prevProps: TacticalSheetErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-slate-200/80 rounded-xl py-16 px-4 flex flex-col items-center justify-center text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-slate-400 mb-2.5" />
          <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-3">
            No se pudo renderizar la lámina para este encuentro
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TacticalSheetErrorBoundary;
