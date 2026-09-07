import bcrypt from "bcryptjs";
import { z } from "zod";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Requires at least one letter and one number on top of the length floor —
// stops trivially weak passwords ("password", "12345678") without being
// so strict it drives customers to reuse passwords elsewhere out of frustration.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters") // bcrypt silently truncates beyond this
  .regex(/[a-zA-Z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");
