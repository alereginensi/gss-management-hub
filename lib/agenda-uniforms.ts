export interface UniformItem {
  name: string;
  sizes: string[];
  colors?: string[];
}

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

export const COMPANY_UNIFORMS: Record<string, UniformItem[]> = {
  REIMA: [
    { name: 'Camisa manga larga', sizes: CLOTHING_SIZES },
    { name: 'Corbata', sizes: ['Única'] },
    { name: 'Calzado de vestir', sizes: SHOE_SIZES },
    { name: 'Buzo escote V', sizes: CLOTHING_SIZES },
    { name: 'Chaqueta de vestir', sizes: CLOTHING_SIZES },
    { name: 'Saco de vestir', sizes: CLOTHING_SIZES },
    { name: 'Pantalón de vestir', sizes: CLOTHING_SIZES },
    { name: 'Remera gris', sizes: CLOTHING_SIZES },
    { name: 'Zapato de vestir', sizes: SHOE_SIZES },
    { name: 'Zapato negro sin puntera', sizes: SHOE_SIZES },
    { name: 'Buzo polar gris', sizes: CLOTHING_SIZES },
    { name: 'Campera gris', sizes: CLOTHING_SIZES },
    { name: 'Campera de Abrigo', sizes: CLOTHING_SIZES },
    { name: 'Camisa Ejecutiva', sizes: CLOTHING_SIZES },
    { name: 'Camisa de Cargo Gris', sizes: CLOTHING_SIZES },
    { name: 'Pantalón cargo', sizes: CLOTHING_SIZES },
  ],
  ORBIS: [
    { name: 'Camisa manga larga', sizes: CLOTHING_SIZES },
    { name: 'Chaqueta de vestir', sizes: CLOTHING_SIZES },
    { name: 'Saco de vestir', sizes: CLOTHING_SIZES },
    { name: 'Pantalón de vestir', sizes: CLOTHING_SIZES },
    { name: 'Corbata', sizes: ['Única'] },
    { name: 'Calzado de vestir', sizes: SHOE_SIZES },
    { name: 'Buzo escote V', sizes: CLOTHING_SIZES },
    { name: 'Pañuelo', sizes: ['Única'] },
  ],
  ERGON: [
    { name: 'Calzado', sizes: SHOE_SIZES },
    { name: 'Remera Polo Gris', sizes: CLOTHING_SIZES },
    { name: 'Polo', sizes: CLOTHING_SIZES },
    { name: 'Pantalón cargo', sizes: CLOTHING_SIZES },
  ],
  SCOUT: [
    { name: 'Casaca médica Blanca', sizes: CLOTHING_SIZES, colors: ['Blanca', 'Azul'] },
    { name: 'Casaca médica Azul', sizes: CLOTHING_SIZES, colors: ['Blanca', 'Azul'] },
    { name: 'Casaca médica', sizes: CLOTHING_SIZES, colors: ['Blanca', 'Azul'] },
    { name: 'Pantalón médico Blanco', sizes: CLOTHING_SIZES, colors: ['Blanco', 'Azul'] },
    { name: 'Pantalón médico Azul', sizes: CLOTHING_SIZES, colors: ['Blanco', 'Azul'] },
    { name: 'Pantalón médico', sizes: CLOTHING_SIZES, colors: ['Blanco', 'Azul'] },
    { name: 'Buzo polar Blanco', sizes: CLOTHING_SIZES, colors: ['Blanco', 'Azul', 'Gris'] },
    { name: 'Buzo polar Azul', sizes: CLOTHING_SIZES, colors: ['Blanco', 'Azul', 'Gris'] },
    { name: 'Buzo polar', sizes: CLOTHING_SIZES, colors: ['Blanco', 'Azul', 'Gris'] },
    { name: 'Crocs', sizes: SHOE_SIZES },
    { name: 'Zapato negro sin puntera', sizes: SHOE_SIZES },
    { name: 'Bota de PVC Blanca', sizes: SHOE_SIZES },
  ],
};

export function getUniformsForEmpresa(empresa: string | null | undefined): UniformItem[] {
  if (!empresa) return [];
  const key = String(empresa).trim().toUpperCase();
  return COMPANY_UNIFORMS[key] || [];
}
