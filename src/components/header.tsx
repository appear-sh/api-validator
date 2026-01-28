"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-white/5">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center">
          <div className="flex items-center gap-2 mr-8">
            <Link href="https://appear.sh" className="group">
              <Image
                src="/Appear Logo v3.png"
                alt="Appear Logo"
                width={120}
                height={40}
                priority
                className="group-hover:opacity-90 transition-opacity"
              />
            </Link>
            <span className="text-white font-medium text-lg hidden sm:inline">
              <span className="text-zinc-500">/</span> OpenAPI Agent Readiness Checker
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="https://github.com/appear-sh/api-validator"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 border border-white/20 bg-transparent text-white/80 hover:bg-white/5 hover:text-white hover:border-white/30 transition-all"
            >
              <Image
                src="/github-mark-white.png"
                alt="GitHub Logo"
                width={16}
                height={16}
                className="opacity-80"
              />
              GitHub
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 border border-white/20 bg-transparent text-white/80 hover:bg-white/5 hover:text-white hover:border-white/30 transition-all"
              >
                More Tools <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950/90 backdrop-blur-sm border-white/10 text-zinc-300">
              <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer focus:bg-white/5">
                <Link
                  href="https://appear.sh/api-toolkit/specs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <svg 
                    className="h-4 w-4 opacity-80" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  Specs Hub
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer focus:bg-white/5">
                <Link
                  href="https://github.com/appear-sh/OAS-Zod-Validator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Image 
                    src="/github-mark-white.png"
                    alt="GitHub Logo"
                    width={16}
                    height={16}
                    className="opacity-80"
                  />
                  OAS Zod Validator
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
} 