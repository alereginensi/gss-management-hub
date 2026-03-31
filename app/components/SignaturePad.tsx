'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Trash2, Check, X } from 'lucide-react';

interface SignaturePadProps {
    onSave: (signature: string) => void;
    onCancel: () => void;
    title?: string;
}

export default function SignaturePad({ onSave, onCancel, title = 'Firma Virtual' }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set line style
        ctx.strokeStyle = '#000';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;

        const handleResize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            // Clear on resize
            clearCanvas();
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        setIsEmpty(false);

        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const endDrawing = () => {
        setIsDrawing(false);
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas || isEmpty) return;
        
        // Trim whitespace if possible, but for simple base64 it's fine
        const signature = canvas.toDataURL('image/png');
        onSave(signature);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
                width: '90%', maxWidth: '500px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    border: '2px dashed #d1d5db', borderRadius: '8px',
                    height: '240px', position: 'relative', overflow: 'hidden',
                    touchAction: 'none', backgroundColor: '#f9fafb'
                }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={endDrawing}
                        onMouseLeave={endDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={endDrawing}
                        style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                    />
                    {isEmpty && (
                        <p style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)', color: '#9ca3af',
                            pointerEvents: 'none', fontSize: '0.85rem'
                        }}>
                            Firme aquí
                        </p>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
                    <button
                        onClick={clearCanvas}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.6rem 1rem', border: '1px solid #d1d5db',
                            borderRadius: '8px', fontSize: '0.875rem', color: '#374151',
                            cursor: 'pointer', backgroundColor: 'white'
                        }}
                    >
                        <Trash2 size={15} /> Limpiar
                    </button>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={onCancel}
                            style={{
                                padding: '0.6rem 1rem', border: 'none',
                                borderRadius: '8px', fontSize: '0.875rem',
                                color: '#6b7280', cursor: 'pointer', backgroundColor: 'transparent'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isEmpty}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.6rem 1.25rem', border: 'none',
                                borderRadius: '8px', fontSize: '0.875rem',
                                color: 'white', backgroundColor: isEmpty ? '#9ca3af' : '#1d3461',
                                cursor: isEmpty ? 'not-allowed' : 'pointer', fontWeight: 600
                            }}
                        >
                            <Check size={15} /> Guardar Firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
