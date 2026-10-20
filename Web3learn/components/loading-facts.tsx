"use client"

import { useState, useEffect } from "react"
import { Loader2, Lightbulb } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"

const FUN_FACTS = [
  "Cardano is named after Gerolamo Cardano, an Italian Renaissance mathematician!",
  "Cardano uses a proof-of-stake consensus mechanism called Ouroboros, which is more energy-efficient than Bitcoin's proof-of-work!",
  "Plutus is Cardano's smart contract platform, named after Plutus the Greek god of wealth!",
  "Cardano's native cryptocurrency is called ADA, named after Ada Lovelace, the world's first computer programmer!",
  "Cardano is built on peer-reviewed research and formal verification methods, making it one of the most secure blockchains!",
  "The Cardano blockchain can process up to 1,000 transactions per second, with plans to scale even higher!",
  "Cardano was the first blockchain platform to be founded on scientific philosophy and research-driven approach!",
  "Haskell, the programming language used for Plutus, is known for its mathematical precision and type safety!",
  "Cardano's treasury system allows the community to vote on protocol improvements and fund development projects!",
  "The Ouroboros protocol was the first proof-of-stake protocol to be proven secure through academic peer review!",
  "Cardano's blockchain is split into two layers: the Settlement Layer (for ADA transfers) and the Computation Layer (for smart contracts)!",
  "Charles Hoskinson, one of Cardano's founders, was also a co-founder of Ethereum!",
  "Cardano's roadmap is divided into five eras: Byron, Shelley, Goguen, Basho, and Voltaire!",
  "Smart contracts on Cardano must be formally verified, meaning they're mathematically proven to work correctly!",
  "Cardano uses Extended UTXO (EUTXO) model, which is more predictable and secure than Ethereum's account-based model!",
  "The Cardano community can participate in governance through Project Catalyst, the world's largest decentralized innovation fund!",
  "Blockchain technology was first conceptualized in 1991, but Bitcoin made it mainstream in 2009!",
  "Every transaction on a blockchain is recorded in a 'block' and linked to previous blocks, creating an unchangeable chain!",
  "Smart contracts are self-executing contracts with the terms directly written into code, removing the need for intermediaries!",
  "Decentralized Finance (DeFi) uses blockchain technology to recreate traditional financial systems without banks!",
]

export function LoadingFacts({ message = "Generating your personalized response..." }: { message?: string }) {
  const [currentFactIndex, setCurrentFactIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  // Rotate facts every 8 seconds
  useEffect(() => {
    const factInterval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % FUN_FACTS.length)
    }, 8000)

    return () => clearInterval(factInterval)
  }, [])

  // Animate progress bar continuously (visual indicator only)
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          return 5 // Reset to 5% to keep it moving
        }
        return prev + Math.random() * 2 // Increment by 0-2% randomly for natural feel
      })
    }, 2000) // Update every 2 seconds

    return () => clearInterval(progressInterval)
  }, [])

  return (
    <div className="w-full space-y-6 py-8">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
        <div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">{message}</h3>
          <p className="text-sm text-slate-600">This may take a few minutes. Please don't close this page.</p>
        </div>
        
        {/* Progress bar */}
        <div className="max-w-md mx-auto pt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-slate-500 mt-2">Processing your request...</p>
        </div>
      </div>

      {/* Fun Facts Section */}
      <div className="max-w-2xl mx-auto">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  Did You Know?
                  <span className="text-xs font-normal text-slate-500">
                    ({currentFactIndex + 1}/{FUN_FACTS.length})
                  </span>
                </h4>
                <p className="text-slate-700 leading-relaxed transition-all duration-500 ease-in-out">
                  {FUN_FACTS[currentFactIndex]}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

