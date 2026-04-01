"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, Suspense } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/custom/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resetPassword, ResetPasswordState } from "../actions";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, formAction] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Password updated! Redirecting to sign in…");
      setTimeout(() => router.push("/login"), 1500);
    } else if (state.status === "invalid_token") {
      toast.error("This reset link is invalid or has expired.");
    } else if (state.status === "invalid_data") {
      toast.error("Password must be at least 6 characters.");
    } else if (state.status === "failed") {
      toast.error("Something went wrong. Please try again.");
    }
  }, [state, router]);

  if (!token) {
    return (
      <div className="w-full max-w-md px-4 text-center sm:px-16">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Invalid reset link.{" "}
          <Link href="/forgot-password" className="font-semibold text-gray-800 hover:underline dark:text-zinc-200">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  if (state.status === "invalid_token") {
    return (
      <div className="w-full max-w-md px-4 text-center flex flex-col gap-4 sm:px-16">
        <h3 className="text-xl font-semibold dark:text-zinc-50">Link Expired</h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          This reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="font-semibold text-gray-800 hover:underline dark:text-zinc-200 text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12">
      <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
        <h3 className="text-xl font-semibold dark:text-zinc-50">Reset Password</h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Enter your new password below.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4 px-4 sm:px-16">
        <input type="hidden" name="token" value={token} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-zinc-600 font-normal dark:text-zinc-400">
            New Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Min. 6 characters"
            required
            minLength={6}
            className="bg-muted text-md md:text-sm border-none"
          />
        </div>
        <SubmitButton>Update Password</SubmitButton>
        <p className="text-center text-sm text-gray-600 mt-2 dark:text-zinc-400">
          <Link href="/login" className="font-semibold text-gray-800 hover:underline dark:text-zinc-200">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
