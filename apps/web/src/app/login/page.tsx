import { AuthForm } from "@/components/AuthForm";
import { loginAction } from "../actions/auth";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="pt-12">
      <AuthForm action={loginAction} mode="login" next={searchParams?.next} />
    </div>
  );
}
