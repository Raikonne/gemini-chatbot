"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/custom/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestPasswordReset, RequestPasswordResetState } from "../actions";

export default function Page() {
  const [state, formAction] = useActionState<RequestPasswordResetState, FormData>(
    requestPasswordReset,
    { status: "idle" },
  );

  const [resetUrl, setResetUrl] = useState("");

  useEffect(() => {
    if (state.status === "failed") {
      toast.error("Something went wrong. Please try again.");
    } else if (state.status === "invalid_data") {
      toast.error("Please enter a valid email address.");
    } else if (state.status === "success" && state.token) {
      setResetUrl(`${window.location.origin}/reset-password?token=${state.token}`);
      toast.success("Reset link generated!");
    }
  }, [state]);

  if (state.status === "success") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-8 px-4 sm:px-16">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <h3 className="text-xl font-semibold dark:text-zinc-50">Reset Link Ready</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {state.token
                ? "Copy the link below and open it to reset your password."
                : "If that email is registered, a reset link would be sent. (No email configured — contact an admin.)"}
            </p>
          </div>
          {state.token && resetUrl && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Your reset link (expires in 1 hour):</p>
              <a
                href={resetUrl}
                className="block break-all rounded-md bg-muted px-3 py-2.5 text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:bg-muted/80 transition-colors"
              >
                {resetUrl}
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resetUrl);
                  toast.success("Copied to clipboard!");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline self-start transition-colors"
              >
                Copy to clipboard
              </button>
            </div>
          )}
          <Link
            href="/login"
            className="text-center text-sm text-gray-600 hover:underline dark:text-zinc-400"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Forgot Password</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Enter your email to get a password reset link.
          </p>
        </div>
        <form action={formAction} className="flex flex-col gap-4 px-4 sm:px-16">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-zinc-600 font-normal dark:text-zinc-400">
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="user@acme.com"
              autoComplete="email"
              required
              className="bg-muted text-md md:text-sm border-none"
            />
          </div>
          <SubmitButton>Get Reset Link</SubmitButton>
          <p className="text-center text-sm text-gray-600 mt-2 dark:text-zinc-400">
            <Link href="/login" className="font-semibold text-gray-800 hover:underline dark:text-zinc-200">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
