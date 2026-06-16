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
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-600/15 blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />

      {/* Main card with glow border effect */}
      <div className="relative w-full max-w-md group">
        {/* Animated gradient outline glow */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-30 blur-sm transition duration-1000 group-hover:opacity-50 group-hover:duration-200" />

        <Card className="relative border-0 bg-slate-900/80 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden ring-1 ring-white/5 gap-0 pb-0">
          <CardHeader className="space-y-1 pb-6 pt-8 text-center">
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-violet-200 to-white bg-clip-text text-transparent">
              {title}
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              {description}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            {children}
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t border-white/5 bg-slate-950/40 py-4 text-center">
            <p className="text-sm text-slate-400">
              {footerText}{" "}
              <Link
                to={footerLinkTo}
                className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-all duration-200"
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
