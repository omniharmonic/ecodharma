import { AuthForm } from "@/components/AuthForm";
import { signupAction, signupGated } from "../actions/auth";

export default async function SignupPage() {
  const requirePassword = await signupGated();
  return (
    <div className="pt-12">
      <AuthForm action={signupAction} mode="signup" requirePassword={requirePassword} />
    </div>
  );
}
