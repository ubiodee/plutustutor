/**
 * Centralized list of predefined Plutus learning topics.
 * 
 * Strict sequence:
 * 1. What is Plutus?
 * 2. Plutus Core
 * 3. Haskell
 * 4. Plutus Smart Contract
 * 5. eUTXO
 * 6. Plutus Playground
 * 7. Ledger Language Version
 * 8. Plutus Core Version
 * 9. Plutus Haskell Package Version
 * 10. Plutus Built-in Semantics Variant
 * 11. Validation
 * 12. Advantages of Plutus
 * 
 * NOTE: Do NOT alter, reorder, or sort this list.
 */
export const PLUTUS_TOPICS = [
  "What is Plutus?",
  "Plutus Core",
  "Haskell",
  "Plutus Smart Contract",
  "eUTXO",
  "Plutus Playground",
  "Ledger Language Version",
  "Plutus Core Version",
  "Plutus Haskell Package Version",
  "Plutus Built-in Semantics Variant",
  "Validation",
  "Advantages of Plutus",
] as const;

export type PlutusTopic = (typeof PLUTUS_TOPICS)[number];

export const TOTAL_PLUTUS_TOPICS = PLUTUS_TOPICS.length;

/**
 * Returns the 1-based display number for a given topic index (0-11).
 */
export function getTopicSequenceNumber(index: number): number {
  return index + 1;
}

/**
 * Validates if a string is one of the predefined Plutus topics.
 */
export function isPlutusTopic(topic: string): topic is PlutusTopic {
  return (PLUTUS_TOPICS as readonly string[]).includes(topic);
}

/**
 * Mapping of curriculum topics across all modules to their equivalent Plutus Tutor recommendation topic.
 */
export const TOPIC_TO_RECOMMEND_TOPIC: Record<string, PlutusTopic> = {
  "What is Plutus?": "What is Plutus?",
  "Introduction to Plutus Core": "Plutus Core",
  "Plutus Core": "Plutus Core",
  "Introduction to Haskell": "Haskell",
  "Haskell": "Haskell",
  "Introduction to Plutus Smart Contract": "Plutus Smart Contract",
  "Plutus Smart Contract": "Plutus Smart Contract",
  "Introduction to eUTXO": "eUTXO",
  "eUTXO": "eUTXO",
  "Introduction to Plutus Playground": "Plutus Playground",
  "Plutus Playground": "Plutus Playground",
  "What is Ledger Language Version": "Ledger Language Version",
  "Ledger Language Version": "Ledger Language Version",
  "Plutus Core Version": "Plutus Core Version",
  "Plutus Haskell Package Version": "Plutus Haskell Package Version",
  "Built-in Semantics Variant": "Plutus Built-in Semantics Variant",
  "Plutus Built-in Semantics Variant": "Plutus Built-in Semantics Variant",
  "Validation": "Validation",
  "Advantages of Plutus": "Advantages of Plutus",
};

/**
 * Returns the equivalent predefined recommendation query for any given curriculum topic.
 */
export function getEquivalentRecommendTopic(topicName: string): string {
  if (!topicName) return "What is Plutus?";
  return TOPIC_TO_RECOMMEND_TOPIC[topicName] || topicName;
}

