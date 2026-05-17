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

**Agent Feedback**:
A learner's rating or reason about whether an agent output was useful.
_Avoid_: review, comment

## Relationships

- A **Practice Session** contains one or more **Practice Answers**.
- A **Practice Answer** may create or resolve one **Wrong Question**.
- A **Learning Coach Agent** applies a **Diagnosis Window** to **Practice Sessions**, **Practice Answers**, and **Wrong Questions** to produce one or more **Training Recommendations**.
- An **Explanation Tutor Agent** operates on exactly one question at a time, usually with the learner's current answer and the official explanation.
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

## Flagged Ambiguities

- "agent" was used broadly; resolved into **Learning Coach Agent** and **Explanation Tutor Agent** because they have different triggers, data needs, and success metrics.
- "useless information" was used broadly; resolved as information that is not **Action Information** in the learner's current flow.
- "homepage" was used ambiguously; resolved as the **Learning Workspace**, not a marketing page or feature showcase.
- "dashboard" was used ambiguously; resolved as the **Learner Profile**, not an analytics-heavy overview.
