export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center text-2xl font-extrabold tracking-tight ${className}`}>
      <span style={{ color: 'var(--text)' }}>Yes</span>
      <span className="gradient-text">Editor</span>
    </span>
  );
}
