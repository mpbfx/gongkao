# Use Pi Agent Runtime for the Explanation Tutor

**Status:** accepted

The Explanation Tutor uses `@mariozechner/pi-agent-core` for stateful multi-turn execution, tool calling, streaming events, cancellation, and runtime hooks. `@mariozechner/pi-ai` supplies the OpenAI-compatible model transport.

The current question, authenticated learner, and access scope remain server-controlled. Pi tools receive these values through closures, so model-generated arguments cannot select another learner or question. Conversation history is restored from `AgentTutorMessage` and pruned before each model request.

Every successful Tutor run must call `submit_mistake_review` once before its final answer. The tool validates and stages the structured result; application persistence writes the assistant message and Mistake Review together after the run succeeds. Provider failures never return a template pretending to be an AI response.

The Learning Coach remains deterministic and uses a plain TypeScript pipeline. LangGraph is therefore no longer a project dependency. Internal reasoning and complete tool payloads are not persisted.

Pi packages are pinned to `0.73.1` because their API has not reached 1.0. A real-gateway smoke test is required before deployment because OpenAI-compatible gateways vary in tool-calling support.
