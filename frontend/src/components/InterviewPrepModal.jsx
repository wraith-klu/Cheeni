import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Curated Question Bank for Interview Prep
 * Categories: DSA, System Design, Behavioral
 */
const DEFAULT_QUESTIONS = [
  // DSA
  {
    id: "dsa-1",
    category: "dsa",
    categoryLabel: "DSA",
    title: "Two Sum & Hash Map Lookup",
    difficulty: "Easy",
    question: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. What is the optimal time and space complexity?",
    hint: "Think about trading space for time using a single-pass hash map to store complements.",
    answer: "Optimal Approach:\n- Use a Hash Map storing `target - num` as key and current index as value.\n- In one pass, check if current element is in the hash map.\n- Time Complexity: O(n)\n- Space Complexity: O(n)",
    keyPoints: ["Single pass O(n)", "Complements lookup in O(1)", "Handle duplicate numbers properly"]
  },
  {
    id: "dsa-2",
    category: "dsa",
    categoryLabel: "DSA",
    title: "Reverse a Linked List",
    difficulty: "Easy",
    question: "How do you reverse a singly linked list in-place iteratively and recursively?",
    hint: "Iterative needs 3 pointers: prev, current, next.",
    answer: "Iterative:\n1. Initialize `prev = null`, `curr = head`.\n2. In a loop, store `next = curr.next`, set `curr.next = prev`, then advance `prev = curr`, `curr = next`.\n3. Return `prev`.\n\nTime: O(n), Space: O(1) iterative (O(n) recursive stack).",
    keyPoints: ["Avoid losing node reference", "Edge cases: empty list, single node", "In-place pointer reversal"]
  },
  {
    id: "dsa-3",
    category: "dsa",
    categoryLabel: "DSA",
    title: "LRU Cache Architecture",
    difficulty: "Medium",
    question: "Design a data structure for Least Recently Used (LRU) Cache that supports get(key) and put(key, value) in O(1) time.",
    hint: "Combine a hash map with a doubly linked list.",
    answer: "Data Structure Combination:\n- Hash Map provides O(1) key-to-node lookup.\n- Doubly Linked List (DLL) allows O(1) removal and insertion at head/tail.\n- On `get(key)`: Move accessed node to head.\n- On `put(key, val)`: If key exists, update and move to head. If full, evict tail node and delete from map.",
    keyPoints: ["DLL + Hash Map", "Dummy head & tail nodes prevent edge cases", "Strict O(1) guarantees"]
  },
  {
    id: "dsa-4",
    category: "dsa",
    categoryLabel: "DSA",
    title: "Binary Tree Level Order Traversal",
    difficulty: "Medium",
    question: "Given the root of a binary tree, return the level order traversal of its nodes' values (BFS).",
    hint: "Queue-based traversal; track queue size at start of each level.",
    answer: "Approach:\n- Use a FIFO Queue.\n- Push root node. While queue is not empty, record `levelSize = queue.length`.\n- Loop `levelSize` times: pop front, push value to current level list, push non-null children.\n- Time: O(n), Space: O(w) where w is maximum tree width.",
    keyPoints: ["Queue FIFO structure", "Size snapshot per level", "Time O(n), Space O(w)"]
  },
  {
    id: "dsa-5",
    category: "dsa",
    categoryLabel: "DSA",
    title: "Merge K Sorted Lists",
    difficulty: "Hard",
    question: "You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list.",
    hint: "Min-Heap priority queue or divide-and-conquer pairwise merge.",
    answer: "Optimal Approaches:\n1. Min-Heap Priority Queue: Insert head of each list (size k). Pop minimum, attach to result, push popped node's next. Time: O(N log k), Space: O(k).\n2. Divide & Conquer: Pairwise merge lists like MergeSort. Time: O(N log k), Space: O(1) iterative.",
    keyPoints: ["Min-Heap of size k", "Divide and Conquer O(N log k)", "Handles empty sublists"]
  },

  // System Design
  {
    id: "sd-1",
    category: "system_design",
    categoryLabel: "System Design",
    title: "URL Shortener (TinyURL)",
    difficulty: "Medium",
    question: "Design a scalable URL shortening service like TinyURL or bit.ly. How do you generate unique short keys?",
    hint: "Base62 encoding over a distributed ID generator (e.g. Snowflake) or pre-generated token service.",
    answer: "Core Architecture:\n- Base62 encoding (`[a-zA-Z0-9]`, 62^7 ≈ 3.5 trillion URLs).\n- Distributed unique ID generator (Twitter Snowflake or Range-based DB counter).\n- Read-heavy architecture (100:1 read to write ratio) -> Aggressive Redis caching with LRU eviction.\n- 301 vs 302 redirect: 301 for browser caching / lower latency, 302 for analytics tracking.",
    keyPoints: ["Base62 encoding", "Redis read-through cache", "301 permanent vs 302 temporary redirects", "Distributed ID counter"]
  },
  {
    id: "sd-2",
    category: "system_design",
    categoryLabel: "System Design",
    title: "Rate Limiting Algorithms",
    difficulty: "Medium",
    question: "Explain Token Bucket vs Sliding Window Log algorithms for API rate limiting. Where do you place the limiter?",
    hint: "Token Bucket is memory efficient; Sliding Window log prevents burst around window boundaries.",
    answer: "Comparison:\n- Token Bucket: Refills tokens at constant rate up to burst capacity. Very light memory (2 numbers per user: token count + last timestamp). Easy distributed sync in Redis.\n- Sliding Window Log: Stores exact timestamps of requests in Redis Sorted Set (ZSET). Evicts older than `now - window`. High memory overhead.\n- Placement: API Gateway (Kong, Envoy) or reverse proxy before application servers.",
    keyPoints: ["Token bucket memory efficiency", "Sliding window accuracy", "Redis Lua script atomic execution", "HTTP 429 Too Many Requests"]
  },
  {
    id: "sd-3",
    category: "system_design",
    categoryLabel: "System Design",
    title: "Distributed Message Queue",
    difficulty: "Hard",
    question: "Design a fault-tolerant, scalable distributed messaging system like Kafka. How do partitions ensure ordering?",
    hint: "Topic partitioning with sequential append-only logs and consumer group offsets.",
    answer: "Architecture Fundamentals:\n- Topics divided into Partitions: Partition is an immutable, append-only log.\n- Strict ordering is guaranteed *within a partition*, not across partitions.\n- Consumers organized into Consumer Groups where each partition is read by exactly one consumer in the group.\n- Replication: Leader-Follower ISR (In-Sync Replicas) model with configurable `acks=all`.",
    keyPoints: ["Append-only commit log", "Partition key determines ordering", "Consumer offset tracking", "Zero-copy disk-to-network transfer"]
  },
  {
    id: "sd-4",
    category: "system_design",
    categoryLabel: "System Design",
    title: "Database Indexing & B+ Trees",
    difficulty: "Medium",
    question: "Why do relational databases (MySQL InnoDB, Postgres) use B+ Trees instead of Binary Search Trees or Hash Tables?",
    hint: "Disk block I/O optimization and sequential range scans.",
    answer: "Key Advantages:\n1. Low Tree Height / High Fanout: B+ trees store multiple keys per page (e.g. 4KB/16KB disk page), minimizing disk block reads (3-4 I/O operations for millions of rows).\n2. Linked Leaf Nodes: All actual records/pointers reside in leaf nodes, linked sequentially, enabling rapid range scans (`BETWEEN x AND y`).\n3. Consistent performance compared to unbalanced BSTs.",
    keyPoints: ["High fanout minimizes disk seek", "Doubly linked leaf nodes for range scans", "Predictable O(log n) tree depth"]
  },

  // Behavioral
  {
    id: "beh-1",
    category: "behavioral",
    categoryLabel: "Behavioral",
    title: "Overcoming Technical Disagreement",
    difficulty: "Medium",
    question: "Tell me about a time you had a technical disagreement with a team member or senior engineer. How did you resolve it?",
    hint: "Use STAR (Situation, Task, Action, Result). Focus on objective benchmarking, data, and team unity.",
    answer: "STAR Structure Guide:\n- Situation: Describe the project and the diverging technical architectural choices (e.g. REST vs GraphQL, PostgreSQL vs MongoDB).\n- Task: Show your responsibility in preventing roadmap delays.\n- Action: Set up a rapid proof-of-concept (POC) with clear benchmarks (latency, throughput, developer velocity), and listened with empathy.\n- Result: Team aligned on data, delivered on time, strengthened mutual trust.",
    keyPoints: ["Disagree and commit mentality", "Data-driven POC benchmarking", "Professional respect and active listening"]
  },
  {
    id: "beh-2",
    category: "behavioral",
    categoryLabel: "Behavioral",
    title: "Production Outage Postmortem",
    difficulty: "Hard",
    question: "Describe a situation where a service broke or went down in production due to a change you or your team introduced. How did you handle it?",
    hint: "Focus on blameless postmortem, immediate mitigation before root-cause deep-dive, and preventative guardrails.",
    answer: "Key Elements of a Great Answer:\n- Immediate Response: Revert change first or activate feature flag kill switch; prioritize user uptime over fixing in-place.\n- Clear Communication: Incident channel updates, alerting stakeholders.\n- Blameless RCA (5 Whys): Identified missing regression test or race condition.\n- Prevention: Added automated canary deployments, telemetry alerts, and automated rollback triggers.",
    keyPoints: ["Mitigate first, debug second", "Transparent stakeholder updates", "Blameless postmortem and systemic guardrails"]
  },
  {
    id: "beh-3",
    category: "behavioral",
    categoryLabel: "Behavioral",
    title: "Handling Tight Deadlines with Ambiguity",
    difficulty: "Medium",
    question: "Walk me through how you prioritize tasks when requirements are ambiguous and a deadline is immovable.",
    hint: "De-scoping, MVP definition, proactive stakeholder check-ins.",
    answer: "Framework:\n- Identify the core user value / P0 requirements (MoSCoW method: Must have, Should have, Could have).\n- Break down work into rapid 1-2 day increments with working prototypes.\n- Over-communicate assumptions in writing with product managers.\n- Successfully shipped core value on schedule without burnout.",
    keyPoints: ["De-risking P0 scope", "Rapid prototyping", "Explicitly documented assumptions"]
  }
];

const TOPIC_ROADMAP = [
  {
    id: "dsa",
    name: "Data Structures & Algorithms",
    short: "DSA",
    description: "Core algorithms, space/time complexity, arrays, trees, dynamic programming",
    totalSteps: 12,
    defaultCompleted: 7,
    color: "#B5642A",
    milestones: [
      { name: "Arrays & Two Pointers", done: true },
      { name: "Hash Maps & Sets", done: true },
      { name: "Linked Lists & Fast/Slow", done: true },
      { name: "Binary Search Variations", done: true },
      { name: "Trees & BFS/DFS", done: true },
      { name: "Heap & Priority Queues", done: true },
      { name: "Graphs (Dijkstra, Topological)", done: true },
      { name: "Dynamic Programming (1D & 2D)", done: false },
      { name: "Backtracking & Recursion", done: false },
      { name: "Trie & String Manipulation", done: false },
      { name: "Bit Manipulation & Math", done: false },
      { name: "Monotonic Stacks & Deques", done: false }
    ]
  },
  {
    id: "system_design",
    name: "System Design & Architecture",
    short: "Sys Design",
    description: "Distributed systems, scalability, database sharding, caching, microservices",
    totalSteps: 10,
    defaultCompleted: 5,
    color: "#5B4FBE",
    milestones: [
      { name: "CAP Theorem & PACELC", done: true },
      { name: "Load Balancing & API Gateways", done: true },
      { name: "Consistent Hashing & Partitioning", done: true },
      { name: "Distributed Caching (Redis/Memcached)", done: true },
      { name: "Relational vs NoSQL Storage", done: true },
      { name: "Message Queues (Kafka/RabbitMQ)", done: false },
      { name: "Distributed Transactions (2PC, Saga)", done: false },
      { name: "Rate Limiting & Token Buckets", done: false },
      { name: "Blob Stores & CDN Edge Delivery", done: false },
      { name: "Observability, Tracing & Metrics", done: false }
    ]
  },
  {
    id: "behavioral",
    name: "Behavioral & Leadership",
    short: "Behavioral",
    description: "STAR method, cross-functional collaboration, ownership, handling failures",
    totalSteps: 8,
    defaultCompleted: 4,
    color: "#2A7A3B",
    milestones: [
      { name: "STAR Method Mastery", done: true },
      { name: "Technical Disagreement & Influence", done: true },
      { name: "Production Incident & Blameless RCA", done: true },
      { name: "Tight Deadlines & De-scoping", done: true },
      { name: "Mentoring & Team Growth", done: false },
      { name: "Disagree and Commit Examples", done: false },
      { name: "Navigating Cross-Team Friction", done: false },
      { name: "Career Growth & Retrospective", done: false }
    ]
  }
];

/**
 * InterviewPrepModal
 * Complete standalone Interview Prep Studio:
 * 1. Flash Card Mode — Interactive flip cards with Answer toggle & category filters
 * 2. Mock Interview Timer — Live response timer with Target / Warning thresholds & pacing feedback
 * 3. Topic Roadmap — Interactive DSA, System Design & Behavioral progress checklists with local storage
 */
export function InterviewPrepModal({
  isOpen,
  onClose,
  onAskCheeni,
  assistantName = "Cheeni",
}) {
  const [activeTab, setActiveTab] = useState("cards"); // 'cards' | 'timer' | 'roadmap'
  const [activeCategory, setActiveCategory] = useState("all"); // 'all' | 'dsa' | 'system_design' | 'behavioral'
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Roadmap completion state loaded from localStorage
  const [roadmapProgress, setRoadmapProgress] = useState(() => {
    try {
      const saved = localStorage.getItem("cheeni_interview_roadmap");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    const initial = {};
    TOPIC_ROADMAP.forEach(t => {
      initial[t.id] = t.milestones.map(m => m.done);
    });
    return initial;
  });

  // Timer states
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerTargetMinutes, setTimerTargetMinutes] = useState(3); // 2, 3, or 5 min
  const timerIntervalRef = useRef(null);

  // Filtered cards
  const filteredCards = DEFAULT_QUESTIONS.filter(
    q => activeCategory === "all" || q.category === activeCategory
  );

  // Safe current card
  const currentCard = filteredCards[currentCardIndex % filteredCards.length] || DEFAULT_QUESTIONS[0];

  // Reset card state on category switch
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleNextCard = () => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentCardIndex(prev => (prev + 1) % filteredCards.length);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setShowHint(false);
    setCurrentCardIndex(prev => (prev - 1 + filteredCards.length) % filteredCards.length);
  };

  // Timer control
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning]);

  const toggleTimer = () => setIsTimerRunning(prev => !prev);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
  };

  // Roadmap toggle
  const toggleMilestone = (topicId, idx) => {
    setRoadmapProgress(prev => {
      const currentList = prev[topicId] || [];
      const updatedList = [...currentList];
      updatedList[idx] = !updatedList[idx];
      const updated = { ...prev, [topicId]: updatedList };
      try {
        localStorage.setItem("cheeni_interview_roadmap", JSON.stringify(updated));
      } catch (err) {
        console.warn("Storage save error:", err);
      }
      return updated;
    });
  };

  if (!isOpen) return null;

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const targetSeconds = timerTargetMinutes * 60;
  const isOverTime = timerSeconds > targetSeconds;
  const isWarningTime = timerSeconds >= targetSeconds * 0.8 && !isOverTime;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(10, 9, 8, 0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          background: "var(--land-bg)",
          borderRadius: 16,
          border: "1px solid var(--land-rule)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--land-ink)",
          fontFamily: "var(--land-sans)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--land-rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--land-bg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--land-accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              🎯
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  fontFamily: "var(--land-serif)",
                }}
              >
                Interview Prep Studio
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--land-ink-3)" }}>
                Flash cards, mock answer timer, and topic roadmap with {assistantName}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--land-rule)",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--land-ink-2)",
              fontSize: 16,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            background: "var(--land-bg-2)",
            borderBottom: "1px solid var(--land-rule)",
          }}
        >
          {[
            { id: "cards", label: "🎴 Flash Cards", count: DEFAULT_QUESTIONS.length },
            { id: "timer", label: "⏱️ Mock Timer" },
            { id: "roadmap", label: "🗺️ Topic Roadmap", count: "3 Tracks" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: isActive ? "1px solid var(--land-accent)" : "1px solid transparent",
                  background: isActive ? "var(--land-bg)" : "transparent",
                  color: isActive ? "var(--land-accent)" : "var(--land-ink-2)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.label}</span>
                {tab.count && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: isActive ? "var(--land-accent-light)" : "var(--land-rule)",
                      color: isActive ? "var(--land-accent)" : "var(--land-ink-3)",
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {/* TAB 1: FLASH CARDS */}
          {activeTab === "cards" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Category Filter Pills */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { id: "all", label: "All Topics" },
                    { id: "dsa", label: "DSA" },
                    { id: "system_design", label: "System Design" },
                    { id: "behavioral", label: "Behavioral" },
                  ].map((c) => {
                    const isSel = activeCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleCategoryChange(c.id)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          border: isSel ? "1px solid var(--land-accent)" : "1px solid var(--land-rule)",
                          background: isSel ? "var(--land-accent)" : "var(--land-bg-2)",
                          color: isSel ? "#fff" : "var(--land-ink-2)",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <span style={{ fontSize: 12, color: "var(--land-ink-3)" }}>
                  Card {currentCardIndex + 1} of {filteredCards.length}
                </span>
              </div>

              {/* 3D Flip Card Container */}
              <div
                style={{
                  perspective: 1000,
                  minHeight: 280,
                  width: "100%",
                  cursor: "pointer",
                }}
                onClick={() => setIsFlipped(!isFlipped)}
                title="Click card to flip"
              >
                <motion.div
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    width: "100%",
                    minHeight: 280,
                    borderRadius: 14,
                    border: "1px solid var(--land-rule)",
                    background: isFlipped ? "var(--land-bg-2)" : "var(--land-bg)",
                    boxShadow: "0 8px 24px rgba(26, 25, 22, 0.06)",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transformStyle: "preserve-3d",
                    position: "relative",
                  }}
                >
                  {/* FRONT SIDE (Question) */}
                  {!isFlipped ? (
                    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--land-accent)",
                              background: "var(--land-accent-light)",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            {currentCard.categoryLabel} • {currentCard.difficulty}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--land-ink-3)" }}>
                            🔄 Click to reveal answer
                          </span>
                        </div>

                        <h3
                          style={{
                            margin: "0 0 12px 0",
                            fontSize: 18,
                            fontWeight: 600,
                            color: "var(--land-ink)",
                            fontFamily: "var(--land-serif)",
                          }}
                        >
                          {currentCard.title}
                        </h3>

                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--land-ink-2)" }}>
                          {currentCard.question}
                        </p>
                      </div>

                      {/* Hint section */}
                      <div style={{ marginTop: 20 }}>
                        {showHint ? (
                          <div
                            style={{
                              padding: "10px 14px",
                              borderRadius: 8,
                              background: "rgba(181, 100, 42, 0.08)",
                              border: "1px dashed var(--land-accent)",
                              fontSize: 12,
                              color: "var(--land-ink-2)",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            💡 <strong>Hint:</strong> {currentCard.hint}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHint(true);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--land-accent)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            💡 Show Hint
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* BACK SIDE (Answer) */
                    <div
                      style={{
                        transform: "rotateY(180deg)",
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#2A7A3B",
                              background: "rgba(42, 122, 59, 0.12)",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            SOLUTION & KEY TAKEAWAYS
                          </span>
                          <span style={{ fontSize: 11, color: "var(--land-ink-3)" }}>
                            🔄 Click to flip back
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: "var(--land-ink-2)",
                            whiteSpace: "pre-line",
                            background: "var(--land-bg)",
                            padding: "12px 14px",
                            borderRadius: 8,
                            border: "1px solid var(--land-rule)",
                          }}
                        >
                          {currentCard.answer}
                        </div>

                        {currentCard.keyPoints && (
                          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {currentCard.keyPoints.map((kp, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "var(--land-bg)",
                                  border: "1px solid var(--land-rule)",
                                  color: "var(--land-ink-2)",
                                }}
                              >
                                ✓ {kp}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Navigation and AI Ask button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handlePrevCard}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "var(--land-bg-2)",
                      border: "1px solid var(--land-rule)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--land-ink)",
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleNextCard}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "var(--land-bg-2)",
                      border: "1px solid var(--land-rule)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--land-ink)",
                    }}
                  >
                    Next →
                  </button>
                </div>

                <button
                  onClick={() => {
                    const prompt = `Cheeni, let's practice this interview question: "${currentCard.question}". Can you conduct a live mock review with me?`;
                    onAskCheeni?.(prompt);
                    onClose?.();
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "var(--land-accent)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 8px rgba(181, 100, 42, 0.25)",
                  }}
                >
                  <span>Mock Practice with {assistantName}</span>
                  <span>🎙️</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MOCK INTERVIEW TIMER */}
          {activeTab === "timer" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "12px 0" }}>
              <div style={{ textAlign: "center", maxWidth: 500 }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontFamily: "var(--land-serif)" }}>
                  Answer Response Pacing Timer
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--land-ink-3)" }}>
                  Great interviewees target 2 to 3 minutes per response. Track your spoken pacing without rushing or rambling.
                </p>
              </div>

              {/* Target Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--land-ink-3)" }}>Target Window:</span>
                {[2, 3, 5].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setTimerTargetMinutes(mins);
                      resetTimer();
                    }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: timerTargetMinutes === mins ? "1px solid var(--land-accent)" : "1px solid var(--land-rule)",
                      background: timerTargetMinutes === mins ? "var(--land-accent)" : "var(--land-bg-2)",
                      color: timerTargetMinutes === mins ? "#fff" : "var(--land-ink-2)",
                    }}
                  >
                    {mins} Min
                  </button>
                ))}
              </div>

              {/* Big Animated Clock Dial */}
              <motion.div
                animate={{
                  scale: isTimerRunning ? [1, 1.02, 1] : 1,
                  borderColor: isOverTime ? "#C0392B" : isWarningTime ? "#A0580C" : "var(--land-accent)",
                }}
                transition={{ repeat: isTimerRunning ? Infinity : 0, duration: 2 }}
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  border: `4px solid ${isOverTime ? "#C0392B" : isWarningTime ? "#A0580C" : "var(--land-accent)"}`,
                  background: "var(--land-bg-2)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 44,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: isOverTime ? "#C0392B" : isWarningTime ? "#A0580C" : "var(--land-ink)",
                  }}
                >
                  {formatTime(timerSeconds)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--land-ink-3)", marginTop: 4 }}>
                  Target: {timerTargetMinutes}:00
                </span>
                <span
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: isOverTime ? "rgba(192, 57, 43, 0.15)" : isWarningTime ? "rgba(160, 88, 12, 0.15)" : "rgba(42, 122, 59, 0.15)",
                    color: isOverTime ? "#C0392B" : isWarningTime ? "#A0580C" : "#2A7A3B",
                  }}
                >
                  {isOverTime ? "Wrap Up Now" : isWarningTime ? "Approaching Limit" : isTimerRunning ? "Optimal Flow" : "Ready"}
                </span>
              </motion.div>

              {/* Controls */}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  onClick={toggleTimer}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 10,
                    background: isTimerRunning ? "#C0392B" : "var(--land-accent)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                  }}
                >
                  {isTimerRunning ? "Pause Timer" : timerSeconds > 0 ? "Resume" : "Start Response"}
                </button>
                <button
                  onClick={resetTimer}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    background: "var(--land-bg)",
                    border: "1px solid var(--land-rule)",
                    color: "var(--land-ink-2)",
                    fontWeight: 500,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Voice Mock prompt card */}
              <div
                style={{
                  width: "100%",
                  maxWidth: 540,
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: "var(--land-bg)",
                  border: "1px solid var(--land-rule)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--land-ink)" }}>
                    Want live voice feedback?
                  </span>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--land-ink-3)" }}>
                    Cheeni will ask a question, start the clock, and critique your response clarity.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onAskCheeni?.("Cheeni, ask me a hard technical interview question, time my answer, and evaluate me on clarity and technical depth.");
                    onClose?.();
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "var(--land-bg-2)",
                    border: "1px solid var(--land-accent)",
                    color: "var(--land-accent)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Ask Cheeni &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TOPIC ROADMAP */}
          {activeTab === "roadmap" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontFamily: "var(--land-serif)" }}>
                    Preparation Trackers
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--land-ink-3)" }}>
                    Check off topics as you practice them with Cheeni. Saved in your local browser workspace.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                {TOPIC_ROADMAP.map((topic) => {
                  const milestones = topic.milestones;
                  const currentDone = roadmapProgress[topic.id] || milestones.map(m => m.done);
                  const completedCount = currentDone.filter(Boolean).length;
                  const pct = Math.round((completedCount / milestones.length) * 100);

                  return (
                    <div
                      key={topic.id}
                      style={{
                        background: "var(--land-bg-2)",
                        border: "1px solid var(--land-rule)",
                        borderRadius: 12,
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {/* Topic Header */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--land-ink)" }}>
                            {topic.name}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: topic.color }}>
                            {pct}%
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "var(--land-ink-3)", lineHeight: 1.4 }}>
                          {topic.description}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div
                        style={{
                          width: "100%",
                          height: 6,
                          background: "var(--land-rule)",
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: topic.color,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      {/* Milestones Checklist */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                        {milestones.map((m, idx) => {
                          const isChecked = !!currentDone[idx];
                          return (
                            <label
                              key={idx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                color: isChecked ? "var(--land-ink-3)" : "var(--land-ink)",
                                textDecoration: isChecked ? "line-through" : "none",
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleMilestone(topic.id, idx)}
                                style={{ accentColor: topic.color, cursor: "pointer" }}
                              />
                              <span>{m.name}</span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => {
                          onAskCheeni?.(`Cheeni, give me a comprehensive interview drill on ${topic.name}.`);
                          onClose?.();
                        }}
                        style={{
                          marginTop: "auto",
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: "var(--land-bg)",
                          border: `1px solid ${topic.color}`,
                          color: topic.color,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        Drill {topic.short} with {assistantName} &rarr;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InterviewPrepModal;
