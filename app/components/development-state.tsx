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

export function DevelopmentOverview({ appleDeletionAvailable }: { appleDeletionAvailable: boolean }) {
  const features = (Object.keys(webFeatureStatus) as WebFeature[]).filter((feature) => feature !== "appleDeletion" || !appleDeletionAvailable);
  return (
    <section className="public-section development-overview" aria-labelledby="development-title">
      <div className="section-title">
        <div><p className="eyebrow">A CAMINHO DA WEB</p><h2 id="development-title">Ainda estamos a desenvolver.</h2></div>
      </div>
      <p className="development-intro">Estas funcionalidades ainda não estão concluídas. As opções já disponíveis continuam acessíveis.</p>
      <div className="development-grid">{features.map((feature) => <DevelopmentState key={feature} feature={feature} link />)}</div>
    </section>
  );
}
