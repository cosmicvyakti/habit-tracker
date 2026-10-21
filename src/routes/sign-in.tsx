import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/lime/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/lime/ui/field";
import { Input } from "@/components/lime/ui/input";
import { logQuery, markSignedIn, signedIn, syncNow } from "../data";
import { signInSchema } from "../lib/session";
import { signIn } from "../server/api";

export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Sign in · Habit tracker" }] }),
  beforeLoad: async () => {
    if (await signedIn()) throw redirect({ to: "/" });
  },
  component: SignIn,
});

const PROBLEM = {
  wrong: "That email and password don't match. Check both, then try again.",
  locked: "Too many tries. Wait 15 minutes, then try again.",
  offline: "Couldn't reach the server. Check your connection, then try again.",
} as const;

function SignIn() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const formRef = useRef<HTMLFormElement>(null);
  const [problem, setProblem] = useState<keyof typeof PROBLEM | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      const result = await signIn({ data: value }).catch(() => "offline" as const);
      if (result !== "ok") return setProblem(result);
      markSignedIn(value.email.toLowerCase());
      // Changes queued while signed out go out now, and the log loads fresh.
      syncNow();
      await queryClient.invalidateQueries({ queryKey: logQuery.queryKey });
      await navigate({ to: "/" });
    },
    onSubmitInvalid: () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()),
  });

  return (
    <main className="flex w-full max-w-sm flex-col gap-y-5 pbe-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        <span className="sr-only">Sign in to </span>Habit tracker
      </h1>
      <form
        ref={formRef}
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => (
            <Field name="email" invalid={field.state.meta.errors.length > 0}>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                autoComplete="username"
                maxLength={200}
              />
              {field.state.meta.errors.length > 0 && <FieldError match>{field.state.meta.errors[0]?.message}</FieldError>}
            </Field>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <Field name="password" invalid={field.state.meta.errors.length > 0}>
              <FieldLabel>Password</FieldLabel>
              <Input
                type="password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                autoComplete="current-password"
                maxLength={200}
              />
              {field.state.meta.errors.length > 0 && <FieldError match>{field.state.meta.errors[0]?.message}</FieldError>}
            </Field>
          )}
        </form.Field>
        {problem && (
          <p role="alert" className="body text-danger-text">
            {PROBLEM[problem]}
          </p>
        )}
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" size="lg" pending={submitting} className="mbs-4 w-full">
              Sign in
            </Button>
          )}
        </form.Subscribe>
      </form>
    </main>
  );
}
