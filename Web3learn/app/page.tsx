"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowRight, Brain, BookOpen, Lightbulb, Palette, Menu, X, Code, Layers, Zap, Eye, Users, Calculator, Mic, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import Link from "next/link"
import CodeSphere from "@/components/code-sphere"

export default function LandingPage() {
  const router = useRouter()
  const [hoveredChain, setHoveredChain] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navigateToContent = () => {
    router.push("/cardano")
  }

  const learnerTypes = [
    {
      type: "Dyslexic",
      icon: <Eye className="h-8 w-8 mb-2" />,
      description: "Visual learning with accessible content formats and clear structure",
      image: "/placeholder.svg?height=120&width=120",
    },
    {
      type: "Autistic",
      icon: <Brain className="h-8 w-8 mb-2" />,
      description: "Structured, predictable learning paths with detailed explanations",
      image: "/placeholder.svg?height=120&width=120",
    },
    {
      type: "Dyscalculic",
      icon: <Calculator className="h-8 w-8 mb-2" />,
      description: "Conceptual learning without heavy reliance on numerical complexity",
      image: "/placeholder.svg?height=120&width=120",
    },
    {
      type: "Expressive",
      icon: <Mic className="h-8 w-8 mb-2" />,
      description: "Interactive, hands-on learning with practical examples",
      image: "/placeholder.svg?height=120&width=120",
    },
    {
      type: "Introverted",
      icon: <User className="h-8 w-8 mb-2" />,
      description: "Self-paced learning with quiet, focused study materials",
      image: "/placeholder.svg?height=120&width=120",
    },
    {
      type: "Nerd",
      icon: <Code className="h-8 w-8 mb-2" />,
      description: "Technical deep-dives and comprehensive documentation",
      image: "/placeholder.svg?height=120&width=120",
    },
  ]

  const blockchains = [
    {
      name: "Cardano",
      available: true,
      description: "A proof-of-stake blockchain platform with a focus on sustainability and scalability.",
    },
    {
      name: "Ethereum",
      available: false,
      description: "The world's programmable blockchain, home to digital money, global payments, and applications.",
    },
    {
      name: "Bitcoin",
      available: false,
      description: "The original cryptocurrency and the world's most popular digital store of value.",
    },
    {
      name: "Polygon",
      available: false,
      description: "A protocol and framework for building and connecting Ethereum-compatible blockchain networks.",
    },
  ]

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-teal-500 flex items-center gap-2">
            <Code className="h-6 w-6 text-blue-600" />
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

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center pt-20">
        {/* Code Sphere Background */}
        <div className="absolute inset-0 overflow-hidden">
          <CodeSphere className="opacity-60" />
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/90 via-white/70 to-teal-50/90 z-0"></div>

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 z-0">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgb(59, 130, 246) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <div className="flex justify-center mb-4 px-4">
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full bg-blue-100 border border-blue-200 backdrop-blur-sm">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                <span className="text-blue-700 text-xs sm:text-sm font-medium whitespace-nowrap">Blockchain Learning Platform</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 md:mb-6 px-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-teal-500">
              Personalised AI Learning
            </h1>
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold mb-4 text-slate-700 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-2">
              <Layers className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-blue-600" />
              <span className="text-center">for Web3 Programming Languages</span>
            </h2>
          </motion.div>

          <motion.p
            className="text-base sm:text-lg md:text-xl lg:text-2xl mb-8 md:mb-12 max-w-3xl mx-auto text-slate-600 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Learning tailored for who you are
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
              onClick={navigateToContent}
            >
              Start Your Journey <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="bg-white relative z-10">
        <div className="container mx-auto px-4 py-16 md:py-24">
          {/* Learner Types */}
          <section className="mb-20">
            <motion.h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 sm:mb-12 text-center text-slate-800 px-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Learning Tailored For You
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {learnerTypes.map((learner, index) => (
                <motion.div
                  key={learner.type}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-teal-100 flex items-center justify-center mb-4">
                      <div className="text-blue-600">{learner.icon}</div>
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-2 text-slate-800">{learner.type}</h3>
                    <p className="text-slate-600 text-center text-xs sm:text-sm px-2">{learner.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Web3 Learning */}
          <section className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-12 p-8 md:p-12 bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl border border-blue-100 shadow-sm">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-center text-slate-800 px-4">
                  Web3 is not difficult, the method of learning is the problem
                </h2>
                <p className="text-base sm:text-lg text-slate-600 text-center mb-6 px-4">
                  Our AI adapts to your learning style, making complex concepts accessible to everyone.
                </p>
                <div className="flex justify-center">
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all"
                    onClick={() => document.getElementById("start-journey")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Learn More
                  </Button>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Blockchain Options */}
          <section id="start-journey">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 text-center text-slate-800 px-4">
                Choose a Programming Language
              </h2>
              <p className="text-lg sm:text-xl mb-8 sm:mb-12 text-center text-slate-600 px-4">Experience a world of personalised Learning</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {blockchains.map((chain) => (
                  <Card
                    key={chain.name}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      chain.available
                        ? "bg-white hover:shadow-lg cursor-pointer border-2 hover:border-blue-400"
                        : "bg-slate-50 opacity-60 cursor-not-allowed border-slate-200"
                    } ${hoveredChain === chain.name && chain.available ? "border-blue-400 shadow-md" : ""}`}
                    onMouseEnter={() => setHoveredChain(chain.name)}
                    onMouseLeave={() => setHoveredChain(null)}
                    onClick={() => chain.available && router.push("/cardano")}
                  >
                    <CardContent className="p-6">
                      <h3 className="text-xl font-semibold text-center mb-3 text-slate-800">{chain.name}</h3>
                      <p className="text-slate-600 text-center text-sm mb-4">{chain.description}</p>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-4">
                      {chain.available ? (
                        <Button variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-50">
                          Explore <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-sm text-slate-400">Coming Soon</span>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </div>
  )
}
