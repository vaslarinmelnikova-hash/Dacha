import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  message: string | null
}

/**
 * Without this, anything that throws during render leaves a blank white page with the reason
 * visible only in the browser console — which is out of reach on a phone.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error, info.componentStack)
  }

  render() {
    if (this.state.message === null) return this.props.children

    return (
      <div className="max-w-md mx-auto p-6 text-gray-800 dark:text-white">
        <h1 className="text-xl font-bold mb-2">Что-то сломалось</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Приложение не смогло запуститься. Покажите этот текст тому, кто его чинит.
        </p>
        <pre className="text-xs whitespace-pre-wrap break-words bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
          {this.state.message}
        </pre>
      </div>
    )
  }
}
