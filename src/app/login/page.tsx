"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
export default function LoginPage() {
 const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login successful!");
    router.push("/dashboard");
  } catch (error: any) {
    alert(error.message);
  }
};
const handleResetPassword = async () => {
  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent!");
  } catch (error: any) {
    alert(error.message);
  }
};
return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-gray-950 to-black px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Welcome Back
        </h1>

        <p className="mb-8 text-center text-gray-400">
          Sign in to your NeoCloud account
        </p>

       <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
           value={email}
onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          />

          <input
            type="password"
            placeholder="Password"
           value={password}
onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Sign In
          </button>
       <button
  type="button"
  onClick={handleResetPassword}
  className="w-full text-sm text-blue-400 hover:text-blue-300"
>
  Forgot Password?
</button>
        </form>
<div className="mt-6 text-center">
  <Link
    href="/"
    className="text-blue-400 hover:text-blue-300"
  >
    ← Back to Home
  </Link>
</div>
        <p className="mt-6 text-center text-sm text-gray-400">
  Don't have an account?{" "}
  <Link href="/signup" className="text-blue-400 hover:text-blue-300">
    Sign Up
  </Link>
</p>
      </div>
    </main>
  );
}