"use server";

import { z } from "zod";

import {
  createPasswordResetToken,
  createUser,
  deletePasswordResetToken,
  getPasswordResetToken,
  getUser,
  updateUserPassword,
} from "@/db/queries";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const emailSchema = z.object({ email: z.string().email() });

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export interface LoginActionState {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export interface RegisterActionState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data"
    | "access_denied";
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    let [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    } else {
      await createUser(validatedData.email, validatedData.password);
      await signIn("credentials", {
        email: validatedData.email,
        password: validatedData.password,
        redirect: false,
      });

      return { status: "success" };
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    if ((error as Error).message.includes("This user email is not allowed to register")) {
      return { status: "access_denied" };
    }

    return { status: "failed" };
  }
};

export interface RequestPasswordResetState {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
  token?: string;
}

export const requestPasswordReset = async (
  _: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> => {
  try {
    const { email } = emailSchema.parse({ email: formData.get("email") });
    const [existingUser] = await getUser(email);
    if (existingUser) {
      const token = await createPasswordResetToken(email);
      return { status: "success", token };
    }
    // Don't reveal whether the email exists
    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) return { status: "invalid_data" };
    return { status: "failed" };
  }
};

export interface ResetPasswordState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "invalid_token";
}

export const resetPassword = async (
  _: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> => {
  try {
    const { token, password } = resetPasswordSchema.parse({
      token: formData.get("token"),
      password: formData.get("password"),
    });

    const record = await getPasswordResetToken(token);
    if (!record || record.expiresAt < new Date()) {
      return { status: "invalid_token" };
    }

    await updateUserPassword(record.email, password);
    await deletePasswordResetToken(token);
    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) return { status: "invalid_data" };
    return { status: "failed" };
  }
};
