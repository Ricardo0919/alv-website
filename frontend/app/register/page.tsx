import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "../../components/AuthForm";

export const metadata: Metadata = { title: "Crear cuenta · El Migajero" };

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
