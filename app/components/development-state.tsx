import Link from "next/link";
import { webFeatureStatus, type WebFeature } from "../../lib/web-feature-status";
import Icon from "./invest-icon";

export function DevelopmentBadge() {
  return <span className="development-badge">Em desenvolvimento · Em breve</span>;
}

export default function DevelopmentState({ feature, compact = false, link = false }: {
  feature: WebFeature;
  compact?: boolean;
  link?: boolean;
}) {
  const item = webFeatureStatus[feature];
  return (
    <aside className={`development-state${compact ? " development-state-compact" : ""}`} aria-label={`${item.title} — em desenvolvimento`}>
      <div className="development-state-heading"><Icon name="info" size={18} /><DevelopmentBadge /></div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      {link && <Link href={item.href} className="text-button">{item.action}</Link>}
    </aside>
  );
}
