import LoadingSpinner from './LoadingSpinner';

export default function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12" role="status">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-text-secondary">{message}</p>
    </div>
  );
}
