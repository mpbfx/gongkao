# Gongkao Question Bank

This context describes the learning domain language for the civil-service exam question bank. The system helps learners practice questions, review mistakes, and receive targeted study guidance.

## Language

**Learning Coach Agent**:
An agent that diagnoses a learner's recent practice performance and recommends the next training action.
_Avoid_: generic agent, planner, chatbot

**Explanation Tutor Agent**:
An agent that helps a learner understand a specific question after the learner asks for help or finishes answering it.
_Avoid_: answer bot, chat assistant, generic tutor

**Practice Session**:
A bounded set of questions attempted by a learner in one sitting or review flow.
_Avoid_: quiz, test run

**Practice Answer**:
A learner's answer to one question within a practice session, including correctness and time spent.
_Avoid_: response, submission item

**Wrong Question**:
A question that remains in a learner's active mistake set until the learner resolves it through later correct practice.
_Avoid_: error, failed question

**Training Recommendation**:
A concrete next action proposed by the Learning Coach Agent, such as a special practice session, wrong-question practice session, or memorize session.
_Avoid_: suggestion, tip

**Action Information**:
Student-facing information that helps a learner choose or complete the next learning action in the current flow.
_Avoid_: useless information, decorative statistic, explanatory copy

**Learning Workspace**:
The learner's entry screen for starting or continuing practice and reaching the main study flows.
_Avoid_: marketing homepage, feature showcase, dashboard splash

**Learner Profile**:
The learner's personal area for account context, recent practice records, and links back into active study flows.
_Avoid_: analytics dashboard, study cockpit, metrics overview

**Recommendation Start**:
The learner action that turns a training recommendation into a practice session.
_Avoid_: auto start, pre-created session

**Diagnosis Window**:
The configurable set of recent practice data used by the Learning Coach Agent to diagnose a learner's current state.
_Avoid_: period, range, lookback

**Tutor Message**:
A single learner question or assistant answer exchanged with the Explanation Tutor Agent about one question.
_Avoid_: chat log, generic message

**Mistake Review**:
A three-part Explanation Tutor Agent answer that identifies the learner's likely mistake cause, gives the fastest valid solving path, and states a reusable rule for similar questions.
_Avoid_: generic explanation, official analysis rewrite, long-form lecture

**Mistake Cause**:
A stable category describing why the learner likely missed a question during review.
_Avoid_: vague weakness, casual blame, free-form reason

**Mistake Review Record**:
A historical structured record of one Mistake Review for one learner and one question.
_Avoid_: overwritten mistake state, analytics cache, message metadata

**Analyzed Mistake Distribution**:
A learner-facing trend based on the latest Mistake Review Record for each analyzed wrong question, shown alongside the count of wrong questions that have not been analyzed.
_Avoid_: full mistake distribution, tutor usage count, raw message count

**Mistake Review Action**:
A learner action that uses mistake cause analysis to open, filter, or continue reviewing a concrete set of wrong questions.
_Avoid_: passive report, decorative chart, standalone insight

**Knowledge-Point Mistake Pattern**:
An analyzed mistake pattern that combines a question knowledge point with a Mistake Cause.
_Avoid_: generic weak point, isolated tag statistic

**Agent Feedback**:
A learner's rating or reason about whether an agent output was useful.
_Avoid_: review, comment

## Relationships

- A **Practice Session** contains one or more **Practice Answers**.
- A **Practice Answer** may create or resolve one **Wrong Question**.
- A **Learning Coach Agent** applies a **Diagnosis Window** to **Practice Sessions**, **Practice Answers**, and **Wrong Questions** to produce one or more **Training Recommendations**.
- An **Explanation Tutor Agent** operates on exactly one question at a time, usually with the learner's current answer and the official explanation.
- An **Explanation Tutor Agent** produces a **Mistake Review** when explaining a submitted or wrong question.
- A **Mistake Review** includes exactly one primary **Mistake Cause**.
- A **Mistake Review** may create a **Mistake Review Record**; multiple records may exist for the same learner and question over time.
- A successful structured **Mistake Review** creates a **Mistake Review Record** automatically; the learner does not need to save it manually.
- An **Analyzed Mistake Distribution** counts each analyzed question once by its latest **Mistake Review Record** and separately reports unanalyzed active **Wrong Questions**.
- An **Analyzed Mistake Distribution** belongs near **Wrong Questions** and should lead to one or more **Mistake Review Actions**.
- A **Knowledge-Point Mistake Pattern** helps the learner distinguish what they are missing within a knowledge point, not just which knowledge point is weak.
- A **Training Recommendation** creates a new **Practice Session** only after a **Recommendation Start**.
- A **Tutor Message** belongs to one learner and usually references one question.
- **Agent Feedback** belongs to one **Training Recommendation** or **Tutor Message**.
- Student-facing pages prioritize **Action Information** over general explanation or decorative learning metrics.
- The **Learning Workspace** presents **Action Information** for continuing practice, starting a main practice flow, or addressing active **Wrong Questions**.
- The **Learner Profile** does not compete with the **Learning Workspace**; it provides account context, recent records, and return paths to study flows.
- List pages only promote summary metrics when the metric changes the learner's next action in that flow.
- A **Practice Session** view prioritizes question completion and review clarity over secondary result statistics or implementation explanations.
- Agent surfaces stay quiet until review or remediation: the **Learning Coach Agent** appears after submission or in review, and the **Explanation Tutor Agent** stays behind a learner-triggered action.

## Example Dialogue

> **Dev:** "Should the agent answer any question the user asks?"
> **Domain expert:** "No. The **Learning Coach Agent** recommends what to practice next, while the **Explanation Tutor Agent** explains a specific question."

> **Dev:** "Should the **Explanation Tutor Agent** expand the official explanation?"
> **Domain expert:** "No. It should produce a **Mistake Review** that tells the learner why they likely missed it, how to solve it fastest, and what rule to reuse next time."

> **Dev:** "Can the tutor describe the learner's mistake however it wants?"
> **Domain expert:** "No. The **Mistake Review** should choose one primary **Mistake Cause** so patterns can be measured across questions."

> **Dev:** "If the learner asks about the same question again, do we replace the old review?"
> **Domain expert:** "No. Keep a **Mistake Review Record** history, but make the latest one easy to use for the question detail view."

> **Dev:** "Do repeated tutor questions make a mistake cause more important?"
> **Domain expert:** "No. The **Analyzed Mistake Distribution** should count each analyzed wrong question once using its latest review, and show unanalyzed wrong questions separately."

> **Dev:** "Should mistake trends live in a standalone learning report?"
> **Domain expert:** "No. Put the **Analyzed Mistake Distribution** with **Wrong Questions** and make it lead to a **Mistake Review Action**."

> **Dev:** "Should learners save useful tutor answers before they count in mistake trends?"
> **Domain expert:** "No. A successful structured **Mistake Review** should create a **Mistake Review Record** automatically."

> **Dev:** "Is it enough to know that a learner is weak in one knowledge point?"
> **Domain expert:** "No. A **Knowledge-Point Mistake Pattern** should show whether that weakness is caused by reading misses, concept confusion, option traps, or another mistake cause."

## Flagged Ambiguities

- "agent" was used broadly; resolved into **Learning Coach Agent** and **Explanation Tutor Agent** because they have different triggers, data needs, and success metrics.
- "useless information" was used broadly; resolved as information that is not **Action Information** in the learner's current flow.
- "homepage" was used ambiguously; resolved as the **Learning Workspace**, not a marketing page or feature showcase.
- "dashboard" was used ambiguously; resolved as the **Learner Profile**, not an analytics-heavy overview.
- "explanation" was too broad for tutor output; resolved as **Mistake Review** when the learner is reviewing a submitted or wrong question.
- "wrong reason" was too free-form; resolved as **Mistake Cause** with a fixed first-version set: reading miss, concept confusion, option trap, calculation error, material location error, inefficient method, or unknown.
- "latest mistake" and "mistake trend" have different needs; resolved by keeping historical **Mistake Review Records** while allowing the latest record for a learner-question pair to be identified.
- "mistake distribution" should not imply all wrong questions are classified; resolved as **Analyzed Mistake Distribution**, which only covers analyzed questions and separately exposes unanalyzed active wrong questions.
- "trend page" was too passive; resolved as an **Analyzed Mistake Distribution** on the wrong-question flow, backed by **Mistake Review Actions**.
- "save review" would make trend data incomplete; resolved that successful structured **Mistake Reviews** automatically create **Mistake Review Records**.
- "weak knowledge point" was too coarse for tutor-driven insight; resolved as **Knowledge-Point Mistake Pattern** when mistake cause and knowledge point are used together.
