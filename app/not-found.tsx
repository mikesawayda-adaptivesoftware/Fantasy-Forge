import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-12">
      <span className="text-4xl mb-4 block">🏈</span>
      <h2 className="text-xl font-semibold text-white mb-2">Page not found</h2>
      <p className="text-text-secondary mb-6">That play isn&apos;t in the playbook.</p>
      <Link href="/" className="btn-primary inline-block">
        Back to Dashboard
      </Link>
    </div>
  );
}
