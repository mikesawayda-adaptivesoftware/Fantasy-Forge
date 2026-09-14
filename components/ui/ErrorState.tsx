interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = 'Something went wrong loading data.', onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-12" role="alert">
      <span className="text-4xl mb-4 block">⚠️</span>
      <p className="text-red">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-4">
          Try again
        </button>
      )}
    </div>
  );
}
