import bcrypt from 'bcryptjs';

export function hashPasswordSync(password: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}
