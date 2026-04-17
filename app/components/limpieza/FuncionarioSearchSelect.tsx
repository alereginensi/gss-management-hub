'use client';

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

type Funcionario = {
    id: number;
    nombre: string;
    cedula: string;
    cliente?: string;
};

type PopupPos = { top: number; left: number; width: number; maxHeight: number };

type Props = {
    funcionarios: Funcionario[];
    value: number | null;
    onChange: (id: string) => void;
    cliente?: string;
    placeholder?: string;
    disabled?: boolean;
};

function normalize(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w]/g, '');
}

export function FuncionarioSearchSelect({ funcionarios, value, onChange, cliente, placeholder = 'Buscar por nombre o cédula…', disabled = false }: Props) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [popupPos, setPopupPos] = useState<PopupPos | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const modalInputRef = useRef<HTMLInputElement>(null);

    const selected = useMemo(() => funcionarios.find(f => f.id === value) || null, [funcionarios, value]);

    const scoped = useMemo(() => {
        if (!cliente || cliente === 'Todos') return funcionarios;
        const c = cliente.toLowerCase();
        return funcionarios.filter(f => (f.cliente || '').toLowerCase() === c);
    }, [funcionarios, cliente]);

    const filtered = useMemo(() => {
        const q = normalize(query);
        if (!q) return scoped.slice(0, 100);
        return scoped.filter(f => {
            const n = normalize(f.nombre || '');
            const c = normalize(f.cedula || '');
            return n.includes(q) || c.includes(q);
        }).slice(0, 100);
    }, [scoped, query]);

    useEffect(() => {
        setMounted(true);
        const mq = window.matchMedia('(max-width: 768px)');
        setIsMobile(mq.matches);
        const onChg = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', onChg);
        return () => mq.removeEventListener('change', onChg);
    }, []);

    useEffect(() => {
        if (isMobile && open) {
            const id = window.setTimeout(() => modalInputRef.current?.focus(), 60);
            return () => window.clearTimeout(id);
        }
    }, [isMobile, open]);

    const updatePopupPosition = useCallback(() => {
        const el = wrapRef.current;
        if (!el || !open) return;
        const r = el.getBoundingClientRect();
        const gap = 4;
        const margin = 8;
        const maxDefault = 280;
        const spaceBelow = window.innerHeight - r.bottom - gap - margin;
        const spaceAbove = r.top - margin - gap;
        let top: number;
        let maxH: number;
        if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
            top = r.bottom + gap;
            maxH = Math.min(maxDefault, Math.max(120, spaceBelow));
        } else {
            maxH = Math.min(maxDefault, Math.max(120, spaceAbove));
            top = r.top - gap - maxH;
        }
        setPopupPos({
            top,
            left: r.left,
            width: Math.max(r.width, 220),
            maxHeight: maxH,
        });
    }, [open]);

    useLayoutEffect(() => {
        if (!open) {
            setPopupPos(null);
            return;
        }
        updatePopupPosition();
    }, [open, query, filtered.length, updatePopupPosition]);

    useEffect(() => {
        if (!open) return;
        const r = () => updatePopupPosition();
        window.addEventListener('resize', r);
        window.addEventListener('scroll', r, true);
        return () => {
            window.removeEventListener('resize', r);
            window.removeEventListener('scroll', r, true);
        };
    }, [open, updatePopupPosition]);

    useEffect(() => {
        if (isMobile) return;
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t)) return;
            if (listRef.current?.contains(t)) return;
            setOpen(false);
            setQuery('');
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [isMobile]);

    useEffect(() => {
        setHighlight(0);
    }, [query, filtered.length]);

    const pick = (f: Funcionario) => {
        onChange(String(f.id));
        setQuery('');
        setOpen(false);
        setHighlight(0);
    };

    const clear = () => {
        onChange('');
        setQuery('');
        setOpen(false);
        inputRef.current?.focus();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            if (filtered.length > 0) setOpen(true);
            return;
        }
        if (!open) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && filtered.length > 0) {
            e.preventDefault();
            const f = filtered[highlight] ?? filtered[0];
            if (f) pick(f);
        } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
        }
    };

    const displayValue = open ? query : (selected?.nombre || '');

    const listContent = filtered.length === 0 ? (
        <li style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
            {query.trim() ? 'Sin coincidencias' : 'Sin funcionarios para este cliente'}
        </li>
    ) : (
        filtered.map((f, i) => (
            <li
                key={f.id}
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                    e.preventDefault();
                    pick(f);
                }}
                style={{
                    padding: '0.7rem 0.9rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    backgroundColor: i === highlight ? '#eff6ff' : 'transparent',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    lineHeight: 1.3,
                    minWidth: 0,
                }}
            >
                <span style={{ fontWeight: 600, color: '#1d3461', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>CI {f.cedula}</span>
            </li>
        ))
    );

    const desktopDropdown =
        open &&
        mounted &&
        !isMobile &&
        popupPos &&
        createPortal(
            <ul
                ref={listRef}
                role="listbox"
                style={{
                    position: 'fixed',
                    zIndex: 10050,
                    top: popupPos.top,
                    left: popupPos.left,
                    width: popupPos.width,
                    maxHeight: popupPos.maxHeight,
                    overflowY: 'auto',
                    padding: 0,
                    margin: 0,
                    listStyle: 'none',
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                }}
            >
                {listContent}
            </ul>,
            document.body
        );

    const mobileModal =
        open &&
        mounted &&
        isMobile &&
        createPortal(
            <div
                role="dialog"
                aria-modal="true"
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10060,
                    backgroundColor: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                }}>
                    <Search size={18} color="#64748b" style={{ flexShrink: 0 }} aria-hidden />
                    <input
                        ref={modalInputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={placeholder}
                        autoComplete="off"
                        style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: '1rem',
                            color: '#1d3461',
                            minWidth: 0,
                            padding: '0.3rem 0',
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => { setOpen(false); setQuery(''); }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.4rem',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        aria-label="Cerrar"
                    >
                        <X size={22} />
                    </button>
                </div>
                <ul
                    ref={listRef}
                    role="listbox"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 0,
                        margin: 0,
                        listStyle: 'none',
                        backgroundColor: '#fff',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    {listContent}
                </ul>
            </div>,
            document.body
        );

    return (
        <div ref={wrapRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    borderBottom: '1px solid #cbd5e1',
                    padding: '0.2rem 0',
                    background: 'transparent',
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <Search size={14} color="#94a3b8" style={{ flexShrink: 0 }} aria-hidden />
                <input
                    ref={inputRef}
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        setQuery('');
                    }}
                    onClick={() => {
                        if (isMobile) setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={selected ? '' : placeholder}
                    disabled={disabled}
                    readOnly={isMobile}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: isMobile ? '16px' : '0.8rem',
                        fontWeight: 600,
                        color: '#1d3461',
                        minWidth: 0,
                        padding: 0,
                    }}
                />
                {selected && !disabled && (
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); clear(); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', display: 'flex' }}
                        aria-label="Limpiar selección"
                        title="Limpiar selección"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            {desktopDropdown}
            {mobileModal}
        </div>
    );
}
