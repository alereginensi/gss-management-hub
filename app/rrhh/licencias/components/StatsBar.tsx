import type { Licencia } from '../hooks/useLicenciasApi';

export default function StatsBar({ licencias }: { licencias: Licencia[] }) {
  const total = licencias.length;
  const completas = licencias.filter((l) => l.recepNotificacion && l.supervision && l.recepCertificado && l.planificacion).length;
  const pendientes = total - completas;
  const porTipo = new Map<string, number>();
  for (const l of licencias) {
    porTipo.set(l.tipoLicencia, (porTipo.get(l.tipoLicencia) || 0) + 1);
  }
  const tipoTop = [...porTipo.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="lic-stats">
      <div className="lic-stat">
        <div className="lic-stat-n">{total}</div>
        <div className="lic-stat-l">Total</div>
      </div>
      <div className="lic-stat lic-stat--ok">
        <div className="lic-stat-n">{completas}</div>
        <div className="lic-stat-l">Completas</div>
      </div>
      <div className="lic-stat lic-stat--pending">
        <div className="lic-stat-n">{pendientes}</div>
        <div className="lic-stat-l">Pendientes</div>
      </div>
      <div className="lic-stat">
        <div className="lic-stat-n">{tipoTop ? tipoTop[1] : 0}</div>
        <div className="lic-stat-l">{tipoTop ? tipoTop[0] : '—'}</div>
      </div>
    </div>
  );
}
