import AppMark from "./app-mark";
export default function SiteBrand() {
  return (
    <span className="brand">
      <AppMark size={32} />
      <span>
        invest<span className="brand-dot">.</span>ao
      </span>
    </span>
  );
}
