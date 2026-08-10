import * as React from "react"
import { Link } from "react-router"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

interface AuthCardProps {
  title: string
  description: string
  footerText: string
  footerLinkText: string
  footerLinkTo: string
  children: React.ReactNode
}

export function AuthCard({
  title,
  description,
  footerText,
  footerLinkText,
  footerLinkTo,
  children,
}: AuthCardProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-app px-4 py-12 text-text-primary overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-primary/15 blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-brand-secondary/15 blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

      {/* Main card with glow border effect */}
      <div className="relative w-full max-w-md group">
        {/* Animated gradient outline glow */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary opacity-30 blur-sm transition duration-1000 group-hover:opacity-50 group-hover:duration-200" />

        <Card className="relative border border-border-default bg-bg-surface/90 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden gap-0 pb-0">
          <CardHeader className="space-y-1 pb-6 pt-8 text-center">
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-primary-light via-brand-secondary to-text-primary bg-clip-text text-transparent">
              {title}
            </CardTitle>
            <CardDescription className="text-text-muted text-sm">
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            {children}
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t border-border-subtle bg-bg-sidebar/50 py-4 text-center">
            <p className="text-sm text-text-muted">
              {footerText}{" "}
              <Link
                to={footerLinkTo}
                className="font-medium text-text-brand hover:text-brand-primary-light hover:underline transition-all duration-200"
              >
                {footerLinkText}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
