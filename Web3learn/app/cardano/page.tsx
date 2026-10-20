"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"

export default function CardanoPage() {
  const router = useRouter()
  const [hoveredTech, setHoveredTech] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const techStacks = [
    { name: "Plutus", available: true },
    { name: "Aiken", available: false },
    { name: "Lucid", available: false },
    { name: "PyCardano", available: false },
  ]

  return (
    <div className="relative min-h-screen bg-white text-slate-800">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Web3Learn
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            <Link href="/" className="text-slate-700 hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link href="/cardano" className="text-slate-700 hover:text-blue-600 transition-colors">
              Cardano
            </Link>
            <Link href="#" className="text-slate-700 hover:text-blue-600 transition-colors">
              About
            </Link>
            <Link href="/login" className="text-slate-700 hover:text-blue-600 transition-colors">
              Login
            </Link>
            <Button asChild className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 py-4">
            <div className="container mx-auto px-4 flex flex-col space-y-4">
              <Link href="/" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                Home
              </Link>
              <Link href="/cardano" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                Cardano
              </Link>
              <Link href="#" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                About
              </Link>
              <Link href="/login" className="text-slate-700 hover:text-blue-600 transition-colors py-2">
                Login
              </Link>
              <Button asChild className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white w-full">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="pt-20 relative z-10 bg-gradient-to-br from-blue-50 via-white to-teal-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <section className="py-10 sm:py-16 md:py-20 text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6 px-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500 leading-tight">
              PERSONALISED LEARNING PLATFORM FOR CARDANO TECH STACK
            </h1>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 md:mb-12 text-slate-700 px-4">
              A SIMPLER PLATFORM FOR LEARNING CARDANO
            </h2>

            <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-12 md:mb-16 max-w-3xl mx-auto text-slate-600 px-4 leading-relaxed">
              DIFFERENT APPROACH FOR DIFFERENT PERSONS, LET OUR AI GUIDE YOU THROUGH YOUR PLUTUS LEARNING
            </p>

            <div className="mb-12 sm:mb-16">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg w-full sm:w-auto"
                onClick={() => {
                  document.getElementById("tech-stack")?.scrollIntoView({ behavior: "smooth" })
                }}
              >
                Ready, Let's Go!
              </Button>
            </div>

            <div id="tech-stack">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 text-slate-700 px-4">Choose Your Tech Stack</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto px-2">
                {techStacks.map((tech) => (
                  <Card
                    key={tech.name}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      tech.available
                        ? "bg-white hover:shadow-md cursor-pointer"
                        : "bg-slate-50 opacity-60 cursor-not-allowed"
                    } border-slate-200 ${hoveredTech === tech.name && tech.available ? "border-blue-300" : ""}`}
                    onMouseEnter={() => setHoveredTech(tech.name)}
                    onMouseLeave={() => setHoveredTech(null)}
                    onClick={() => tech.available && router.push("/signup")}
                  >
                    <CardContent className="p-6">
                      <h3 className="text-xl font-semibold text-center mb-2 text-slate-800">{tech.name}</h3>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-4">
                      {tech.available ? (
                        <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-50">
                          Select <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-sm text-slate-400">Coming Soon</span>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

