"use no memo";

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"

import { loginSchema, type LoginInput } from "./schemas"
import { AuthCard } from "./AuthCard"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { useNavigate } from "react-router"
import { MailIcon, LockIcon, EyeIcon, EyeSlashIcon } from "@/lib/icons"

import { useAuthStore } from "../store/useAuthStore"
import { API_BASE_URL } from "../lib/config"

export default function Login() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const setAuth = useAuthStore((state) => state.setAuth)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginInput) => {
    setIsSubmitting(true)
    setSuccessMessage(null)

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, data, {
        withCredentials: true,
      })
      const { accessToken, user } = res.data
      setAuth(accessToken, user)
      setSuccessMessage("Signed in successfully!")
      setIsSubmitting(false)
      setTimeout(() => navigate("/dashboard"), 1000)
    } catch (err: any) {
      console.error("Login failed:", err)
      const errorMsg = err.response?.data?.message || "Login failed. Please try again."
      setSuccessMessage(errorMsg)
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Welcome Back"
      description="Enter your credentials to access your IntellMeet account"
      footerText="Don't have an account?"
      footerLinkText="Sign Up"
      footerLinkTo="/signup"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                <div className="flex items-center justify-between">
                  <FormLabel className="text-text-secondary">Password</FormLabel>
                </div>
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

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 h-10 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" />
                <span>Signing In...</span>
              </div>
            ) : (
              "Sign In"
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
