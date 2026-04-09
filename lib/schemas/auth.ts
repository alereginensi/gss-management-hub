import { z } from 'zod';

export const LoginSchema = z.object({
    email: z
        .string({ required_error: 'Email es obligatorio' })
        .email('Formato de email inválido')
        .max(254, 'Email demasiado largo')
        .toLowerCase(),
    password: z
        .string()
        .max(128, 'Contraseña demasiado larga')
        .optional(),
    isAdminLogin: z.boolean().optional().default(false),
});

export const RegisterSchema = z.object({
    name: z
        .string({ required_error: 'Nombre es obligatorio' })
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(100, 'Nombre demasiado largo')
        .regex(/^[a-zA-ZÀ-ÿ\s'.-]+$/, 'El nombre contiene caracteres no permitidos'),
    email: z
        .string({ required_error: 'Email es obligatorio' })
        .email('Formato de email inválido')
        .max(254, 'Email demasiado largo')
        .toLowerCase(),
    password: z
        .string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .max(128, 'Contraseña demasiado larga')
        .optional(),
    role: z
        .enum(['user', 'admin', 'supervisor', 'jefe', 'tecnico', 'contador', 'logistica', 'funcionario', 'mitrabajo'])
        .optional()
        .default('user'),
    rubro: z
        .string()
        .max(100, 'Rubro demasiado largo')
        .optional()
        .nullable(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
