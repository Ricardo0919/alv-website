import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "../../components/AuthForm";

export const metadata: Metadata = { title: "Iniciar sesión · El Migajero" };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
