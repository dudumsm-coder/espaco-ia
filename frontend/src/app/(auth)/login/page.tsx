import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
      <SignIn routing="hash" afterSignInUrl="/dashboard" />
    </div>
  );
}
