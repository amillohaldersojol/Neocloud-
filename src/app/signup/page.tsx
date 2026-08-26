"use client";
import Link from "next/link";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
export default function SignupPage() {
  const [email, setEmail] = useState("");
const [password, setPassword] = useState("");

const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Account created successfully!");
  } catch (error: any) {
    alert(error.message);
  }
};
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black via-gray-950 to-black px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="mb-2 text-center text-3xl font-bold text-white">
          Create Account
        </h1>

        <p className="mb-8 text-center text-gray-400">
          Join NeoCloud today
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
        
           className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white outline-none"
          />

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
            Create Account
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300"
          >
            Already have an account? Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}