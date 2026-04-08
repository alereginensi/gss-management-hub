'use client';

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { filterArticulosPorBusqueda } from '@/lib/logistica-articulos';

type PopupPos = { top: number; left: number; width: number; maxHeight: number };

type Props = {
    options: string[];
    onSelect: (article: string) => void;
    placeholder?: string;
    /** Campos más bajos en pantallas chicas (modal móvil) */
    compact?: boolean;
};

export function ArticuloSearchAdd({ options, onSelect, placeholder = 'Buscar artículo…', compact = false }: Props) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [popupPos, setPopupPos] = useState<PopupPos | null>(null);
    const [mounted, setMounted] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const filtered = useMemo(() => filterArticulosPorBusqueda(options, query), [options, query]);

    useEffect(() => {
        setMounted(true);
    }, []);

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
        if (spaceBelow >= 100 || spaceBelow >= spaceAbove) {
            top = r.bottom + gap;
            maxH = Math.min(maxDefault, Math.max(100, spaceBelow));
        } else {
            maxH = Math.min(maxDefault, Math.max(100, spaceAbove));
            top = r.top - gap - maxH;
        }
        setPopupPos({
            top,
            left: r.left,
            width: Math.max(r.width, 200),
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
        const onDoc = (e: MouseEvent) => {
            const t = e.target as Node;
            if (wrapRef.current?.contains(t)) return;
            if (listRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => {
        setHighlight(0);
    }, [query, filtered.length]);

    const pick = (article: string) => {
        onSelect(article);
        setQuery('');
        setOpen(false);
        setHighlight(0);
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
            const a = filtered[highlight] ?? filtered[0];
            if (a) pick(a);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const emptySearch = query.trim().length > 0 && filtered.length === 0;
    const noOptionsLeft = options.length === 0;

    const listContent = (
        <>
            {noOptionsLeft ? (
                <li style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Ya agregaste todos los artículos de la lista o no hay ítems disponibles.
                </li>
            ) : emptySearch ? (
                <li style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    No hay coincidencias. Usá «Artículo manual» o «Agregar fila».
                </li>
            ) : (
                <>
                    {!query.trim() && options.length > filtered.length && (
                        <li
                            style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                borderBottom: '1px solid var(--border-color)',
                            }}
                        >
                            Escribí para filtrar entre {options.length} artículos (mostrando los primeros {filtered.length}).
                        </li>
                    )}
                    {filtered.map((a, i) => (
                        <li
                            key={`${i}-${a}`}
                            role="option"
                            aria-selected={i === highlight}
                            onMouseEnter={() => setHighlight(i)}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                pick(a);
                            }}
                            style={{
                                padding: '0.45rem 0.75rem',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                backgroundColor: i === highlight ? 'var(--bg-color)' : 'transparent',
                                color: 'var(--text-primary)',
                            }}
                        >
                            {a}
                        </li>
                    ))}
                </>
            )}
        </>
    );

    const dropdown =
        open &&
        mounted &&
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
                    padding: '0.35rem 0',
                    margin: 0,
                    listStyle: 'none',
                    backgroundColor: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                }}
            >
                {listContent}
            </ul>,
            document.body
        );

    const pad = compact ? '0.28rem 0.45rem' : '0.35rem 0.55rem';
    const iconSz = compact ? 14 : 16;
    const inputFs = compact ? '0.8125rem' : '0.8rem';

    return (
        <div ref={wrapRef} style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: '100%', width: compact ? '100%' : undefined }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: compact ? '0.28rem' : '0.35rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    padding: pad,
                    backgroundColor: 'var(--bg-color)',
                    minHeight: compact ? '2rem' : undefined,
                    boxSizing: 'border-box',
                }}
            >
                <Search size={iconSz} color="var(--text-secondary)" style={{ flexShrink: 0 }} aria-hidden />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: inputFs,
                        color: 'var(--text-primary)',
                        minWidth: compact ? 0 : '100px',
                    }}
                />
            </div>
            {dropdown}
        </div>
    );
}
