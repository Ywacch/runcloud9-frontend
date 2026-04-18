import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  resetKey?: string | number
}

interface State {
  error: Error | null
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Canvas error boundary:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error)
      return (
        <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 bg-gray-950 p-6 text-center text-gray-100">
          <p className="max-w-md text-sm text-gray-300">
            The 3D canvas hit a render error. Click &ldquo;Try again&rdquo; to recover — your design is preserved.
          </p>
          <pre className="max-h-32 max-w-full overflow-auto rounded bg-gray-800 px-3 py-2 text-left text-xs text-red-300">
            {msg}
          </pre>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
