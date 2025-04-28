"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="border-b border-zinc-950">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="mr-8">
            <div className="flex items-center">
              <Image 
                src="/Appear Logo v3.png" 
                alt="Appear Logo" 
                width={161} 
                height={33}
                priority
              />
            </div>
          </Link>
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="https://appear.sh/product-map" 
              className="text-gray-300 hover:text-white transition-colors text-md font-medium"
            >
              Product map
            </Link>
            <Link 
              href="https://docs.appear.shs" 
              className="text-gray-300 hover:text-white transition-colors text-md font-medium"
            >
              Docs
            </Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <Link 
            href="https://cal.com/appear.sh/demo?overlayCalendar=true" 
            className="text-sm"
          >
            <Button variant="outline" className="text-md font-medium border-gray-700 hover:border-gray-500 text-white bg-transparent hover:bg-transparent">
              Get demo
            </Button>
          </Link>
          <Link 
            href="https://app.appear.sh/sign-in" 
            className="text-sm"
          >
            <Button className="text-md font-medium bg-white text-black hover:bg-gray-100 border-0">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
} 