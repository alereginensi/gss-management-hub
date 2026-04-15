// Funciones UI puras del módulo Agenda — sin imports de DB ni Node.js.
// Seguro para importar en componentes cliente ('use client').

import type { AgendaArticle, OrderItem } from '@/lib/agenda-types';

// ─── Fechas y vencimientos ────────────────────────────────────────────────────

export function calculateExpirationDate(deliveryDate: string, usefulLifeMonths: number): string {
  const date = new Date(deliveryDate);
  date.setMonth(date.getMonth() + usefulLifeMonths);
  return date.toISOString().split('T')[0];
}

export function isRenewalEnabled(expirationDate: string): boolean {
  return new Date(expirationDate) <= new Date();
}

export function daysUntilExpiration(expirationDate: string): number {
  const exp = new Date(expirationDate);
  const now = new Date();
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Artículos ────────────────────────────────────────────────────────────────

export function parseOrderItems(raw: unknown): any[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

export function renderOrderItemLabel(item: any): string {
  if (!item) return '';
  const qty = item.qty || item.quantity || 1;
  const name = item.article_type || item.article_name_normalized || item.item || 'Artículo';
  const size = item.size || '';
  const color = item.color || '';
  
  let label = `${qty}x ${name}`;
  if (size || color) {
    label += ` (${[size, color].filter(Boolean).join(' · ')})`;
  }
  return label;
}

export function articleNeedsRenewal(article: AgendaArticle): boolean {
  if (!article.expiration_date) return false;
  return isRenewalEnabled(article.expiration_date) && article.current_status === 'activo';
}

// ─── Badges de estado ─────────────────────────────────────────────────────────

export function getAppointmentStatusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    confirmada:   { label: 'Confirmada',   color: '#1e40af', bg: '#dbeafe' },
    en_proceso:   { label: 'En Proceso',   color: '#92400e', bg: '#fef3c7' },
    completada:   { label: 'Completada',   color: '#065f46', bg: '#d1fae5' },
    cancelada:    { label: 'Cancelada',    color: '#7f1d1d', bg: '#fee2e2' },
    ausente:      { label: 'Ausente',      color: '#4b5563', bg: '#f3f4f6' },
    reprogramada: { label: 'Reprogramada', color: '#5b21b6', bg: '#ede9fe' },
  };
  return map[status] || { label: status, color: '#374151', bg: '#f9fafb' };
}

export function getArticleStatusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    activo:    { label: 'Activo',    color: '#065f46', bg: '#d1fae5' },
    renovado:  { label: 'Renovado', color: '#1e40af', bg: '#dbeafe' },
    devuelto:  { label: 'Devuelto', color: '#4b5563', bg: '#f3f4f6' },
    extraviado:{ label: 'Extraviado',color: '#7f1d1d', bg: '#fee2e2' },
  };
  return map[status] || { label: status, color: '#374151', bg: '#f9fafb' };
}

export function getShipmentStatusBadge(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    preparado:   { label: 'Preparado',   color: '#92400e', bg: '#fef3c7' },
    despachado:  { label: 'Despachado',  color: '#1e40af', bg: '#dbeafe' },
    en_transito: { label: 'En Tránsito', color: '#5b21b6', bg: '#ede9fe' },
    entregado:   { label: 'Entregado',   color: '#065f46', bg: '#d1fae5' },
    recibido:    { label: 'Recibido',    color: '#065f46', bg: '#d1fae5' },
    incidente:   { label: 'Incidente',   color: '#7f1d1d', bg: '#fee2e2' },
  };
  return map[status] || { label: status, color: '#374151', bg: '#f9fafb' };
}
