import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { createWorker } from 'tesseract.js';

const AUTH_ROLES = ['admin', 'logistica', 'jefe', 'supervisor'];

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !AUTH_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize Tesseract worker
    const worker = await createWorker('spa'); // Use Spanish as default
    
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();

    return NextResponse.json({ text });
  } catch (err) {
    console.error('OCR Error:', err);
    return NextResponse.json({ error: 'Error al procesar la imagen (OCR)' }, { status: 500 });
  }
}
