# Use LangGraph.js for Agent orchestration

We will implement the Learning Coach Agent and Explanation Tutor Agent inside the existing Next.js backend, using LangGraph.js as the core orchestration framework. This keeps the first production version close to the current TypeScript service layer while giving the project mainstream Agent engineering concepts such as state graphs, tool nodes, checkpointing, tracing, and future human-in-the-loop workflows.

**Status:** superseded by ADR 0002

**Considered Options:** OpenAI Agents SDK would be simpler and more OpenAI-native, while a standalone Python Agent service would match many AI examples but add deployment and data-access complexity. LangGraph.js gives stronger interview-relevant Agent architecture while preserving the existing TypeScript stack.

**Consequences:** Agent code must be designed as graph nodes and tools instead of ad hoc service calls. We will add LangSmith for trace/eval workflows and keep Vercel AI SDK focused on streaming UI rather than core orchestration.

This decision was superseded after the Tutor implementation remained a linear graph without tool selection or persisted conversation state. The Learning Coach now uses a deterministic TypeScript pipeline, while the Explanation Tutor uses Pi Agent Runtime.
