export function Page({ title, subtitle, children, className = "" }: { title?: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <main className={`mx-auto w-full max-w-lg flex-1 px-4 pt-6 pb-nav ${className}`}>
      {title && <h1 className="text-2xl">{title}</h1>}
      {subtitle && <p className="mt-1 text-text">{subtitle}</p>}
      <div className={title ? "mt-6" : ""}>{children}</div>
    </main>
  );
}
