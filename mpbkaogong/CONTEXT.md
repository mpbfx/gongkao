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

## Relationships

- A **Practice Session** contains one or more **Practice Answers**.
- A **Practice Answer** may create or resolve one **Wrong Question**.
- A **Learning Coach Agent** reads **Practice Sessions**, **Practice Answers**, and **Wrong Questions** to produce one or more **Training Recommendations**.
- An **Explanation Tutor Agent** operates on exactly one question at a time, usually with the learner's current answer and the official explanation.
- A **Training Recommendation** may start a new **Practice Session**.

## Example Dialogue

> **Dev:** "Should the agent answer any question the user asks?"
> **Domain expert:** "No. The **Learning Coach Agent** recommends what to practice next, while the **Explanation Tutor Agent** explains a specific question."

## Flagged Ambiguities

- "agent" was used broadly; resolved into **Learning Coach Agent** and **Explanation Tutor Agent** because they have different triggers, data needs, and success metrics.
