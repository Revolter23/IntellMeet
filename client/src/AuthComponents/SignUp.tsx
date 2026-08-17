"use no memo";

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios";
import { useNavigate } from "react-router";

import { signUpSchema, type SignUpInput } from "./schemas"
import { AuthCard } from "./AuthCard"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { MailIcon, LockIcon, EyeIcon, EyeSlashIcon } from "@/lib/icons"

import { useAuthStore } from "../store/useAuthStore"
import { API_BASE_URL } from "../lib/config"

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
      const res = await axios.post(`${API_BASE_URL}/auth/signup`, payload, {
        withCredentials: true,
      })
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
                <FormLabel className="text-text-secondary">Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-muted">
                      <MailIcon />
                    </span>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 bg-bg-input border-border-default text-text-primary placeholder:text-text-subtle focus-visible:border-border-brand focus-visible:ring-border-brand/20"
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-status-danger" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-text-secondary">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-muted">
                      <LockIcon />
                    </span>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-bg-input border-border-default text-text-primary placeholder:text-text-subtle focus-visible:border-border-brand focus-visible:ring-border-brand/20"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-status-danger" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-text-secondary">Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-text-muted">
                      <LockIcon />
                    </span>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 bg-bg-input border-border-default text-text-primary placeholder:text-text-subtle focus-visible:border-border-brand focus-visible:ring-border-brand/20"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted hover:text-text-primary transition-colors"
                    >
                      {showConfirmPassword ? <EyeIcon /> : <EyeSlashIcon />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-status-danger" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 h-10 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" />
                <span>Creating Account...</span>
              </div>
            ) : (
              "Sign Up"
            )}
          </Button>
          {successMessage && (
            <p className="text-center text-sm font-medium text-status-success mt-3">
              {successMessage}
            </p>
          )}
        </form>
      </Form>
    </AuthCard>
  )
}
