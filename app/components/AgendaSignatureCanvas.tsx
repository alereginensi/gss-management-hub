'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import SignaturePad from 'signature_pad';

export interface AgendaSignatureCanvasRef {
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
}

const AgendaSignatureCanvas = forwardRef<AgendaSignatureCanvasRef, Props>(
  ({ onChange, disabled = false, label }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const padRef = useRef<SignaturePad | null>(null);

    useImperativeHandle(ref, () => ({
      clear() {
        if (!padRef.current) return;
        padRef.current.clear();
        onChange(null);
      },
      isEmpty() {
        return padRef.current ? padRef.current.isEmpty() : true;
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const context = canvas.getContext('2d');
      if (context) context.scale(ratio, ratio);

      const pad = new SignaturePad(canvas, {
        minWidth: 0.8,
        maxWidth: 2,
        penColor: '#1B2A4A',
        backgroundColor: 'rgba(255,255,255,1)',
      });
      padRef.current = pad;

      if (disabled) pad.off();

      const handleEndStroke = () => {
        if (pad.isEmpty()) {
          onChange(null);
          return;
        }
        onChange(pad.toDataURL('image/png'));
      };

      pad.addEventListener('endStroke', handleEndStroke);

      return () => {
        pad.removeEventListener('endStroke', handleEndStroke);
        pad.off();
      };
    }, [onChange, disabled]);

    function handleClear() {
      if (!padRef.current || disabled) return;
      padRef.current.clear();
      onChange(null);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {label && (
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{label}</span>
        )}
        <div
          style={{
            border: '1.5px solid #e2e8f0',
            borderRadius: '8px',
            background: disabled ? '#f8fafc' : '#fff',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '160px',
              display: 'block',
              cursor: disabled ? 'not-allowed' : 'crosshair',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#f8fafc',
              color: '#64748b',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Limpiar
          </button>
        </div>
      </div>
    );
  }
);

AgendaSignatureCanvas.displayName = 'AgendaSignatureCanvas';

export default AgendaSignatureCanvas;
