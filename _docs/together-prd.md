# Together.ng — Product Requirements & Implementation Plan

**Document type:** Product Requirements Document (PRD) / Functional Implementation Plan  
**Product:** Together  
**Working domain:** together.ng  
**Status:** Detailed product specification  
**Scope:** Product behavior, workflows, business rules, functional requirements, acceptance criteria, technical architecture, technology stack, matching algorithm, and AI implementation approach  
**Revision note:** This revision adds Section 65 (Technical Implementation Plan) and Section 66 (Low-Fidelity Wireframes). Sections 1–64 remain the product specification and are unchanged in substance.  
**Companion file:** Wireframes and the system architecture diagram are in `together-wireframes.html` (see Section 66).

---

# 1. Purpose of This Document

This document describes how Together should function as a complete product.

It is intentionally written independently of technology and implementation architecture. A product manager, designer, engineer, QA engineer, or future technical team should be able to read it and understand:

- What users can do
- Why each capability exists
- What happens at each stage of a process
- What information users provide
- What the application does with that information
- What other users see
- What notifications are generated
- How requests progress
- How contributions are completed
- How reputation is established
- How physical-resource lending is handled
- How moderation and trust work
- What happens in exceptional cases
- How each feature can be tested

The objective is to define the **behavior of the product before deciding how it will be built.**

---

# 2. Product Definition

Together is a non-monetary network that connects people who need help becoming more capable with people who can contribute knowledge, skills, resources, access, time, or experience.

The platform does not require reciprocal exchange.

A person can receive help without giving anything back.

A person can contribute without expecting anything in return.

A person may participate entirely as a recipient, entirely as a contributor, or move between both roles.

The core product loop is:

> **Need → Request → Discovery/Matching → Contribution → Outcome → Trust → Future Contribution**

---

# 3. Product Goals

## 3.1 Primary goals

Together should:

1. Make it easy and dignified to ask for productive help.
2. Help users formulate specific, actionable requests.
3. Connect needs with people who may be able to help.
4. Allow people to discover worthwhile needs even when they were not specifically matched.
5. Make contribution simple and rewarding without turning it into a monetary system.
6. Build trust through observable contribution history rather than popularity.
7. Enable safe sharing of physical resources.
8. Encourage people who receive help to eventually become contributors when they are able.
9. Make useful human capability easier to discover.
10. Create a sustainable community culture centered around learning, building, creating, and progressing.

## 3.2 Secondary goals

Together should eventually:

- Connect individuals with institutions.
- Support local and remote assistance.
- Support both digital and physical resources.
- Make accumulated community knowledge increasingly discoverable.
- Use automation to reduce coordination effort.
- Develop a structured map of skills, needs, resources, and contributors.

---

# 4. Non-Goals

The initial product should not become:

- A fundraising platform.
- A personal loan platform.
- A jobs marketplace.
- A freelance marketplace.
- A barter platform.
- A marketplace for buying and selling.
- A platform where users earn credits for helping.
- A follower-based social network.
- A popularity competition.
- A general-purpose social media platform.
- A platform where users are expected to repay help directly.

Monetary transactions between users are outside the core Together model.

---

# 5. Core Product Principles

## 5.1 Asking for help is acceptable

A user does not need to demonstrate usefulness before asking for help.

There must be no public indicator that implies a person is less valuable because they have helped nobody.

## 5.2 Contribution is voluntary

A user may receive help without subsequently contributing.

Together can encourage contribution but should not create debt.

## 5.3 Help should increase capability

The platform should favor needs involving:

- Learning
- Education
- Skills
- Knowledge
- Tools
- Resources
- Access
- Mentorship
- Projects
- Creation
- Productivity
- Collaboration

## 5.4 Trust should describe behavior

Trust indicators should answer:

> “Has this person historically been reliable?”

They should not answer:

> “How popular is this person?”

## 5.5 Accessibility before complexity

Anyone should be able to participate in low-risk activities without completing extensive verification.

Additional requirements can be introduced when an activity creates additional risk.

## 5.6 Human dignity

The product language should avoid terms and interaction patterns associated with begging, charity ranking, pity, or social inferiority.

---

# 6. User Types

These are participation roles rather than permanent account types.

## 6.1 Recipient

A person currently asking for help.

Examples:

- Student seeking a textbook.
- Beginner seeking mentorship.
- Builder seeking access to equipment.
- Person seeking advice from an experienced professional.

## 6.2 Contributor

A person offering help.

Examples:

- Teacher offering tutoring.
- Engineer offering code reviews.
- Person offering an unused book.
- Person lending a tool.

## 6.3 Supporter

A user who helps indirectly.

Examples:

- Upvoting a worthwhile request.
- Sharing a request.
- Reporting useful resources.
- Confirming that a contribution was helpful.

A user can occupy all three roles.

---

# 7. Account Creation and Onboarding

## 7.1 Registration

A new user creates an account using the supported registration method.

The registration process should collect only information necessary for normal participation.

The user should be introduced to Together's philosophy during onboarding.

The product should explicitly communicate:

> You can ask for help even if you currently have nothing to offer.

This is important because the onboarding experience establishes the culture of the platform.

## 7.2 Basic profile

The user can provide:

- Name/display name
- Profile photo, if desired
- General location, where useful
- Short description
- Areas of interest
- Skills they can help with
- Resources they can potentially share
- Preferred forms of contribution

A user should not be required to complete every section.

## 7.3 Contribution capabilities

The user can select one or more predefined categories.

Examples:

- Education
- Technology
- Science
- Engineering
- Business
- Arts
- Design
- Writing
- Languages
- Skilled trades
- Books
- Tools
- Equipment
- Career guidance
- Entrepreneurship
- Research
- Local knowledge

The taxonomy should be designed to evolve.

Within a category, the user can specify individual capabilities.

Example:

**Technology**

- Python
- JavaScript
- Backend development
- Linux
- Databases
- Code review

## 7.4 Contribution availability

Where relevant, the user can indicate:

- Online
- In person
- Both
- Preferred geographic area
- Willingness to lend resources
- Willingness to mentor
- Willingness to answer questions
- Willingness to collaborate

## 7.5 No-contribution onboarding

If a user selects no contribution categories, onboarding still completes normally.

The product should reinforce:

> “That's okay. You can simply use Together when you need help.”

No negative score, warning, or shame indicator should be displayed.

---

# 8. User Profile

A profile should represent a person's participation and trust rather than function as a conventional social-media profile.

## 8.1 Profile information

A profile may display:

- Name
- Photo
- Short description
- General location
- Skills
- Contribution categories
- Verified skills
- Contributor since date
- People helped
- Successful contributions
- Relevant badges
- Resource-sharing history where appropriate

## 8.2 What should not be central

The profile should not emphasize:

- Followers
- Following
- Number of likes received
- Wealth
- Social status
- Popularity
- Monetary value of contributions

## 8.3 Privacy

Users should control what personal information is publicly visible.

Exact addresses should never be publicly exposed for resource exchanges.

Exact contact information should remain private unless users choose to share it through the appropriate interaction.

---

# 9. Creating a Request for Help

Creating a request is one of the most important workflows in Together.

## 9.1 Start request

The user selects:

> **Ask for help**

The application explains that a specific request is more likely to receive useful responses.

## 9.2 Select category

The user selects the most relevant category.

The user should be able to search categories if the list is large.

The application should allow a request to be classified into the most appropriate category rather than requiring users to understand the full taxonomy.

## 9.3 Describe the goal

The user explains what they are trying to accomplish.

Example:

> “I am trying to learn electronics and build my first simple circuit.”

## 9.4 Describe the barrier

The user explains what is preventing progress.

Example:

> “I understand the theory but don't have anyone experienced who can guide me through practical work.”

## 9.5 Describe the requested help

The user states what would help.

Example:

> “I need someone experienced with basic electronics who can answer questions and guide me through my first project.”

The user should not have to know the exact resource needed. Together should allow people to describe the problem and let potential contributors suggest appropriate forms of help.

## 9.6 Optional request details

Depending on category, the request may ask for:

- Location
- Remote/online preference
- Time commitment
- Duration
- Deadline
- Skill level
- Intended outcome
- Resource specifications
- Quantity
- Availability
- Whether the user needs to borrow, receive, access, learn, or collaborate

Only relevant questions should be shown.

## 9.7 Request preview

Before publishing, the user sees the complete request and can edit it.

The application should highlight missing information that may reduce the likelihood of receiving help.

## 9.8 Publishing

The user publishes the request.

Once published:

- It becomes discoverable according to visibility settings.
- Relevant matching contributors become eligible for notifications.
- It can appear in category feeds.
- It can receive votes.
- Users can share it.
- Potential contributors can respond.

---

# 10. Request Quality Guidance

Together should actively improve requests rather than merely reject poorly written ones.

A user who writes:

> “I need a laptop.”

should receive guidance such as:

> “What are you trying to do with the laptop?”

The goal is not to interrogate the user.

The application should progressively help them provide useful context.

A high-quality request should make it easy for someone to answer:

1. What does this person want to accomplish?
2. Why are they currently blocked?
3. What kind of help would move them forward?
4. What constraints matter?
5. Where and when is the help needed?

---

# 11. Request States

A request should have an explicit lifecycle.

Recommended states:

1. **Draft**
2. **Published**
3. **Receiving responses**
4. **Help arranged**
5. **In progress**
6. **Completed**
7. **Closed**
8. **Cancelled**
9. **Archived**
10. **Under review**, when moderation is required

The user should be able to understand the current state at all times.

---

# 12. Request Discovery

Users should be able to discover needs without receiving a direct match.

## 12.1 General featured feed

The featured area displays requests that the community may find worthwhile.

The feed should prioritize useful discovery rather than simply displaying the newest posts.

## 12.2 Category feeds

Each category has its own request feed.

For example:

- Education
- Technology
- Books
- Engineering
- Arts

## 12.3 Search

Users can search requests using natural descriptions and structured categories.

Search should support finding both:

- Requests that match a user's capabilities.
- Requests a user is personally interested in.

## 12.4 Filters

Potential filters include:

- Category
- Location
- Online/in-person
- Type of help
- Newest
- Most supported
- Needs still open
- Resource type
- Skill level

---

# 13. Voting

Any eligible user can upvote a request they believe deserves attention.

An upvote means:

> “I think this need is worthwhile and should receive visibility.”

It does not mean:

- The voter can satisfy the request.
- The voter owes help.
- The voter has donated anything.
- The request is automatically valid.

A user should be able to remove their vote.

The application should prevent repeated voting intended to artificially inflate visibility.

---

# 14. Sharing Requests

Users should be able to share requests externally.

The shared representation should contain enough context for someone to understand the need and return to Together.

Sharing is another discovery mechanism.

A person who cannot help may know someone who can.

---

# 15. Matching

Together should maintain a relationship between requests and potentially relevant contributors.

Matching should consider information such as:

- User-selected skills
- Contribution categories
- Specific capabilities
- Resource types
- Location
- Remote/in-person preferences
- Availability
- Request requirements
- Relevant past activity
- User notification preferences

A match does not automatically mean the contributor has agreed to help.

It means:

> **This request appears relevant to what this person said they may be able to contribute.**

The user should remain in control of whether to respond.

---

# 16. Contributor Notifications

When a new request appears to match a user's stated capabilities, the user may receive a notification.

Notifications should explain why the request is relevant.

Example:

> “Someone is looking for help with beginner Python. You indicated that you can help with Python.”

Users should be able to control:

- Categories they receive notifications for
- Frequency
- Local versus remote requests
- Resource-lending notifications
- Mentorship notifications
- Other contribution types

The goal is to avoid notification fatigue.

---

# 17. Responding to a Request

A potential contributor selects:

> **I can help**

They should be able to explain how they can help.

Example:

> “I can help you with the first three weeks of the course. I'm available online on Saturday afternoons.”

The contributor should not have to commit to the entire request.

They may offer a narrower form of assistance.

---

# 18. Multiple Contributors

A request can receive multiple offers.

The requester should be able to:

- Review offers
- Ask questions
- Accept one or more contributors
- Decline offers
- Keep the request open
- Close the request once sufficient help has been arranged

The system should not assume the first response is automatically the best response.

---

# 19. Communication

Once a contributor and requester decide to proceed, Together should provide a communication channel.

Communication should support:

- Clarifying the request
- Agreeing on what will be provided
- Coordinating timing
- Sharing relevant information
- Confirming completion

Users should not be forced to publicly expose personal contact details.

---

# 20. Completing a Contribution

After the help takes place, the contribution should be marked as completed.

Either participant can initiate completion.

The other participant can confirm.

A completed contribution should record enough information to establish that the interaction occurred without unnecessarily exposing private conversation details.

---

# 21. Outcome Confirmation

The recipient should be asked:

> **Did this help you move forward?**

Possible responses:

- Yes, significantly
- Yes, somewhat
- Not yet
- No

The recipient can optionally explain what happened.

This feedback should be more important than simple likes.

The objective is to determine whether Together is actually helping people progress.

---

# 22. Contributor Feedback

The recipient can provide structured feedback about the contribution.

Potential dimensions:

- Helpful
- Reliable
- Clear
- Respectful
- Completed as agreed

This information contributes to trust signals.

It should not become a public star-rating competition.

---

# 23. Reputation

Reputation is accumulated from meaningful participation.

Potential reputation signals:

- Contributor since
- People helped
- Successful contributions
- Completed contributions
- Verified skills
- Resource lending history
- Relevant badges
- Community confirmations

A reputation indicator should never represent a monetary balance.

There should be no concept of:

> “You have 50 points and therefore can request 50 units of help.”

---

# 24. Verified Skills

A skill can become verified through meaningful evidence.

Possible evidence sources include:

- Demonstrated work
- Completed contributions
- Community confirmations
- Relevant credentials where appropriate
- Successful mentorship
- Other trustworthy evidence

Verification should communicate:

> “There is evidence that this person can help with this skill.”

It should not imply professional licensing unless the relevant credential has actually been verified.

---

# 25. Badges

Badges may recognize contribution patterns.

Examples:

- Early Contributor
- Helpful Mentor
- Skill Contributor
- Book Sharer
- Resource Lender
- Consistent Contributor
- Community Supporter

Badges should be descriptive and celebratory.

They should not provide economic value or unlock unfair social status.

Badges should not be required for participation.

---

# 26. Contribution Without Reciprocity

After a user receives help, Together may encourage them to contribute when they are able.

For example:

> “Glad you got the help you needed. Is there anything you know or have that someone else might find useful?”

This should be an invitation, not an obligation.

There should be no countdown, debt, or expectation that the person must give back.

---

# 27. Resource Sharing

Together supports sharing of physical and digital resources.

Resource types can include:

- Books
- Tools
- Computers
- Cameras
- Musical instruments
- Equipment
- Educational materials
- Other useful items

The contributor specifies whether the resource is:

- Given away
- Lent temporarily
- Available for supervised use
- Available for local use only
- Available remotely/digitally where applicable

---

# 28. Lending Workflow

Physical lending requires additional safeguards.

## Step 1 — Resource listing

The owner describes:

- Resource
- Condition
- Intended use
- Location
- Availability
- Lending duration
- Restrictions
- Relevant accessories

## Step 2 — Request

A user asks to borrow it and explains the intended use.

## Step 3 — Trust assessment

Depending on resource value and risk, Together may require additional verification or an established history of successful participation.

## Step 4 — Agreement

Both parties confirm:

- What is being lent
- Expected condition
- Lending period
- Return expectations
- Any special handling requirements

## Step 5 — Condition record

The owner records the item's condition using descriptions and, where appropriate, photographs.

The borrower acknowledges the condition.

## Step 6 — Handoff

Both parties confirm that the resource was handed over.

## Step 7 — Return

The borrower returns the resource.

The return condition is recorded.

## Step 8 — Confirmation

The owner confirms whether the resource was returned satisfactorily.

## Step 9 — Contribution history

A successful lending interaction becomes part of the relevant trust history.

---

# 29. High-Value Resource Rules

High-value resources should not be treated like books.

The platform may require:

- Identity verification
- Established account history
- Successful previous contributions
- Additional agreement
- Additional safety checks
- Higher trust requirements

New users should not automatically gain access to high-value resources.

The exact thresholds can be determined during implementation based on real-world usage and risk.

---

# 30. Resource Damage or Loss

If an item is returned damaged, lost, or not returned:

1. The owner reports the issue.
2. The borrower is notified.
3. Both parties can provide relevant information.
4. The existing condition and lending records are reviewed.
5. The issue can enter a dispute process.
6. Together may restrict one or both accounts while investigating.
7. Serious violations can result in suspension or permanent removal.
8. Where appropriate and legally necessary, relevant information can be provided to authorities.

Together should not automatically decide every dispute in favor of the owner or borrower.

The objective is fair handling based on available evidence.

---

# 31. Repeat Abuse and New Accounts

Reputation alone cannot prevent someone from abandoning an account and creating another.

Together should therefore treat trust as more than a public profile metric.

High-risk activities can require stronger account verification.

New accounts should have limited access to activities where misuse could cause substantial loss.

The platform should detect and restrict suspicious patterns where possible.

The product should prioritize:

> **Preventing a new account from immediately gaining access to high-risk resources**

rather than attempting to make it impossible for anyone to ever create multiple accounts.

---

# 32. Insurance

Insurance is not part of the basic Together experience.

It may eventually be offered through external partnerships for high-value physical resources.

Potential future options:

- Community lending without additional protection
- Protected lending with optional insurance

Together should not assume responsibility for insuring all resources itself.

This feature should only be introduced if real usage demonstrates a need.

---

# 33. Institutions

Organizations should eventually be able to participate.

Potential institutions include:

- Universities
- Schools
- Libraries
- Companies
- Workshops
- Laboratories
- Makerspaces
- Professional associations
- Nonprofits
- Community organizations

They may contribute:

- Equipment
- Training
- Books
- Mentors
- Facilities
- Expertise
- Access

Institutional accounts should have appropriate verification and administrative capabilities.

---

# 34. Moderation

Together needs moderation because not every request or interaction will be appropriate.

Moderation should address:

- Fraud
- Harassment
- Abuse
- Illegal activity
- Misrepresentation
- Spam
- Commercial solicitation
- Dangerous activities
- Manipulative requests
- Inappropriate content
- Attempts to circumvent platform rules

Moderation should distinguish between:

> **A person asking for help**

and:

> **A person abusing the platform.**

Need alone should never be treated as evidence of wrongdoing.

---

# 35. Reporting

Users should be able to report:

- Requests
- Profiles
- Contributions
- Messages
- Resource listings
- Other interactions

A report should allow the user to select a reason and optionally provide context.

The reporter should not be publicly identified to the reported user unless there is a legitimate reason.

---

# 36. Safety Rules

The platform should have clear rules covering:

- Physical meetups
- Resource handoffs
- Personal information
- Dangerous activities
- Professional advice
- Minors
- Illegal requests
- Financial requests
- Medical or other high-risk situations

The platform should not imply professional guarantees where contributors are simply community members.

---

# 37. Notifications

Notifications should exist for meaningful events.

Potential notifications include:

### Requester

- A potential contributor responded.
- Someone asked a clarifying question.
- A contribution was accepted.
- A contribution is ready to begin.
- A contribution was marked complete.
- A contributor needs confirmation.
- A request is receiving significant community interest.

### Contributor

- A matching request was published.
- Someone responded to their contribution offer.
- Their offer was accepted.
- A lending interaction requires confirmation.
- A request they follow has changed.

### Community

- A followed request needs attention.
- A contribution has been completed where relevant.

Users should be able to control notification frequency and categories.

---

# 38. Following Needs Without Building a Follower Culture

Users may want to follow a request or topic so they can return later.

This should be treated as **following a need**, not following a person.

The product should avoid turning this into a social follower graph.

Examples:

> Follow this request

> Follow Technology needs

> Follow Book requests

These relationships exist for discovery and participation, not social status.

---

# 39. Request Closure

A requester can close a request when:

- Help was received.
- The need no longer exists.
- They solved the problem independently.
- They found help elsewhere.
- The request was created by mistake.

The closure reason can be recorded.

If help was received, the requester should be encouraged to confirm the outcome.

Closed requests remain useful as historical contribution records unless removed for privacy, safety, or moderation reasons.

---

# 40. Unsuccessful Requests

Not every request will receive help.

A request can remain open for an appropriate period.

The application may periodically ask:

> “Do you still need help with this?”

The user can:

- Keep it open
- Update it
- Close it
- Mark it solved elsewhere

The platform should not imply that failure to receive help means the request was invalid or the requester was undeserving.

---

# 41. Request Editing

A requester should be able to edit an open request.

Significant changes should be visible to people who have already responded when necessary.

If the fundamental need changes, the application may suggest creating a new request instead.

---

# 42. Duplicate and Related Requests

The same need may be posted by multiple people.

Together should make it possible to identify related requests.

Related requests may eventually help users discover:

- Previous solutions
- People who helped others with similar needs
- Resources
- Repeated community needs

This creates a path from individual requests toward reusable community knowledge.

---

# 43. Community Knowledge

When a particular need repeatedly appears, Together should eventually be able to surface accumulated knowledge around it.

For example:

> “How do I learn electronics?”

could lead to:

- Existing requests
- People who have helped
- Recommended resources
- Local contributors
- Institutions
- Previous successful solutions

The platform can gradually transform repeated human interactions into discoverable knowledge.

---

# 44. AI-Assisted Product Experiences

AI implementation is intentionally outside the current technical scope, but the product should reserve functional opportunities for future automation.

Potential experiences include:

- Improving vague requests
- Asking relevant clarifying questions
- Categorizing requests
- Identifying likely skills needed
- Finding related requests
- Explaining why a contributor is a potential match
- Summarizing long requests
- Helping contributors understand how they could help
- Finding relevant community resources

These capabilities should assist coordination rather than replace human contribution.

---

# 45. Search and Discovery of Contributors

A requester should eventually be able to discover people who may help.

A contributor profile should show relevant capability and trust information.

The requester should not need to know the person's name.

They should be able to search by:

- Skill
- Category
- Location
- Contribution type
- Resource
- Availability

The system should prioritize relevant capability rather than popularity.

---

# 46. Local Versus Remote Help

Every relevant request should distinguish between forms of help.

Examples:

**Remote**

- Mentorship
- Code review
- Tutoring
- Research guidance

**Local**

- Borrowing a tool
- Using equipment
- Hands-on instruction
- Physical resource exchange

**Either**

- Some forms of knowledge sharing
- Books
- Some mentorship
- Some collaboration

Location should only be required when it materially affects the request.

---

# 47. User Privacy

Together should collect and expose information according to the minimum needed for successful coordination.

Public profiles should not reveal:

- Exact residential addresses
- Private phone numbers
- Private email addresses
- Sensitive identity information

Physical exchanges may require users to exchange additional information privately after choosing to proceed.

---

# 48. Blocking

Users should be able to block another user.

Blocking should prevent unwanted interaction according to the applicable product rules.

A blocked user should not be able to use ordinary platform features to repeatedly contact the blocker.

Blocking should not remove legitimate safety-reporting capabilities.

---

# 49. Trust and Safety Escalation

Trust issues should have levels.

### Low-level issue

Example:

- Poor communication
- Missed appointment

Potential response:

- Feedback
- Warning
- Reduced trust signal

### Moderate issue

Example:

- Repeated failure to return resources

Potential response:

- Lending restriction
- Temporary suspension
- Additional verification

### Serious issue

Example:

- Theft
- Fraud
- Threats
- Serious harassment

Potential response:

- Immediate restriction
- Investigation
- Permanent removal where appropriate
- Legal escalation where required

---

# 50. Admin Functions

Administrators should be able to:

- Review reports
- Review accounts
- Suspend accounts
- Restore accounts
- Restrict specific capabilities
- Review disputed contributions
- Review high-risk resource activity
- Manage categories
- Manage badges
- Manage moderation rules
- Feature requests
- Remove harmful content
- Review platform metrics
- Investigate abuse patterns

Administrative actions should be auditable.

---

# 51. Category Management

Categories should not be permanently fixed.

Administrators should be able to:

- Add categories
- Rename categories
- Merge categories
- Retire categories
- Add subcategories
- Add skills
- Mark obsolete skills
- Associate related categories

Changes should avoid destroying historical records.

---

# 52. Request Quality and Moderation Are Different

A request can be poorly written without being inappropriate.

For example:

> “Need a computer to learn coding.”

This is a low-quality request but not necessarily a moderation problem.

The application should first attempt to **help the user improve it.**

Moderation should be reserved for requests that violate platform rules.

This distinction is important to maintaining a welcoming culture.

---

# 53. Abuse of Voting

Voting should not become a mechanism for manipulation.

The product should detect or restrict:

- Repeated voting
- Artificial voting campaigns
- Multiple-account manipulation
- Coordinated abuse

Voting should affect discovery but should not determine whether someone deserves help.

---

# 54. Success Metrics

## Primary metric

### Successful contributions

A successful contribution is an interaction where:

1. A meaningful need is identified.
2. Someone offers help.
3. The help is arranged.
4. The contribution occurs.
5. The recipient confirms that it helped them move forward.

## Supporting metrics

Track:

- Number of requests
- Percentage receiving at least one response
- Time to first useful response
- Percentage of requests resulting in successful contributions
- Number of contributors
- Number of recipients
- Repeat contributors
- Repeat recipients
- Number of people helped
- Resource-lending completion rate
- Resource-loss/damage rate
- Percentage of recipients who later contribute
- Category activity
- Local versus remote contribution activity
- Request quality
- Moderation incidents

---

# 55. Core User Journeys

## Journey A — New user needs help

1. User registers.
2. User sees that having nothing to contribute is acceptable.
3. User selects Ask for Help.
4. User selects a category.
5. User describes their goal.
6. User explains their barrier.
7. Together guides them toward a specific request.
8. User provides relevant constraints.
9. User publishes the request.
10. Potential contributors receive relevant notifications.
11. Other users discover and upvote the request.
12. Contributors respond.
13. User evaluates responses.
14. User accepts help.
15. Communication begins.
16. Help takes place.
17. Contribution is marked complete.
18. User confirms whether it helped.
19. Contributor's successful contribution history is updated.
20. User is later invited—but not required—to contribute something themselves.

## Journey B — User wants to help generally

1. User opens featured needs.
2. User browses requests.
3. User filters by category if desired.
4. User finds a request they can help with.
5. User opens it.
6. User selects I Can Help.
7. User describes their proposed contribution.
8. Requester receives the response.
9. Requester accepts or declines.
10. Communication occurs.
11. Help is delivered.
12. Both parties confirm completion.
13. Recipient confirms outcome.
14. Contributor receives appropriate trust/reputation credit.

## Journey C — User sees a need they cannot solve

1. User discovers a request.
2. User cannot personally provide the requested help.
3. User upvotes the request.
4. Optionally, user shares it.
5. The request receives additional visibility.
6. Another person discovers it and contributes.

## Journey D — User lends a book

1. User lists a book as available to lend.
2. Another user finds the resource.
3. Borrower explains intended use.
4. Owner reviews the request.
5. Both agree to the lending period.
6. Condition is documented.
7. Handoff is confirmed.
8. Borrower uses the book.
9. Book is returned.
10. Condition is confirmed.
11. Lending interaction is recorded as successful.

## Journey E — High-value resource lending

1. Owner lists a valuable resource.
2. Borrower requests it.
3. Together determines that stronger trust requirements apply.
4. Borrower completes required verification.
5. Borrower's eligibility is established.
6. Owner reviews borrower information.
7. Both agree to terms.
8. Condition is documented.
9. Handoff is confirmed.
10. Resource is returned.
11. Condition is checked.
12. Any issue is either closed successfully or escalated into dispute handling.
13. Successful completion contributes to future trust.

---

# 56. Acceptance Criteria for the MVP

The MVP should not be considered functionally complete until a user can perform the complete core loop.

## Account

- A user can register.
- A user can create a profile.
- A user can specify categories and capabilities they can help with.
- A user can leave contribution capabilities empty.

## Requests

- A user can create a request.
- A user can select a category.
- A user can describe their goal and barrier.
- The application guides users toward specific requests.
- A user can publish, edit, and close a request.
- A request has a clear lifecycle state.

## Discovery

- Users can browse featured needs.
- Users can browse category feeds.
- Users can search requests.
- Users can upvote requests.
- Users can share requests.

## Matching

- Contributors can specify capabilities.
- Relevant requests can be presented to potential contributors.
- Contributors can receive notifications for relevant requests.
- Contributors can respond to requests.

## Contributions

- A requester can review contributor offers.
- A requester can accept an offer.
- Users can communicate after an offer is accepted.
- A contribution can be marked complete.
- The recipient can confirm whether it helped.

## Reputation

- Successful contributions are recorded.
- Profiles display contribution history.
- People helped can be represented.
- Contributor-since information is displayed.
- Verified skills can eventually be represented.
- No monetary reputation currency exists.

## Safety

- Users can report content or accounts.
- Users can block other users.
- Administrators can review reports.
- Administrators can restrict accounts.
- Physical-resource interactions have additional safeguards.

---

# 57. Detailed Testing Strategy

The product should be tested as complete user journeys rather than only isolated screens.

## 57.1 Registration tests

Verify:

- Registration succeeds with valid information.
- Invalid registration information is handled correctly.
- Users can skip contribution capabilities.
- Users who offer no help are treated normally.
- User profiles are created correctly.

## 57.2 Request tests

Verify:

- A request cannot be published without the minimum required information.
- The request guide helps users provide useful context.
- Relevant optional fields appear for relevant categories.
- Location is not unnecessarily required.
- Published requests become discoverable.
- Editing works.
- Closing works.
- Cancelled requests behave correctly.

## 57.3 Discovery tests

Verify:

- Featured requests appear.
- Category requests appear in the correct category.
- Search returns relevant requests.
- Filters work.
- Upvoting works.
- Removing an upvote works.
- Users cannot artificially vote multiple times.
- Closed requests are handled appropriately.

## 57.4 Matching tests

Verify:

- A contributor receives relevant requests.
- An irrelevant contributor does not receive excessive notifications.
- Location requirements are respected.
- Online-only and in-person preferences are respected.
- Notification preferences are respected.
- Contributors can respond.
- Requesters can review responses.

## 57.5 Contribution tests

Verify:

- A requester can accept a contributor.
- Communication becomes available at the appropriate stage.
- A contribution can be completed.
- Both parties can confirm completion.
- The recipient can report the outcome.
- Successful contribution history updates correctly.

## 57.6 Reputation tests

Verify:

- Successful contributions are recorded.
- People-helped counts update appropriately.
- Failed or cancelled interactions do not incorrectly count as successful.
- Reputation cannot be purchased.
- Reputation cannot be converted into monetary value.
- Users cannot artificially inflate reputation.

## 57.7 Lending tests

Verify:

- A resource can be listed.
- A borrower can request it.
- Lending terms can be established.
- Condition can be recorded.
- Handoff can be confirmed.
- Return can be confirmed.
- Damage/loss can be reported.
- Disputes can be escalated.
- High-value resources trigger appropriate safeguards.

## 57.8 Safety tests

Verify:

- Users can report content.
- Reports reach appropriate administrative workflows.
- Users can block others.
- Suspended users lose the appropriate capabilities.
- Serious violations trigger appropriate escalation.
- A banned user cannot trivially regain high-risk privileges through a new account.

---

# 58. Edge Cases

The implementation should explicitly account for:

- A request receiving no responses.
- A request receiving too many responses.
- Multiple contributors helping one requester.
- A requester changing their mind.
- A contributor withdrawing.
- A contributor failing to appear.
- A resource becoming unavailable.
- A resource being damaged.
- A resource being lost.
- A user deleting their account during an active contribution.
- A request being reported.
- A contributor being reported during an active contribution.
- Duplicate requests.
- Duplicate accounts.
- Spam requests.
- Malicious voting.
- A request being solved outside Together.
- A request becoming obsolete.
- A user being unable to verify identity.
- A high-value resource being requested by a new account.
- A physical exchange being geographically impossible.
- A contributor offering only part of the requested help.
- A request requiring a professional qualification.
- A user attempting to use Together for monetary fundraising.

Each case should have a defined user-facing outcome and administrative behavior.

---

# 59. Product Language

Language is part of the product's identity.

Prefer:

- Ask for help
- Need
- Contribute
- Help someone
- Share
- Lend
- Learn
- Build
- Grow
- Progress
- People helped
- Contribution
- Community
- Supported

Avoid language that implies:

- Charity hierarchy
- Debt
- Financial exchange
- Begging
- Social status

Examples of language to avoid:

- Earn points
- Spend credits
- Repay
- Donor level
- Beggar
- Charity score
- Poor users
- Rich users

---

# 60. MVP Scope

The first version should focus on validating the central behavior.

### Include

- Registration
- Profiles
- Skill/category selection
- Request creation
- Request guidance
- Request publishing
- Featured requests
- Category feeds
- Voting
- Search
- Contributor matching
- Notifications
- Contributor responses
- Communication
- Contribution completion
- Outcome confirmation
- Basic reputation
- Basic reporting
- Blocking
- Basic administration

### Carefully limited

- Physical-resource lending
- High-value resources
- Identity verification
- Complex disputes

These should be implemented conservatively because they create significant trust and operational complexity.

### Defer

- Insurance
- Institutional accounts
- Advanced AI coordination
- Sophisticated knowledge extraction
- Complex recommendation systems
- Advanced verification
- Large-scale resource logistics

---

# 61. Phased Product Development

## Phase 1 — Core community loop

Validate:

> Ask → Match → Help → Confirm

Features:

- Registration
- Profiles
- Skills
- Requests
- Request guidance
- Discovery
- Voting
- Basic matching
- Notifications
- Responses
- Communication
- Completion
- Basic reputation

## Phase 2 — Better trust and resource sharing

Validate:

> People can safely share tangible resources.

Features:

- Resource listings
- Lending workflow
- Condition records
- Trust requirements
- Identity verification
- Dispute workflows
- Lending history

## Phase 3 — Network expansion

Expand from individuals to:

- Institutions
- Libraries
- Workshops
- Universities
- Companies
- Community organizations

## Phase 4 — Intelligent coordination

Introduce automation to:

- Improve requests
- Understand needs
- Match people
- Surface resources
- Connect related needs
- Build reusable knowledge

---

# 62. The Most Important Product Loop to Validate

Before building the full platform, the most important question is:

> **Will strangers actually help strangers with productive needs when money is deliberately removed from the interaction?**

The MVP should therefore optimize for learning this.

A successful early community should demonstrate examples such as:

> Person A asks for help learning something.

> Person B sees the request.

> Person B offers help.

> Person A progresses.

> The interaction is confirmed.

Then:

> Person A eventually becomes Person C's helper.

If that loop happens naturally, Together has evidence that its core social model works.

---

# 63. Product North Star

Together should ultimately make this statement true:

> **If there is something useful a person needs to learn, build, create, or accomplish, there is a reasonable chance that Together can connect them with someone who can help.**

And equally:

> **If someone has knowledge, skills, resources, experience, or access they are willing to share, Together should make it easier for the people who need it to find them.**

The product succeeds when these two capabilities increasingly connect.

---

# 64. Final Product Philosophy

Together is not trying to eliminate people's needs.

It is trying to eliminate the unnecessary barriers between people and the people who can help them overcome those barriers.

The platform should make asking easier.

It should make contributing easier.

It should make useful needs easier to discover.

It should make trustworthy contributors easier to identify.

It should make dormant resources easier to put to productive use.

And it should create a culture where receiving help is not a position of weakness and giving help is not a transaction.

The fundamental relationship remains:

> **I can help you.**

> **You can help someone else.**

> **Together, we can all become more capable.**

# 65. Technical Implementation Plan

## 65.1 Approach and constraints

This section defines how the product described in Sections 1–64 gets built. It assumes:

- A small team shipping an MVP quickly, then iterating based on the Phase 1–4 roadmap in Section 61.
- A single relational source of truth, because almost every core object in this product (requests, offers, votes, lending agreements, reputation) is transactional and relationally connected — this is not a document-shaped or event-sourced-first problem.
- AI is a coordination layer that assists request quality, categorization, and matching (per Section 44 and the Vision document's "AI as a Coordination Layer"), not a decision-maker for trust, moderation outcomes, or account actions.
- Cost discipline appropriate for an early-stage Nigeria-first product: prefer usage-based and self-hostable infrastructure over commitments that assume scale the product hasn't earned yet.

## 65.2 Recommended stack

| Layer                            | Choice                                                                                                                                                                                                                                                   | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public/user web app              | **TanStack Start** (React, file-based routing, SSR + streaming)                                                                                                                                                                                          | Featured feeds, category pages, and request detail pages benefit from server rendering for fast first paint and shareability (Section 14, sharing requests). TanStack Start gives loader/action patterns similar to Remix with full type inference end-to-end, and the same React skills carry over to the admin app.                                                                                                                                                                                                                |
| Admin app                        | **React + Vite (SPA)**                                                                                                                                                                                                                                   | Admin has no SEO or public-sharing requirement (Section 50) and is authenticated-only, so a plain client-rendered SPA is simpler, cheaper to host (static bundle), and faster to iterate on than paying for SSR infrastructure it doesn't need.                                                                                                                                                                                                                                                                                      |
| API                              | **Bun + Elysia**                                                                                                                                                                                                                                         | Elysia's schema-first routing (TypeBox) gives runtime validation and compile-time types for free; combined with Bun's fast startup and native WebSocket/TCP support, one process can comfortably serve REST, SSE, and WebSocket (chat, live vote/response counts) without bolting on a separate realtime service for MVP scale. Elysia's Eden Treaty lets both the TanStack Start server and the Vite admin app call the API with full type inference, so a request/response shape change is caught at compile time in both clients. |
| Database                         | **PostgreSQL**                                                                                                                                                                                                                                           | The domain is relational (Section 55.x journeys touch requests → offers → contributions → outcomes → reputation as connected rows). Postgres also removes the need for several separate services early on: `tsvector`/`pg_trgm` cover MVP search (Section 12.3), `pgvector` covers embedding similarity for duplicate detection and semantic matching (Section 42, Section 44) without a dedicated vector database, and `LISTEN/NOTIFY` can drive lightweight realtime fan-out before Redis pub/sub is needed.                       |
| Cache / queue / realtime fan-out | **Redis**                                                                                                                                                                                                                                                | Rate limiting for anti-abuse (Section 53, Section 31), session/token storage, and pub/sub so WebSocket notifications and live counters work correctly once the API runs on more than one instance.                                                                                                                                                                                                                                                                                                                                   |
| Background jobs                  | **Bun worker process(es)**, jobs stored in a Postgres-backed queue (e.g. `pg-boss` or `graphile-worker`)                                                                                                                                                 | Matching recomputation, notification dispatch, embedding generation, and digest emails are all async and can tolerate a few seconds of latency. A Postgres-backed queue avoids introducing a second stateful system (Redis-backed queue) purely for jobs while the volume is still small; Redis remains available if throughput later demands a dedicated queue.                                                                                                                                                                     |
| Object storage                   | **S3-compatible storage** (e.g. Cloudflare R2 or Backblaze B2)                                                                                                                                                                                           | Profile photos and lending condition-record photos (Section 28, Step 5) are the only binary assets in the product. R2/B2-class storage avoids egress fees, which matters for an image-heavy, cost-sensitive product.                                                                                                                                                                                                                                                                                                                 |
| Auth                             | **better-auth** (or a hand-rolled JWT + refresh-token flow) on top of Elysia, plus email and phone/SMS OTP                                                                                                                                               | Together's accessibility principle (Section 5.5) means low-risk actions (browsing, asking for help) should require minimal friction, while higher-risk actions (lending high-value resources, Section 29) can require a verified phone number or ID check layered on top of the same auth session. Given the Nigeria-first audience, phone-number OTP (via a local aggregator such as Termii or Africa's Talking) is likely to convert better than email-only auth.                                                                  |
| LLM provider                     | **Claude API** (model chosen per task — a small/fast model for cheap, high-volume tasks like categorization; a larger model only where reasoning quality matters)                                                                                        | Used only for the assistive features enumerated in Section 44 — never for trust, moderation _decisions_, or reputation calculations, consistent with Section 5.4 and the Vision document's "AI as a Coordination Layer."                                                                                                                                                                                                                                                                                                             |
| Hosting                          | API + worker on a container platform with Bun support (Fly.io, Railway, or a VPS); web app wherever TanStack Start's Nitro-based output deploys cleanly (Vercel/Netlify/Node host); admin app as a static build behind a CDN, IP-restricted or SSO-gated | Keeps each surface independently deployable and scaled; the admin app in particular should not be reachable from the same public edge as the marketing/feed pages.                                                                                                                                                                                                                                                                                                                                                                   |

> A system architecture diagram (clients → API → data/services layers) is provided in the companion file **`together-wireframes.html`**.

### Is this a good stack? An honest assessment

- **TanStack Start** is the right call for the public/user-facing app. It gets you SSR for the feed/detail pages that need to be fast and shareable, without the heavier conventions of Next.js's app router. The main risk is ecosystem maturity — it's newer than Next.js/Remix, so expect to write a few things (e.g. some SSR edge cases, deployment adapters) yourself rather than finding a plug-in. For a small, technically strong team that's an acceptable trade for a simpler mental model.
- **Vite SPA for admin** is correct and arguably the more important simplification in this stack: admin tools rarely need SSR, and keeping it a plain SPA means one less deployment target to get SSR-right on.
- **Bun + Elysia** is a strong, modern choice for developer velocity and end-to-end type safety, and Bun's speed genuinely helps iteration loops and cold starts. The trade-off to go in with eyes open: Bun's ecosystem and some native-module compatibility are less battle-tested than Node's, so plan a short spike verifying that your specific dependencies (image processing, PDF/report generation if added later, any native SDKs) work cleanly on Bun before committing hard. If something doesn't, Elysia's design ports to Node without a rewrite of route logic.
- **Postgres** is unambiguously right for this domain, and it's worth resisting the temptation to add a search engine (Typesense/Meilisearch), a vector database, or a queue broker on day one — Postgres extensions cover all three adequately until real scale says otherwise. This keeps operational surface area small for a small team.
- **One gap in the original proposal:** a plan for realtime (chat in Section 19, live vote/response counts, notification delivery) and for background/async work (matching, notification fan-out, embedding generation) wasn't specified. Elysia's native WebSocket support plus a Postgres-backed job queue closes that gap without adding new infrastructure categories.

## 65.3 Monorepo layout

```
together/
├── apps/
│   ├── web/            # TanStack Start — public + authenticated user app
│   ├── admin/          # React + Vite — internal admin SPA
│   └── api/             # Bun + Elysia — HTTP, WebSocket, and worker entrypoints
├── packages/
│   ├── schemas/        # Shared TypeBox/Zod schemas — single source of truth for
│   │                    # request/response shapes, consumed by api, web, and admin
│   ├── db/              # Drizzle/Kysely schema + migrations, query helpers
│   └── config/          # Shared eslint/tsconfig/tailwind config
└── turbo.json / bunfig.toml
```

Bun workspaces (or Turborepo on top of them) keep the three apps and shared packages in one repo so a schema change in `packages/schemas` produces type errors in all three consumers immediately.

## 65.4 Core data model (entities, not full DDL)

| Entity                                                 | Purpose                                                                                                                | Notes                                                                                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `profiles`                                    | Account + public profile (Sections 7–8)                                                                                | Private contact fields live in a separate table/column set that is never serialized in public API responses (Section 47).                                            |
| `categories`, `skills`                                 | Evolving taxonomy (Sections 7.3, 51)                                                                                   | Soft-deletable (`retired_at`), never hard-deleted, so historical requests keep valid references (Section 51's "changes should avoid destroying historical records"). |
| `contributor_capabilities`                             | Join of user ↔ skill/category ↔ availability preferences                                                               | Drives matching (Section 15).                                                                                                                                        |
| `requests`                                             | The core object; goal/barrier/help-needed text, category, optional structured fields, `state` enum matching Section 11 | `search_vector` (`tsvector`) and `embedding` (`vector`) generated columns for search and semantic matching/duplicate detection.                                      |
| `request_responses` (offers)                           | A contributor's "I can help" response (Section 17)                                                                     | Independent of full commitment — supports Section 18's multiple/partial offers.                                                                                      |
| `contributions`                                        | An accepted, in-progress-or-completed unit of help                                                                     | Links a request, one or more responses, and completion/outcome data (Sections 20–22).                                                                                |
| `outcome_confirmations`                                | Recipient's "did this help you move forward?" answer (Section 21)                                                      | Structured enum + optional free text.                                                                                                                                |
| `votes`                                                | Upvotes on requests (Section 13)                                                                                       | Unique constraint on `(user_id, request_id)`; rate-limited at the API layer.                                                                                         |
| `resources`, `lending_agreements`, `condition_records` | Physical resource lending (Sections 27–30)                                                                             | `condition_records` reference object-storage photo keys, not raw files.                                                                                              |
| `reports`, `moderation_actions`, `audit_log`           | Trust & safety (Sections 34–36, 49–50)                                                                                 | `audit_log` is append-only and covers every admin action, per Section 50's "administrative actions should be auditable."                                             |
| `badges`, `user_badges`                                | Recognition (Section 25)                                                                                               | Never affects ranking or access.                                                                                                                                     |
| `notifications`, `notification_preferences`            | Section 16, 37                                                                                                         | Preferences gate both in-app and off-platform (email/SMS/push) delivery.                                                                                             |
| `request_matches`                                      | Precomputed request↔contributor relevance scores                                                                       | Recomputed by the worker on publish/edit; read at notification-dispatch and "recommended for you" time rather than computed live.                                    |

## 65.5 Matching algorithm

**Phase 1 (MVP) — deterministic, explainable scoring.** On publish or edit, the worker computes a candidate set (contributors whose `contributor_capabilities` intersect the request's category/skills) and scores each candidate as a weighted sum of:

1. **Capability match** — exact skill/category overlap (highest weight).
2. **Modality fit** — remote/in-person/either compatibility (Section 46).
3. **Location proximity**, only when the request requires it.
4. **Availability & notification preferences** — never notify a user outside their stated preferences (Section 16).
5. **Reliability** — a function of completed contributions and confirmed-helpful outcomes, not popularity (Section 5.4, 23).
6. **Recency/fatigue dampening** — an exponential penalty based on how recently/often a given contributor was already notified, so the same top contributors aren't always the ones paged (fairness, and a direct mitigation for "attention only flows to the most visible contributors").
7. **Request quality** — better-formed requests (Section 10) are easier to act on and are weighted slightly higher, which also gives requesters a concrete incentive to use the guided request builder.

This produces a ranked list stored in `request_matches`; the notification dispatcher reads from it and respects per-user frequency caps. Because it's a transparent weighted sum, "why was I matched" (Section 44) can be explained with the actual contributing factors rather than a black-box output.

**Phase 2 — embedding-assisted matching, layered on top, not replacing Phase 1.** Generate an embedding for each request's free text and for each contributor's bio/capability text, store them in `pgvector` columns, and blend cosine similarity into the Phase-1 score. This catches semantically relevant matches that miss on exact taxonomy (e.g. a request mentioning "soldering" matching a contributor who listed "electronics repair" but not "soldering" specifically). The same embeddings power duplicate/related-request detection (Section 42) and a "similar requests" module (see the Request Detail wireframe below).

## 65.6 AI-assisted features → implementation mapping

| Section 44 capability                                                   | Implementation                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Improving vague requests, clarifying questions                          | Best-effort LLM call at draft time in the request builder; streamed as inline suggestions (see wireframe below); never blocks publishing if the call fails or is slow.                                                                                                                                                                                                       |
| Categorizing requests                                                   | LLM suggests a category/skills the user confirms or overrides — the user is always the final decision-maker, consistent with "the user should remain in control" (Section 15).                                                                                                                                                                                               |
| Finding related/duplicate requests                                      | `pgvector` cosine similarity, with an LLM used only to double-check borderline matches before surfacing them, to reduce false "this looks like a duplicate" prompts.                                                                                                                                                                                                         |
| Explaining why a contributor is a potential match                       | Templated from the actual Phase-1 scoring factors (not LLM-generated), so the explanation is always true, cheap, and instant.                                                                                                                                                                                                                                                |
| Summarizing long requests, contributor-side "how could I help" guidance | Small/fast LLM calls, cached per request since the underlying text rarely changes after publish.                                                                                                                                                                                                                                                                             |
| Moderation assist                                                       | LLM-based classifier flags likely spam, fundraising language (a Non-Goal, Section 4), or policy violations into the human review queue (Section 34–35) — it never auto-suspends or auto-removes; every enforcement action stays a human decision recorded in `audit_log`, matching Section 50 and the "accountability over public shaming" principle in the Vision document. |

## 65.7 Realtime and notifications

- **In-app**: Elysia's native WebSocket support handles chat (Section 19), live vote/response counters, and notification badges. Redis pub/sub fans messages out once the API runs on more than one instance.
- **Off-platform**: email for transactional and digest notifications; SMS/WhatsApp via a Nigeria-capable aggregator (e.g. Termii or Africa's Talking) for time-sensitive matches, given that push notification reach is inconsistent across the target user base; web push as a lower-priority channel.
- All dispatch respects the per-category, per-channel, per-frequency preferences described in Section 16 and 37 — the worker checks `notification_preferences` before sending anything, and every send is logged so a user's "why did I get this" question is always answerable.

## 65.8 Security, privacy, and anti-abuse

- Private contact fields, exact addresses, and unverified-identity data are excluded from public API response schemas at the schema level (in `packages/schemas`), not filtered ad hoc per endpoint — this makes "never expose X publicly" (Section 8.3, 47) a compile-time property rather than a code-review hope.
- Redis-backed rate limiting on request creation, voting, reporting, and messaging (Section 53, 31).
- Every admin action writes to an append-only `audit_log` row (Section 50).
- Uploaded photos pass through a basic automated content check before being shown publicly; anything flagged goes to the moderation queue rather than being auto-published or auto-rejected.
- Nigeria Data Protection Act (NDPA) alignment for data export/erasure requests, in addition to general good practice (data minimization per Section 47).

## 65.9 Observability and operations

Structured logging (pino) from the API and worker, error tracking (Sentry), and OpenTelemetry metrics feeding a dashboard that tracks the Section 54 success metrics (successful contributions, match rate, time-to-first-response) as first-class operational metrics, not just product analytics — if the matching/notification pipeline breaks, that should show up as an ops alert, not just a slow week in a product review.

---

# 66. Low-Fidelity Wireframes

Low-fidelity wireframes for the core web-application screens (Home/Discovery Feed, Create Request wizard, Request Detail, Contributor Profile) and the Admin Dashboard, plus the system architecture diagram, are maintained separately in **`together-wireframes.html`** so they can be updated, viewed, and printed independently of this document. They illustrate structure and information hierarchy only — spacing, copy, and visual design are intentionally left unresolved — and map directly to the workflows defined in Sections 9–23 and 50.

---

# 67. Sequencing Recommendation

If the team wants a build order that matches the Phase 1–4 roadmap in Section 61:

1. **Weeks 1–2**: Postgres schema for users/profiles/categories/requests/responses; Elysia API skeleton with auth; TanStack Start shell with registration, onboarding, and profile creation (Sections 7–8).
2. **Weeks 3–5**: Request creation wizard with guidance (Sections 9–10), request states (Section 11), featured/category feeds and search (Section 12), voting (Section 13). This is the first fully demoable slice.
3. **Weeks 6–8**: Phase-1 matching, contributor notifications, responding to requests, communication channel, completion and outcome confirmation, basic reputation (Sections 15–23) — this closes the full "Ask → Match → Help → Confirm" loop from Section 62, which is the most important thing to validate before building anything else.
4. **Weeks 9–10**: Reporting, blocking, basic admin (reports queue, account actions, category management) — the admin app becomes real here, not before, since there's nothing to moderate yet.
5. **Later, gated on demand seen in the data**: resource lending workflow (Sections 27–30), embedding-assisted matching and duplicate detection, LLM-assisted request guidance and moderation triage.

Building AI-assisted matching or LLM request guidance before the deterministic version of the same loop exists and works would be solving a problem the team doesn't yet have data on.
