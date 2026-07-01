"use no memo";

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import bcrypt from "bcryptjs";
import axios from "axios";
import { useNavigate } from "react-router";

import { signUpSchema, type SignUpInput } from "./schemas"
import { AuthCard } from "./AuthCard"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { MailIcon, LockIcon, EyeIcon, EyeSlashIcon } from "@/lib/icons"

import { useAuthStore } from "../store/useAuthStore"

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const setAuth = useAuthStore((state) => state.setAuth)

  const navigate = useNavigate();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (data: SignUpInput) => {
    setIsSubmitting(true)
    setSuccessMessage(null)

    try {
      const payload = {
        email: data.email,
        password: data.password,
      }
      const res = await axios.post("http://localhost:3000/auth/signup", payload, {
        withCredentials: true,
      })
      console.log("SignUp submitted successfully:", res.data)
      const { accessToken, user } = res.data
      setAuth(accessToken, user)
      setSuccessMessage("Account created successfully! Redirecting...")
      setIsSubmitting(false)
      setTimeout(() => navigate("/dashboard"), 1000)
    } catch (err: any) {
      console.error("SignUp failed:", err)
      const errorMsg = err.response?.data?.message || "SignUp failed. Please try again."
      setSuccessMessage(errorMsg)
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Create Account"
      description="Register a new IntellMeet account to get started"
      footerText="Already have an account?"
      footerLinkText="Sign In"
      footerLinkTo="/login"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                      <MailIcon />
                    </span>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-rose-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                      <LockIcon />
                    </span>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-rose-400" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                      <LockIcon />
                    </span>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-slate-950/50 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeIcon /> : <EyeSlashIcon />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-rose-400" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Creating Account...</span>
              </div>
            ) : (
              "Sign Up"
            )}
          </Button>
          {successMessage && (
            <p className="text-center text-sm font-medium text-emerald-400 mt-3">
              {successMessage}
            </p>
          )}
        </form>
      </Form>
    </AuthCard>
  )
}
