type PopupStatusCardProps = {
  message: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<unknown>;
};

export function PopupStatusCard({
  message,
  isRefreshing,
  onRefresh,
}: PopupStatusCardProps) {
  return (
    <section className="status-card">
      <div className="status-card__row">
        <span className="status-card__label">Account</span>
        <button
          className="ghost-button"
          type="button"
          onClick={() => void onRefresh()}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <p className="status-card__message">{message}</p>
    </section>
  );
}
