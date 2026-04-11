import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Canvas error boundary:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error)
      return (
        <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 bg-[#f5f5f5] p-6 text-center text-gray-800">
          <p className="max-w-md text-sm">
            The 3D canvas hit an error (often after selecting a node or resizing
            the panel). You can try again or reload the page. Live sessions are
            restored from this browser tab when possible.
          </p>
          <pre className="max-h-32 max-w-full overflow-auto rounded bg-gray-200 px-3 py-2 text-left text-xs text-gray-700">
            {msg}
          </pre>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
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
