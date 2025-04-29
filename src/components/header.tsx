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
    <header className="border-b border-zinc-950">
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
              <span className="text-zinc-500">/</span> API Validator
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            href="https://github.com/appear-sh/api-validator"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-2 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900">
              <Image
                src="/github-mark-white.png"
                alt="GitHub Logo"
                width={16}
                height={16}
              />
              GitHub
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900">
                More Tools <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 text-zinc-300">
              <DropdownMenuItem asChild className="hover:bg-zinc-800 cursor-pointer">
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