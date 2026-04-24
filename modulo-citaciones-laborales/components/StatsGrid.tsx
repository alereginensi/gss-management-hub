import React from 'react';
import { CitacionesStats } from '../types/citacion';

interface Props {
  stats: CitacionesStats;
}

function fmtUYU(n: number): string {
  return '$' + n.toLocaleString('es-UY');
}

export function StatsGrid({ stats }: Props) {
  return (
    <div className="cit-stats-grid">
      <StatCard label="Total casos" value={stats.total} />
      <StatCard label="Pendientes" value={stats.pendientes} accent="warn" />
      <StatCard label="En curso" value={stats.enCurso} accent="cur" />
      <StatCard label="Cerrados" value={stats.cerrados} />
      <StatCard label="Total reclamado" value={fmtUYU(stats.totalReclamado)} small />
      <StatCard label="Acuerdos pagados" value={fmtUYU(stats.totalAcuerdos)} small accent="cur" />
      <StatCard label="Honorarios" value={fmtUYU(stats.totalHonorarios)} small />
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
  accent,
}: {
  label: string;
  value: string | number;
  small?: boolean;
  accent?: 'warn' | 'cur';
}) {
  return (
    <div className="cit-stat-card">
      <div className="cit-stat-label">{label}</div>
      <div
        className={`cit-stat-value${small ? ' cit-stat-value--small' : ''}${accent ? ` cit-stat-value--${accent}` : ''}`}
      >
        {value}
      </div>
    </div>
  );
}
