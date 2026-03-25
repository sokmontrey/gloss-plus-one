type PopupHeaderProps = {
  title: string;
  description: string;
};

export function PopupHeader({ title, description }: PopupHeaderProps) {
  return (
    <header className="space-y-3">
      <div className="inline-flex w-fit items-center rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/80">
        GlossPlusOne
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}
