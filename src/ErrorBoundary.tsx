import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md px-8">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-lg font-bold">!</span>
            </div>
            <h2 className="text-base font-semibold text-[#0a0a0a] mb-1">Something went wrong</h2>
            <p className="text-sm text-muted mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={this.handleReset}
              className="h-8 px-4 text-xs font-medium rounded-md bg-[#0a0a0a] text-white hover:opacity-90 transition-all-expo"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}