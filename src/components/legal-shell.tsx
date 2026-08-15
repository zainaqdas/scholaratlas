export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      {updated && <p className="mt-2 text-sm text-muted-foreground">{updated}</p>}
      <div className="prose-sm mt-8 space-y-5 leading-relaxed text-foreground/85 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_a]:text-primary [&_a]:hover:underline">
        {children}
      </div>
    </div>
  );
}
