# Together.ng — Product Requirements & Implementation Plan

**Document type:** Product Requirements Document (PRD) / Functional Implementation Plan  
**Product:** Together  
**Working domain:** together.ng  
**Status:** Detailed product specification  
**Scope:** Product behavior, workflows, business rules, functional requirements, acceptance criteria, technical architecture, technology stack, matching algorithm, and AI implementation approach  
**Revision note:** This revision adds shareable cards/social metadata requirements and the corresponding technical implementation guidance in Section 65.10. Sections 1–64 remain the product specification and are unchanged in substance.  
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

## 8.4 Public contribution and request history

A public profile should show meaningful history that helps people make informed decisions.

A profile may display:

- Together member since date
- Number of requests made
- Number of requests completed / cancelled
- Number of contributions made
- Number of contributions received
- Public request history (titles and broad categories, not private details)
- Public contribution history (what was contributed, whether it was completed)

This history is factual and descriptive, not a popularity score. It answers:

> "Has this person participated meaningfully in Together?"

It does not answer:

> "How popular is this person?"

The goal is to provide enough history for people to make their own informed decisions, following the eBay principle of visible history of actual interactions without creating a reputation marketplace.

## 8.5 Request anonymity preference

A request can indicate whether anonymous contributions are acceptable:

- **Anonymous contributions acceptable** — the contributor does not need to disclose their identity. The contributor can choose to help using their Together profile or anonymously.
- **Contributor identity matters** — the requester wants to know who is providing help because the contributor's background, experience, or qualifications may be relevant.

This is a request-level setting, not a user-level preference. The requester decides what disclosure is needed for each request.

## 8.6 Contributor identity disclosure

When making an offer, a contributor can choose how to appear:

- **Using my Together profile** — the requester sees the contributor's public Together profile.
- **Anonymously** — the requester does not see the contributor's identity beyond a Together pseudonym.

If the requester has indicated that contributor identity matters, the contributor can still choose their disclosure level, but the requester may decline offers from anonymous contributors if knowing the contributor's background is important to them.

Together should not present a contributor as "verified" unless Together has actually performed the relevant verification. Basic email/phone verification is for account security, not a public trust signal.

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

Every public, shareable request should have a dedicated shareable URL and a compelling, dynamically generated social preview card.

The shareable card is not merely an SEO artifact. It is a portable representation of the request that should make the need understandable when it appears outside Together.

A card should generally communicate:

- What the person is trying to accomplish
- The type of help needed
- Relevant category or context
- Location when relevant and safe to expose
- Together branding
- A clear visual indication that this is a request for productive help

Cards should use concise text and should not attempt to reproduce the complete request.

Sharing should work through:

- Native browser/device sharing where available
- Copying the canonical request URL
- Platform link previews using the request's social metadata
- A future option to share/download the card as an image where useful

The card and metadata must respect the request's visibility, moderation, and privacy settings. Exact residential addresses, private contact information, sensitive identity information, verification information, and other private request details must never be exposed through a public card.

Shareable cards should be generated from real request data rather than manually authored images.

Sharing is another discovery mechanism.

A person who cannot help may know someone who can.

The intended discovery loop is:

> **See a need → Share it → Someone else discovers it → Someone contributes**

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

The offer should feel almost as lightweight as sending a message. The contributor can say something like:

> "I have a spare ThinkPad you can borrow."

or

> "I don't have a computer, but I can give you access to our community lab."

or

> "I can mentor you instead."

The contributor should not have to commit to the entire request. They may offer a narrower form of assistance.

The request can optionally indicate whether anonymous contributions are acceptable (Section 8.5). If anonymous contributions are acceptable, the contributor can choose to offer help using their Together profile or anonymously.

The offer is stored as a `contribution_offers` record with state `pending`. The requester can accept or decline.

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

When an offer is accepted, a `contributions` record is created linking the request, offer, contributor, and recipient.

The contribution has a simple lifecycle:

1. **Active** — the contribution is in progress or the parties are coordinating.
2. **Completed** — the help was delivered.
3. **Cancelled** — either party cancelled before completion.

Either participant can mark the contribution as completed or cancelled.

A completed contribution should record enough information to establish that the interaction occurred without unnecessarily exposing private conversation details.

The contribution also records a generic **fulfillment method** indicating how help was delivered (e.g. mentoring, resource lending, digital delivery, introduction, off-platform coordination). This is a simple enum, not a provider-specific workflow — Together does not need to know the details of how external resources are provided.

---

# 21. Outcome Confirmation

After a contribution is completed, both parties provide lightweight confirmation.

## 21.1 Recipient confirmation

The recipient is asked:

> **Did you receive the help?**

- Yes
- No

If yes:

> **Did this contribution help you make progress toward your goal?**

- Yes
- Partially
- Not yet

## 21.2 Contributor confirmation

The contributor is asked:

> **Was the contribution completed as agreed?**

- Yes
- No

These confirmations are the foundation for public contribution history (Section 8.4). They are evidence for future trust, but they do not automatically trigger disputes or require Together staff to determine who was right.

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

Depending on resource value and risk, Together may use lightweight account checks or require an established history of successful participation. Stronger identity checks should be reserved for genuinely high-risk or high-value cases because they create operational overhead.

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

If an item is returned damaged, lost, or not returned, the affected participant can report the issue and provide relevant information. Together should preserve the available records and may restrict an account where there is a clear platform-safety reason.

The MVP should not assume that Together has the operational capacity to arbitrate ordinary disputes. Participants should therefore agree on practical terms before a high-risk lending interaction, and Together should make the relevant history available to inform their decisions.

Serious or clearly abusive behavior can result in suspension or permanent removal, with legal escalation only where appropriate and necessary.

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
- Public requests have canonical shareable URLs.
- Public requests expose appropriate social preview metadata.
- Public requests have a generated 1200×630 shareable card.
- Share cards contain only information permitted by the request's visibility and privacy settings.
- A card can be regenerated when share-relevant request content changes.
- Closed, removed, or restricted requests do not continue exposing private or inappropriate card content.

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

### Shareable card tests

Verify:

- A published public request has a stable canonical share URL.
- The canonical URL exposes the correct page metadata.
- The social preview uses the generated request card.
- The card renders correctly at the required dimensions.
- Long request titles and other variable text are truncated or wrapped safely.
- Missing optional fields do not break rendering.
- Special characters and non-ASCII names/text render correctly.
- Private fields are never included in the card.
- A request that becomes restricted or moderated no longer exposes inappropriate card content.
- Relevant request edits trigger card regeneration.
- Unchanged requests do not cause unnecessary card regeneration.
- Card URLs are cacheable and return the correct image.
- Card generation failures do not prevent the request itself from being published or viewed.
- A missing card can be regenerated without creating duplicate request records.

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
- Serious issues can be reported.
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
- Complex disputes / arbitration

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
- Lightweight account verification where justified
- Basic issue-reporting; formal dispute/arbitration workflows are deferred
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
| `users`, `profiles`                                    | Account + public profile (Sections 7–8)                                                                                | Private contact fields live in a separate table/column set that is never serialized in public API responses (Section 47). Includes `anonymous_contributions_ok` boolean on requests (Section 8.5). |
| `categories`, `skills`                                 | Evolving taxonomy (Sections 7.3, 51)                                                                                   | Soft-deletable (`retired_at`), never hard-deleted, so historical requests keep valid references (Section 51's "changes should avoid destroying historical records"). |
| `contributor_capabilities`                             | Join of user ↔ skill/category ↔ availability preferences                                                               | Drives matching (Section 15).                                                                                                                                        |
| `requests`                                             | The core object; goal/barrier/help-needed text, category, optional structured fields, `state` enum matching Section 11, `anonymous_contributions_ok` flag | `search_vector` (`tsvector`) and `embedding` (`vector`) generated columns for search and semantic matching/duplicate detection.                                      |
| `contribution_offers`                                  | A lightweight "I can help" offer from a contributor (Section 17.1)                                                     | Links to a request and a user. Contains a short message describing what the contributor can provide. State: `pending → accepted | declined | cancelled`. |
| `contributions`                                        | An accepted, in-progress-or-completed unit of help (Section 20)                                                       | Created when an offer is accepted. Links to the offer, request, contributor, and recipient. State: `active → completed | cancelled`. Records fulfillment method (generic enum). |
| `outcome_confirmations`                                | Lightweight reciprocal confirmation (Section 21.1)                                                                     | Both contributor and recipient confirm: recipient says "received? yes/no" and "helped? yes/partially/not yet"; contributor says "completed as agreed? yes/no". Structured enum + optional free text. |
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

## 65.10 Shareable cards and social metadata

Shareability is a first-class product capability because external sharing is part of Together's discovery and contribution loop. Public requests should produce a useful representation when shared through messaging apps, social networks, search results, or copied links.

### 65.10.1 Canonical shareable URLs

Every public request should have a canonical, human-readable URL.

The URL should resolve to the normal Together request page and should be suitable for:

- Browser navigation
- Copy/paste
- Native device sharing
- Social-network link previews
- Search indexing where the request is eligible
- Future QR-code or offline sharing experiences

The canonical URL should not contain private identifiers or information that should not be public.

The same pattern should be extensible to other public Together entities such as:

- Contributor profiles
- Public resource listings
- Categories
- Community knowledge pages

### 65.10.2 Open Graph and social metadata

Public shareable pages should provide server-rendered metadata including, where applicable:

- `og:title`
- `og:description`
- `og:type`
- `og:url`
- `og:image`
- `og:image:width`
- `og:image:height`
- `og:image:alt`
- Appropriate `twitter:card` metadata for large image previews

The default social-card image should be **1200×630 pixels**, which is the interoperability target for mainstream link-preview surfaces.

Metadata must be generated from the same source of truth as the request page so that the title, description, visibility state, and card do not drift apart.

### 65.10.3 Dynamic card generation

Together should generate social cards from structured data rather than maintaining manually designed images for individual requests.

The initial architecture should use a reusable card template system:

**PostgreSQL request data**
→ **publish/update event**
→ **background job**
→ **card renderer**
→ **image stored in Cloudflare R2**
→ **public `og:image` URL**

A request should normally have its card generated asynchronously when it becomes public.

Card generation should not be on the critical path for publishing a request unless a future product requirement demonstrates that synchronous generation is necessary.

The renderer should be deterministic: the same request data, template version, and rendering configuration should produce the same visual output.

### 65.10.4 Card templates

The first card template should focus on requests/needs.

A request card should have a consistent visual hierarchy containing some combination of:

1. Together branding.
2. A concise request title.
3. A short contextual description or goal.
4. Category/type of help.
5. Location only where relevant and safe.
6. A small status/context indicator where useful.
7. Together URL or recognizable product identity.

The design should communicate dignity and usefulness rather than charity, pity, urgency theater, or clickbait.

Cards should not attempt to display every request field.

The card renderer should have explicit rules for:

- Maximum title length
- Description truncation
- Text wrapping
- Missing fields
- Long words/URLs
- Special characters
- Unicode
- Unexpected user-generated content
- Status changes
- Template versioning

### 65.10.5 Privacy and visibility

The card renderer must operate on the request's effective public representation rather than the full private request object.

Never render into a public card:

- Exact residential addresses
- Private phone numbers
- Private email addresses
- Sensitive identity information
- Verification documents or their contents
- Private conversation content
- Internal moderation information
- Internal trust/safety information
- Any field marked private or restricted by product rules

If a request changes from public to restricted, its previously generated card must not remain the authoritative current card.

For content that is deleted, removed, or permanently restricted, the application should replace the card with an appropriate generic/removed representation or stop serving it, according to the content lifecycle policy.

### 65.10.6 Card storage

Generated cards should be stored in Cloudflare R2 rather than regenerated on every social crawler request.

Suggested object structure:

- `social/requests/{request_id}/{version}.png`
- `social/profiles/{profile_id}/{version}.png`
- `social/resources/{resource_id}/{version}.png`

The exact object naming convention may change, but generated objects should be addressable independently and should not require the application database to serve image bytes.

Public social-card objects need to be fetchable by external crawlers. Private or user-only media must not be made public merely to support sharing.

### 65.10.7 Versioning and cache invalidation

Social crawlers can cache images for long periods. Therefore, replacing the contents of a single permanent image URL is not sufficient to guarantee that external platforms will immediately see an updated card.

When share-relevant content changes, Together should generate a new card version and update the page's `og:image` URL.

A practical pattern is:

`/social/requests/{request_id}/{version}.png`

The version can be based on a monotonically increasing representation version or a content/template hash.

Card regeneration should occur only when share-relevant information changes, such as:

- Request title
- Public description/goal
- Category
- Public location
- Public status where displayed
- Card template
- Brand assets
- Other fields explicitly included in the card

Changes to private or unrelated fields should not trigger regeneration.

### 65.10.8 Rendering implementation

The renderer should be isolated behind a small application interface so that the rendering technology can change without changing the request domain model.

A React/HTML-like template rendered through a deterministic SVG/image pipeline is a suitable implementation direction. Satori plus an SVG-to-image renderer is one candidate approach, but the implementation should be validated against the selected Bun runtime and deployment environment before being treated as a hard dependency.

Fonts and other rendering assets should be bundled or otherwise made reliably available to the renderer. The renderer should not depend on fetching arbitrary remote fonts or assets at render time.

The renderer should support broad Unicode text so user-generated names and request content do not produce broken glyphs.

### 65.10.9 Background jobs and failure handling

Card generation should run through the existing background-job infrastructure.

A card-generation job should include enough information to identify:

- Entity type
- Entity ID
- Representation version
- Template version
- Required output format

Jobs should be idempotent.

If generation fails:

- The request should remain usable.
- The failure should be observable.
- The job should be retryable.
- Repeated failures should not create an uncontrolled queue.
- A generic fallback card may be used where appropriate.

The system should record the current card-generation status so administrators and operations tooling can distinguish:

- Not generated
- Queued
- Generating
- Generated
- Failed
- Superseded

### 65.10.10 Share action

The request detail page should expose a clear **Share** action.

The first implementation should support:

1. Native Web Share API where available.
2. Copy canonical URL as a fallback.
3. Link previews through the page's social metadata.

A future enhancement may allow the user to download or directly share the generated card image, particularly for platforms where ordinary link previews are less reliable.

### 65.10.11 Extensibility

The card system should not be designed solely around requests.

It should eventually support reusable templates for:

- Requests / needs
- Contributor profiles
- Public resource listings
- Categories
- Community knowledge pages
- Other public Together entities

The renderer should therefore have a small template registry rather than hard-coding a single request-specific image implementation.

### 65.10.12 Operational requirements

Track at least:

- Card generation success/failure rate
- Generation latency
- Queue depth
- Retry count
- Cards generated per entity type
- Storage usage
- Missing-card rate for public entities
- Percentage of shareable pages with valid metadata

Social-card generation should be treated as product infrastructure: if public requests are shareable but their previews are broken, the discovery loop is degraded.

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

---

# Addendum A — Further Discussion: Accounts, Trust, Contributions, and Coordination

> **Status: Partially promoted to MVP, partially grooming backlog**
>
> This addendum captures product and architectural ideas discussed after the main PRD was written. Several concepts have been promoted into the main PRD (Sections 8.4–8.6, 17.1, 20, 21.1–21.2, and the data model in 65.4). The remaining sections are grooming backlog — they should not be treated as MVP implementation requirements unless explicitly promoted.

## A.1 Account and authorization model — Promoted (simplified)

The simplified account model for MVP includes: human accounts, Active/Suspended/Banned status, and basic roles/permissions. The full verification/trust-level hierarchy and fine-grained permission system described here are post-MVP.

Together should avoid modelling all possible user states as a single `user_type` or enum such as `USER | ADMIN | BANNED | AI_AGENT`. These are different dimensions of an account and should remain independently modelled.

The proposed conceptual dimensions are:

### Account type

- Human user

AI agents are not a separate account type at this stage.

### Account status

- Active
- Suspended
- Banned
- Other restricted states as needed

A banned or suspended account remains the same underlying account. `banned` and `suspended` should be account-status states, not roles.

### Verification / trust level

Potential levels include:

- Unverified
- Email verified
- Phone verified
- Identity verified
- Trusted / established contributor

Verification should be independent from public identity disclosure. A person may be identity-verified by Together while choosing to appear anonymously to another participant.

### Roles

Potential roles include:

- Member
- Moderator
- Admin
- Super Admin
- Future specialised administrative roles

Roles should grant permissions, while account status and other policies can restrict whether a permission may actually be exercised.

### Permissions

Authorization should eventually be expressed in terms of fine-grained actions rather than only roles. Examples:

- Create request
- Respond to request
- Offer contribution
- Accept contribution
- Complete contribution
- Vote for request
- Report request
- Moderate request
- Manage users
- Manage verification
- Manage disputes
- Manage categories
- Manage system configuration

The implementation should leave room for policy checks in addition to RBAC. For example, permission to lend a high-value physical resource may require an active account, an appropriate role, identity verification, and sufficient contribution history.

### AI agents and account access

AI agents are not considered a separate account type for Together at this stage. A person who wants to use an AI agent can give the agent access to their existing Together account, subject to the account's normal permissions and security controls.

If an AI agent uses an account to violate Together's rules, the account remains accountable for those actions and can be temporarily suspended or permanently banned.

Agent-specific account types, permissions, or trust models should only be introduced later if real product usage demonstrates a need for them.

## A.2 Contribution as a first-class domain object — Promoted

The contribution-as-first-class-object concept is promoted to MVP. See Sections 20, 21, and the data model (65.4) for the simplified lifecycle: Offer → Accepted → Completed/Cancelled.

The discussion suggests that the central unit of trust and coordination should be the **Contribution**, rather than simply a request response or message.

The broader lifecycle is:

**Need → Contribution → Coordination → Fulfillment → Outcome → Contribution History**

A conceptual contribution lifecycle could include:

- Proposed
- Accepted
- Coordinating
- Fulfillment pending
- Fulfilled
- Recipient confirmed
- Disputed
- Cancelled
- Expired

A contribution should link the original request, contributor, recipient, coordination method, fulfillment method, relevant events, and outcome.

This provides a common abstraction across very different forms of help:

- Digital resources
- Physical resources
- Mentorship
- Knowledge
- Professional assistance
- Introductions / access
- Software testing or technical assistance
- Other forms of productive help

The actual mechanism by which help is delivered should be represented separately from the contribution itself.

## A.3 Coordination should not require disclosure of personal contact details — Promoted (minimal)

Minimal coordination is promoted to MVP: simple Together messaging/contact exchange. The contribution workspace/data room concept is post-MVP.

A contributor should be able to offer help without immediately giving the recipient their phone number, email address, or other personal contact information.

After a contribution is initiated, Together should provide several possible coordination modes.

### Direct / off-platform coordination

The parties may mutually choose to exchange contact information and continue through channels such as:

- Phone
- WhatsApp
- Email
- X / Twitter
- LinkedIn
- Other mutually preferred channels

Together does not need to mediate every interaction. The initial platform should provide lightweight coordination and communication tools while leaving the actual contribution to the participants. Detailed mediation, arbitration, or operational intervention should remain minimal and can be introduced later if the network demonstrates a clear need.

### Together chat

A private conversation associated with the contribution could allow both parties to coordinate without exposing personal contact information.

The chat should be scoped to the contribution rather than turning Together into a general-purpose social network by default.

### Contribution workspace / data room

For more complex contributions, a private contribution workspace may be more useful than chat alone. It could contain:

- Conversation
- Files and attachments
- Requirements
- Instructions
- Relevant account/access information
- Tasks or handoff steps
- Contribution activity/history
- Agreements or acknowledgements
- Fulfillment information

The data room should be visible only to the participants. Together may retain appropriate platform records for security, abuse prevention, and account enforcement, but the initial product should not assume that staff will routinely participate in or mediate contributions.

Chat can be one component of a broader contribution workspace rather than the entire coordination primitive.

## A.4 Identity disclosure and anonymity preferences — Promoted (simplified)

The simplified identity disclosure model is promoted to MVP. See Sections 8.5 and 8.6: requesters indicate whether anonymous contributions are acceptable; contributors choose disclosure level.

Identity verification, identity disclosure, and contact disclosure should be treated as separate concepts.

A contributor may be verified by Together without revealing their real identity to the recipient. A contributor may also choose to communicate only through Together.

### Requester preference

A request should allow the requester to indicate whether an anonymous contribution is acceptable.

The purpose is not to let a requester prefer anonymity. Rather, it tells potential contributors whether they need to disclose their identity in order for the contribution to be useful.

For example:

- **Anonymous contribution is acceptable** — the requester is comfortable receiving the contribution without knowing who provided it. This may work well for things such as digital resources, tokens, access, books, or other contributions where the contributor's background is not important.
- **Contributor identity matters** — the requester wants to know who is providing the help because their background, experience, qualifications, or credibility may be relevant to the contribution. For example, someone asking for a tutorial or mentorship may want to understand the contributor's relevant experience.

The requester should make the contribution as easy as possible for the contributor to provide, including providing relevant instructions, links, requirements, or acceptable ways to fulfil the request where useful.

Together does not initially need to verify identities for ordinary contributions. Basic account verification such as email or phone verification may be used as a platform account requirement, while stronger identity checks can be introduced for higher-value or higher-risk requests when operational capacity allows.

Identity disclosure, verification, and contact information remain separate concepts:

- **Identity disclosure** — what the contributor chooses to reveal to the requester.
- **Verification** — what Together has independently established about the account, if anything.
- **Contact** — whether and how the parties communicate outside Together.

A contributor may therefore remain anonymous to the requester while still operating through an accountable Together account.

### Contributor preference

A contributor may independently choose how much identity information to disclose for a particular contribution, subject to basic platform safety requirements.

Possible levels may include:

- Anonymous to the requester
- Together profile
- Direct identity disclosure

The contributor's choice should be compatible with the requester's stated preference. If anonymous contribution is acceptable, the contributor does not need to disclose their identity merely to make the contribution. If the requester considers the contributor's identity or background important, the contributor can decide whether to provide enough information for the requester to make an informed decision.

Together should not present a contributor as "verified" unless Together has actually performed the relevant verification.

## A.5 Request history and trust signals — Promoted

Public request and contribution history is promoted to MVP. See Section 8.4: factual history (requests made, contributions completed, member since) rather than a popularity score.

Before a person accepts a contribution involving a resource, the potential contributor should have access to meaningful, public trust information about the requester.

The goal is not to produce a single universal reputation score. The goal is to provide enough history for people to make their own informed decisions.

A public requester profile or request trust panel may eventually show:

- Account age / member since
- Number of previous requests
- Number of successfully fulfilled requests
- Number of expired or cancelled requests
- Number of contributions received
- Number of contributions made
- Successful contribution history
- Unresolved contributions or disputes
- Relevant verification status
- Relevant badges or trust signals
- Previous requests in the same resource/category where useful
- Patterns of repeated or highly similar requests where appropriate

The presentation should emphasise factual history rather than a popularity score.

### Public versus private history

The following may be appropriate for public trust information:

- Request titles and broad categories
- Request status and outcome
- Contribution counts
- Successful / unsuccessful outcome counts
- Relevant verification status
- Relevant public contribution history
- Public warnings or restrictions where policy requires them

The following should remain private unless there is a specific legitimate reason to disclose them:

- Phone numbers
- Email addresses
- Exact residential addresses
- Private conversations
- Identity documents
- Sensitive verification information
- Private coordination information
- Other sensitive personal details

The exact public-history policy requires further privacy and safety grooming.

## A.6 Similar-request and abuse signals — Post-MVP (grooming backlog)

Instrument the data now; build detection and warnings later.

Together should eventually detect and surface suspicious patterns without assuming that repetition automatically means fraud.

Examples include:

- Multiple highly similar requests for the same resource
- A request for a resource shortly after receiving the same or similar resource
- Repeated requests that expire without meaningful progress
- Unusual contribution or fulfillment patterns
- Requests that appear inconsistent with previous stated outcomes

A potential UI pattern is an informational warning such as:

> **Similar previous request**
>
> This member previously received help with a similar request.

The system should generally surface relevant evidence rather than automatically accusing the requester of fraud. Automated restrictions can be considered later based on stronger evidence and established policy.

## A.7 Resource lifecycle and fulfilment — Promoted (generic concept)

Generic fulfillment method is promoted to MVP: record how help will happen as a simple enum (mentoring, resource lending, digital delivery, etc.), but do not implement provider-specific workflows. See Section 20.

Together should not assume that every contribution is a simple transfer of an object from one person to another.

A contribution should specify a **fulfillment method** appropriate to the resource or help being provided.

Potential methods include:

- External gift / redemption link
- Direct purchase by contributor
- Digital resource delivery
- Account or access provisioning
- Physical handoff
- Loan and return
- Mentorship session
- Professional service / assistance
- Introduction or connection
- Other

The platform should coordinate the contribution without pretending to control an external resource it cannot actually transfer.

For example, if a third-party provider offers a gift or redemption mechanism for a digital service, the requester should provide whatever information or instructions make it straightforward for the contributor to complete the contribution. The contributor can then use the provider's normal process to fulfil it. Together does not need to operate or mediate the provider-specific process, and should never require the contributor to provide third-party account credentials.

## A.7.1 Operating principle: facilitate, do not mediate

Together's initial operational model should be intentionally lightweight:

> **Make it easy for the right people to connect and help each other; do not make Together responsible for every detail of the exchange.**

The requester should do as much as reasonably possible to make their request easy to fulfil. Contributors should be able to choose whether to coordinate through Together or move the interaction to another channel by mutual agreement.

Together should provide enough structure to create useful history and basic safety controls, but should not require staff involvement for normal contributions. Mediation, arbitration, insurance, provider-specific fulfillment support, and other operationally intensive services should be introduced only if real usage demonstrates a need and Together has the capacity to support them.

## A.8 Example: contribution of AI service access — Not promoted

Keep as an example, not product functionality.

Consider a request such as:

> **I need GPT-6 Astra access to test an application I'm building for free legal education.**

The request may specify:

- What access is needed
- Why it is needed
- Expected duration or amount
- Intended productive use
- Expected outcome
- Acceptable fulfillment methods
- Contributor identity preference

A contributor could then follow a flow such as:

1. Discover the request.
2. Review the requester's public contribution/request history and relevant trust signals.
3. Select **I can help**.
4. Agree with the requester on how the help can be provided.
5. Coordinate through Together or mutually exchange external contact details if useful.
6. Complete the actual contribution using the agreed method.
7. Recipient can confirm receipt and, where appropriate, whether the contribution enabled progress.
8. The contribution can be recorded in the participants' contribution histories.

The exact mechanics depend on what the external provider supports at the time. Together should therefore model this as an **external resource fulfilment** rather than as a provider-specific transfer system.

## A.9 Secure handling of external access information — Post-MVP (minimal)

Don't build sophisticated secure data rooms yet; avoid credentials in chat.

Where a contribution requires a sensitive link, access code, account identifier, or other information that could itself transfer control of a resource, the information should not be placed in a public request or ordinary public comment.

Potential mechanisms include:

- Private contribution chat
- Encrypted contribution workspace/data room
- One-time or restricted-access handoff
- Explicit recipient acknowledgement
- Access to sensitive information limited to the participants and authorised staff

The specific security model should be separately groomed before implementation.

## A.10 Learning from peer-to-peer marketplaces — Promoted (principles only)

The eBay/Facebook Marketplace lessons are promoted as design principles (low-friction coordination + visible history of actual interactions), not as marketplace machinery to build.

Together is not an e-commerce marketplace, but established peer-to-peer marketplaces provide useful patterns for trust, discovery, and low-friction coordination. Two particularly useful reference models are **eBay** and **Facebook Marketplace**, although Together should adapt rather than copy either model.

### eBay — memory and transaction context

Useful patterns to study include:

- Contribution/transaction history
- Feedback tied to completed interactions
- Structured outcome confirmation
- Evidence and activity records
- Clear state transitions
- Protection against repeated abuse
- Account restrictions
- Separation of public trust signals from private information

The important lesson for Together is that trust can come from **visible history of actual interactions**, rather than from a single opaque reputation score.

### Facebook Marketplace — low-friction peer coordination

Marketplace is useful as a reference for the opposite side of the problem: the platform does not need to orchestrate every detail of a peer-to-peer exchange for people to use it.

Patterns worth adopting include:

- Simple listings/requests that lead naturally to direct conversations
- A lightweight **I can help / contact** interaction rather than a heavy transaction workflow
- Clear local-versus-remote context where it matters
- Enough profile and listing context for people to make their own decisions
- The ability for participants to arrange the actual exchange themselves
- Low friction between discovery and communication

Together should preserve this looseness while adding better memory around productive contributions.

### Together's adaptation

Together should combine:

> **Marketplace's low-friction coordination + eBay's useful historical memory**

The analogue to an e-commerce transaction is a **contribution**, but not every contribution needs to become a formal transaction. A contribution may simply be an offer of help followed by a conversation and an outcome.

Together should therefore avoid:

- Mandatory platform-mediated fulfillment
- Mandatory arbitration for ordinary disagreements
- Heavy transaction workflows for simple contributions
- Monetary transaction mechanics
- Star-rating or popularity competitions

The product should provide just enough structure to make contributions discoverable, make coordination easy, and create useful history over time.

## A.11 Contribution outcome and lightweight feedback — Promoted

Simple outcome confirmation is promoted to MVP. See Section 21.1–21.2: "Did you receive the help?" + "Did it help?" + "Was it completed as agreed?"

A contribution can eventually support lightweight confirmation by both parties, without requiring Together to arbitrate whether a contribution was successful.

For example:

### Recipient

> **Did you receive the help?**
>
> - Yes
> - Not yet
> - There is a problem

If received:

> **Did this contribution help you make progress toward your goal?**
>
> - Yes
> - Partially
> - Not yet

### Contributor

> **Was the contribution completed as agreed?**
>
> - Yes
> - No
> - There is a problem

These confirmations are useful evidence for future trust history, but they should not automatically trigger a dispute or require Together staff to determine who was right.

## A.12 Trust should be contextual rather than one universal score — Post-MVP (partial)

Store the underlying facts (contribution history, verification level, resource-specific history); don't build a trust engine yet.

A person with many successful low-risk contributions should not automatically be treated as trusted for every high-risk resource.

Trust may eventually be considered across dimensions such as:

- General contribution history
- Resource-specific contribution history
- Verification level
- Account age
- Recent activity
- Successful outcomes
- Unresolved disputes
- Relevant restrictions

For example, successful history with books or mentoring does not by itself establish sufficient trust for a high-value laptop loan.

Resource-specific requirements should therefore be possible without creating a single global reputation score.

## A.13 Progressive trust and access — Post-MVP (grooming backlog)

Only basic account restrictions initially. The full progressive trust hierarchy is for later.

Together may eventually use progressive trust requirements for different classes of activity.

A conceptual progression is:

```text
Basic account
    ↓
Low-risk participation
    ↓
Successful contribution history
    ↓
Additional verification
    ↓
Higher-trust activities
    ↓
High-value / higher-risk resource participation
```

This should reduce the incentive and opportunity for someone to create a new account and immediately obtain high-value resources.

The exact verification thresholds, restrictions, and risk categories should be separately groomed.

## A.14 No automatic assumption that the recipient is fraudulent — Promoted (principle)

Don't accuse/score; basic reporting and moderation. This principle is already embedded in Sections 34–35.

Repeated requests, anonymity, lack of contribution history, or a compelling story should not independently be treated as proof of fraud.

Together should expose relevant information and apply established rules consistently. Where automated systems identify potentially suspicious activity, the initial response may be an informational warning, additional verification, review, or temporary restriction depending on the severity and confidence of the signal.

This keeps trust decisions evidence-based and avoids publicly shaming users.

## A.15 Potential contribution workspace model — Post-MVP (grooming backlog)

Too much product for MVP. Start with simple contribution → conversation/contact exchange. Build workspace only if users demonstrate need.

A future contribution workspace could provide a lightweight place for:

```text
Contribution
├── Request
├── Participants
├── Identity visibility
├── Coordination method
├── Conversation
├── Fulfillment method
├── Files / attachments
├── Handoff information
├── Activity history
├── Outcome confirmation
└── Issue reports, where necessary
```

The workspace should feel closer to a lightweight coordination thread than an e-commerce order-management system. Simple contributions should remain simple, and participants should be free to move off-platform whenever they prefer.

This could become a useful coordination object through which Together records the existence and basic state of real-world help. It should not imply that Together staff are expected to supervise every contribution or resolve every disagreement.

## A.16 Implementation-grooming questions — Post-MVP (grooming backlog)

These are design questions, not features. Resolve before promoting any remaining addendum concepts.

Before promoting this addendum into implementation requirements, the following questions should be resolved separately:

1. What exact account/role/permission model is appropriate for the MVP?
2. Which verification levels are actually needed at launch?
3. Which information about request and contribution history should be public, and for how long?
4. What constitutes a successful contribution?
5. Which contribution states are required for the first release?
6. Which coordination methods belong in MVP: off-platform contact exchange, Together chat, data room, or a smaller subset?
7. How should anonymous contributors be represented and protected?
8. Which fulfillment methods should be supported explicitly versus handled as generic coordination?
9. How should sensitive access links, codes, or credentials be exchanged securely?
10. What signals should trigger warnings, verification, manual review, restrictions, or suspension?
11. Which eBay-style trust/history patterns and Facebook Marketplace-style low-friction coordination patterns are appropriate for Together, and which would create unwanted marketplace dynamics?
12. How should resource-specific trust requirements interact with general contribution history?
13. If AI agents become common, are any additional account-security controls actually needed beyond the normal account model?

These questions should be groomed independently before the associated concepts are promoted into the main implementation specification.
