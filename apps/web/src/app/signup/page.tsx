import { AuthForm } from "@/components/AuthForm";
import { signupAction } from "../actions/auth";

export default function SignupPage() {
  return (
    <div className="pt-12">
      <AuthForm action={signupAction} mode="signup" />
    </div>
  );
}
