import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export const metadata: Metadata = { title: "Set a new password · Registro" };

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
