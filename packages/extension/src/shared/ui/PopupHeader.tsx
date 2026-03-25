type PopupHeaderProps = {
  title: string;
  description: string;
};

export function PopupHeader({ title, description }: PopupHeaderProps) {
  return (
    <header className="hero">
      <div className="hero__eyebrow">GlossPlusOne</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
