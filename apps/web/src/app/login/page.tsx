import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "../actions/auth";

export default function LoginPage() {
  return (
    <div className="pt-12">
      <AuthForm action={loginAction} mode="login" />
    </div>
  );
}
