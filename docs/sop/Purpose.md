# SOP: Scena Core Service Offering and Customer Delivery

**Service:** Scena
**Company:** KpnSolute
**Service Owner:** Miah
**Technical Delivery Support:** KpnCompute, where applicable
**Version:** 1.1
**Last Updated:** July 21, 2026
**Status:** Pre-launch operating standard

---

## 1. Purpose

This Standard Operating Procedure defines the Scena service that may be presented, sold, provisioned, onboarded, supported, and handed over to a customer.

Its purpose is to ensure that:

* Sales describes the same product engineering has built.
* Customers receive the same onboarding process.
* Paid Teams are created only through verified billing.
* Displays are deployed consistently and securely.
* Support personnel follow the same escalation rules.
* No employee or contractor promises unreleased capabilities.
* A customer can operate Scena after onboarding without routine manual backend intervention.

This SOP governs the customer journey from first sign-in through the first successfully operating live Display.

---

## 2. Product Definition

Scena is a digital-signage management service provided by KpnSolute.

Scena allows authorized users to:

* Create and manage digital content.
* Organize content into Boards.
* Pair physical Displays.
* Assign Boards to Displays through Sessions.
* Invite Team members.
* Control live signage according to their role and plan.
* Schedule supported actions when their plan includes automation.
* Continue showing the last valid content during temporary connectivity loss.

Scena does not sell the customer's television, monitor, network connection, or general-purpose computer unless a separate written agreement states otherwise.

---

## 3. Terminology

### 3.1 Account

A Scena account belongs to one authenticated person.

An account may exist without a Team.

### 3.2 Personal account state

Personal is the account state of an authenticated user who does not currently belong to a Team.

Personal is not currently a paid plan.

A Personal account may:

* Manage its profile.
* Manage account preferences.
* View available plans.
* Begin paid Team checkout.
* Accept an eligible Team invitation.
* Sign out and return later.

A Personal account may not independently own:

* Boards.
* Displays.
* Sessions.
* Team members.
* Automations.
* Shared Team resources.

Scena must not describe Personal as a free digital-signage workspace unless that product capability is separately approved and implemented.

### 3.3 Team

A Team is the paid shared workspace that owns:

* Members.
* Billing.
* Boards.
* Assets.
* Displays.
* Sessions.
* Automations.
* Team settings.
* Other shared resources.

Every Team requires an active Plus, Pro, or Max plan.

### 3.4 Display

Display is Scena's public term for a physical signage endpoint.

A Display may consist of:

* A smart display running a supported Scena player.
* A compatible computer or signage device connected to a television or monitor.
* Another approved device capable of running the Scena Display application.

The physical database may internally use legacy terms such as `screen`, but customer-facing communication must use Display.

### 3.5 Board

A Board is designed content or a visual canvas intended for presentation on one or more Displays.

### 3.6 Session

A Session is the live-control relationship that determines which Board or content state is shown on one or more Displays.

---

## 4. Service Scope

This SOP applies to:

* Personal account holders.
* Plus Teams.
* Pro Teams.
* Max Teams.
* Owners.
* Admins.
* Operators.
* Designers.
* Viewers.
* Scena sales representatives.
* Onboarding personnel.
* Support personnel.
* Technical delivery personnel.

It applies from:

```text
First visit
→ account creation
→ plan selection
→ payment
→ Team provisioning
→ member setup
→ Board preparation
→ Display pairing
→ first live Session
→ customer handoff
```

---

## 5. Current Readiness Status

The following capabilities have been verified:

* Google authentication works.
* A real Scena user can authenticate.
* A profile and preferences record are created.
* A user may successfully remain in the no-Team Personal state.
* Current plans are displayed from the live plans database.
* GitHub Actions CI validates application code, Edge Functions, and API contracts.

The following are not yet verified end to end:

* Stripe Checkout creation from the live application.
* Successful paid subscription completion.
* Webhook-driven Team provisioning.
* Automatic Owner membership creation.
* Automatic entitlement provisioning.
* Billing Portal operation.
* Full Display registration and pairing.
* Complete first-live-Display customer delivery.

Until these are verified, Scena must be described as being in pre-launch or controlled testing.

No salesperson or representative may claim that paid self-service onboarding is operational until the commercial workflow has passed its acceptance tests.

---

## 6. Approved Plans

### 6.1 Plus

**Price:** $15 USD per month

Includes:

* 2 Displays.
* 10 Boards.
* 5 Team members.
* 1 concurrent Session.
* Up to 4 Displays in one Session.
* No automation.
* No Display Groups.
* No Session Groups.
* No resource-level access control.

Plus is intended for small organizations needing basic signage management.

### 6.2 Pro

**Price:** $25 USD per month

Includes:

* 5 Displays.
* 30 Boards.
* 10 Team members.
* 2 concurrent Sessions.
* Up to 4 Displays in each Session.
* Daily automation.
* Weekly automation.
* No Display Groups.
* No Session Groups.
* No resource-level access control.

Pro is intended for organizations needing more signage capacity and basic scheduling.

### 6.3 Max

**Price:** $40 USD per month

Includes:

* 15 Displays.
* 50 Boards.
* 25 Team members.
* 4 concurrent Sessions.
* Up to 4 Displays in each Session.
* Hourly automation.
* Daily automation.
* Weekly automation.
* Approved custom scheduling.
* Display Groups.
* Session Groups.
* Resource-level access control.

Max is intended for organizations coordinating multiple Displays, Sessions, schedules, and users.

### 6.4 Universal Session limits

Every Session is limited to four active Displays regardless of plan.

Session Groups do not provide additional concurrent-Session capacity.

For a Max Team:

```text
Maximum concurrent Sessions: 4

A Session Group containing 3 active Sessions
→ consumes 3 of the 4 available Session slots
```

---

## 7. Team Roles

### 7.1 Owner

The Owner may:

* Manage billing.
* Open the Billing Portal.
* Change plans.
* Manage Team settings.
* Invite and remove members.
* Change member roles.
* Transfer ownership.
* Delete the Team.
* Manage all content and Displays.
* Control all Sessions.

Every Team must retain at least one active Owner.

### 7.2 Admin

An Admin may:

* Manage members, subject to Owner protection.
* Manage Boards and Assets.
* Manage Displays.
* Manage Sessions.
* Manage supported automations.
* Manage most Team settings.

An Admin may not remove or demote the final Owner.

### 7.3 Operator

An Operator may:

* Pair Displays.
* Monitor Displays.
* Start and stop Sessions.
* Assign approved content.
* Trigger supported live-control operations.
* Place Displays into standby.
* Use emergency takeover where authorized.

### 7.4 Designer

A Designer may:

* Upload approved Assets.
* Create Boards.
* Edit Boards.
* Import PowerPoint content when supported.
* Preview content.

A Designer does not control live Displays by default.

### 7.5 Viewer

A Viewer may:

* View permitted Boards.
* View Display status.
* View Session status.
* Review allowed Team information.

A Viewer may not change Team resources.

---

## 8. Customer Eligibility and Qualification

Before recommending a plan, confirm:

* Number of physical Displays.
* Number of people requiring Team access.
* Number of Sessions expected to run simultaneously.
* Whether daily, weekly, hourly, or custom scheduling is required.
* Whether Display Groups or Session Groups are required.
* Whether customer hardware is compatible.
* Whether the site has reliable internet.
* Whether the customer owns or is licensed to use the content they intend to display.
* Whether the requested use is supported by the current Scena capability register.

Do not recommend a plan solely on price.

Recommend the smallest plan that safely supports the customer's current requirements.

---

## 9. Customer Responsibilities

The customer is responsible for:

* Providing compatible Displays or playback devices.
* Providing power and physical mounting.
* Providing a stable internet connection.
* Maintaining site networking and Wi-Fi.
* Protecting their account credentials.
* Assigning appropriate Team roles.
* Providing content they are legally permitted to use.
* Keeping playback devices updated when required.
* Reporting failures with enough information to diagnose them.
* Maintaining access to the Team Owner's email account.
* Keeping their payment method current.

Scena is not responsible for:

* Failed televisions or monitors.
* Damaged HDMI cables.
* Site power outages.
* Customer router failures.
* Customer firewall policies blocking required traffic.
* Unauthorized copyrighted material uploaded by the customer.
* Unsupported third-party applications.
* General onsite cabling or hardware installation unless separately contracted.

---

## 10. Scena Responsibilities

Scena is responsible for:

* Providing secure account authentication.
* Providing correct plan information.
* Processing payments through Stripe.
* Provisioning Teams only after verified payment.
* Applying correct plan entitlements.
* Enforcing Team and role boundaries.
* Providing Board and Display management.
* Providing secure Display credentials.
* Providing secure pairing codes.
* Preserving the last valid Display state during temporary network failure.
* Protecting customers from cross-Team data exposure.
* Maintaining documented service behavior.
* Providing an escalation path for billing and Display failures.
* Communicating confirmed outages or material security incidents.

---

## 11. Sales and Representation Rules

Anyone representing Scena must:

* Sell only capabilities marked operational in the service capability register.
* Clearly separate current capabilities from planned capabilities.
* Avoid promising custom development during a sales conversation.
* Avoid promising unsupported hardware.
* Avoid promising enterprise features.
* Avoid promising uptime or response-time guarantees that are not in an approved service-level policy.
* Avoid manually creating paid Teams as a workaround for failed billing.
* Avoid describing Personal as a free Team plan.
* Avoid using internal legacy terminology with customers.

The approved customer-facing terms are:

* Team, not organization.
* Board, not display layout.
* Board Element, not tile.
* Display, not screen.
* Session, not display session.
* Asset, not presentation record.

---

## 12. Customer Delivery Procedure

### Stage 1: Account creation

1. Customer opens Scena.
2. Customer signs in with Google or another approved authentication method.
3. Scena creates or updates:
   * Auth user.
   * Profile.
   * Preferences.
4. Customer enters the Personal account state.
5. Confirm there is no authentication or profile error.

**Verification:**

* User can sign out and sign back in.
* Display name is correct.
* Account does not incorrectly show unauthorized.
* No Team is created automatically.

### Stage 2: Plan selection

1. Customer reviews Plus, Pro, and Max.
2. Confirm required:
   * Displays.
   * Boards.
   * Members.
   * Concurrent Sessions.
   * Automation.
   * Groups and access control.
3. Customer selects the appropriate plan.
4. Customer supplies the proposed Team name and slug.

**Verification:**

* Plan limits displayed match the approved plan matrix.
* Price is shown in USD per month.
* Customer understands why the selected plan fits.

### Stage 3: Checkout

1. Scena validates the authenticated user.
2. Scena confirms the account does not already belong to an active Team.
3. Scena validates the selected plan.
4. Scena validates Team name and slug.
5. Scena creates or reuses the Stripe customer.
6. Scena creates a Stripe-hosted Checkout Session.
7. Customer completes payment through Stripe.
8. Scena does not treat the browser success page as proof of payment.

**Strict rule:**

Only a verified Stripe webhook may finalize a paid Team.

**Verification:**

* Checkout URL belongs to Stripe.
* Selected price matches the chosen plan.
* No card data passes through Scena.
* Failed checkout creates no Team.
* Repeated submission does not create duplicate Stripe sessions.

### Stage 4: Team provisioning

After verified payment:

1. Stripe sends `checkout.session.completed`.
2. Scena validates the webhook signature.
3. Scena deduplicates the Stripe event.
4. Scena retrieves authoritative subscription information.
5. Scena maps the Stripe price to Plus, Pro, or Max.
6. Scena creates the Team atomically.
7. Scena makes the purchaser Owner.
8. Scena creates Team preferences.
9. Scena applies the exact entitlements.
10. Scena creates or updates the Team subscription.
11. Scena marks the Checkout Session complete.
12. Scena records an audit event.
13. Scena queues the subscription-started notification.

**Verification:**

* Exactly one Team exists.
* Purchaser is Owner.
* Plan code is correct.
* All limits match the selected plan.
* Replaying the webhook creates no duplicate Team.

### Stage 5: Team configuration

1. Owner confirms:
   * Team name.
   * Team timezone.
   * Locale.
   * Branding settings when available.
2. Owner opens billing settings.
3. Owner confirms current plan and subscription status.
4. Owner confirms access to the Billing Portal.

### Stage 6: Member invitation

1. Owner or authorized Admin enters invitee email.
2. Owner assigns:
   * Admin.
   * Operator.
   * Designer.
   * Viewer.
3. Invitation is sent using the approved invitation flow.
4. Invitee signs in using the invited email.
5. Invitee accepts the invitation.
6. Membership is created.
7. Invitation becomes single-use and cannot be accepted again.

**Verification:**

* Wrong email cannot accept.
* Expired invitation cannot accept.
* Member quota is enforced.
* Invitee receives the selected role.
* User already belonging to another active Team is rejected.

### Stage 7: Display preparation

Before pairing:

1. Confirm device is supported.
2. Confirm device has stable power.
3. Confirm device can reach Scena.
4. Confirm screen resolution and orientation.
5. Confirm the Scena Display app or supported browser is available.
6. Confirm the physical Display is at the correct customer location.
7. Record the intended Display name.

### Stage 8: Display registration and pairing

1. Display opens the Scena Display application.
2. Display registers and receives:
   * Device credential.
   * Short pairing code.
3. Display stores its credential securely.
4. Pairing code appears on the physical Display.
5. Operator or higher enters the pairing code in Scena.
6. Operator selects the Team and Display name.
7. Pairing code is consumed.
8. Display becomes associated with the Team.
9. Display begins retrieving authoritative state.

**Verification:**

* Pairing code expires.
* Pairing code is single-use.
* Invalid attempts are limited.
* Raw Display credential is not stored in the database.
* Display appears in the Team dashboard.
* Display heartbeat updates.
* Another Team cannot claim the Display.

### Stage 9: First Board

1. Designer, Admin, or Owner creates a Board.
2. Set:
   * Board name.
   * Canvas size.
   * Orientation.
   * Background.
3. Add supported content.
4. Preview the Board.
5. Confirm text and images are readable at the physical viewing distance.
6. Save and publish according to the current Board workflow.

**Verification:**

* Board belongs to the correct Team.
* Board count remains within plan quota.
* Customer content renders correctly.
* No unsupported Asset type is silently accepted.

### Stage 10: First live Session

1. Operator or higher creates or opens a Session.
2. Operator adds the paired Display.
3. Operator assigns the Board.
4. Operator previews the state.
5. Operator starts the Session or performs Take.
6. Display retrieves authoritative Program state.
7. Physical screen shows the correct content.
8. Confirm Display heartbeat and content version.

**Verification:**

* Correct Board is shown.
* Correct Display is targeted.
* Another Team's Display cannot be selected.
* Session limit is enforced.
* Four-Display Session limit is enforced.
* Repeating the same command does not execute it twice.

### Stage 11: Resilience check

Where practical:

1. Confirm the Display has cached the last valid content.
2. Temporarily interrupt the Display's network connection.
3. Confirm it continues showing the last valid Program state.
4. Restore connectivity.
5. Confirm the Display reconciles with authoritative state.
6. Confirm no raw browser error or credentials appear.

Do not intentionally interrupt customer networking when it may affect unrelated systems.

### Stage 12: Customer handoff

Provide the customer with:

* Team name.
* Current plan.
* Owner identity.
* Team-role explanation.
* Display name.
* Board name.
* Session name.
* How to change content.
* How to restart a Session.
* How to check Display status.
* How to open billing settings.
* Support contact.
* Known limitations.
* Any unresolved issue and its owner.

The customer should perform at least one normal operation themselves before handoff is accepted.

Recommended customer-operated action:

* Edit a Board and confirm the change appears.
* Start or stop a Session.
* Check Display status.
* Invite a Team member.

---

## 13. Billing Lifecycle Procedures

### 13.1 Upgrade

When a Team upgrades:

* Stripe confirms the new price.
* Subscription record is synchronized.
* Higher limits are applied.
* Existing resources remain intact.
* New plan features become available.
* The Owner is shown the effective billing state.

### 13.2 Downgrade

Downgrading must never automatically delete:

* Displays.
* Boards.
* Members.
* Sessions.
* Assets.

When current usage exceeds the new plan:

* Team enters an over-limit state.
* Existing resources are preserved.
* New over-limit resource creation is blocked.
* Owner sees which limits are exceeded.
* Normal operation resumes after usage is reduced or the plan is upgraded.

### 13.3 Failed payment

When payment fails:

* Subscription state is synchronized.
* Owner is notified.
* Team data is preserved.
* Scena applies the approved grace or restricted-access policy.
* Existing signage should not suddenly display a raw billing error.
* Owner is directed to the Billing Portal.

The exact grace period must be defined before public launch.

### 13.4 Cancellation scheduled

When cancellation is scheduled:

* Team remains active through the paid period.
* Owner sees the cancellation date.
* Cancellation notification is queued.
* Reactivation before the period end restores the subscription.

### 13.5 Subscription ended

After the paid period ends:

* Team becomes inactive or suspended.
* Data is preserved.
* Owner may reactivate.
* Displays move to an approved standby or subscription-disabled state.
* No customer content is automatically destroyed.

### 13.6 Team deletion

Team deletion must:

* Require Owner authority.
* Require explicit confirmation.
* Protect the final Owner rule.
* Define how the Stripe subscription is handled.
* Preserve legally or operationally required billing records.
* Record an audit event.
* Avoid accidental deletion through normal navigation.

---

## 14. Support Priorities

### Priority 1: Critical

Examples:

* Suspected cross-Team data exposure.
* Unauthorized access.
* All customer Displays are down due to Scena.
* Incorrect billing disables an active paid Team.
* Emergency content cannot be removed.
* Confirmed security incident.

Action:

* Escalate immediately to the service owner and technical lead.
* Preserve logs and request IDs.
* Do not delete evidence.
* Do not make unreviewed database changes.
* Communicate confirmed facts only.

### Priority 2: High

Examples:

* One or more Displays cannot retrieve content.
* Pairing repeatedly fails.
* Checkout fails for a legitimate customer.
* Billing Portal fails.
* Session commands consistently fail.
* Automation fails repeatedly.

Action:

* Collect evidence.
* Check current service status.
* Check logs.
* Check configuration.
* Escalate to the appropriate technical owner.

### Priority 3: Normal

Examples:

* How-to question.
* Role clarification.
* Board design issue.
* Feature request.
* Supported-hardware question.
* Plan comparison question.

Action:

* Resolve using approved documentation.
* Log feature requests separately.
* Do not represent feature requests as committed roadmap work.

Response-time commitments must be defined in a separate approved support policy before being advertised.

---

## 15. Troubleshooting and Exceptions

| Situation | Required action |
|---|---|
| Google authentication fails | Confirm provider configuration, redirect URL, matching client ID and secret, then inspect Auth logs. Never ask the customer to send the secret. |
| Checkout fails | Inspect the safe failure stage and request ID. Verify function configuration. Never manually create the paid Team. |
| Checkout succeeds but Team is missing | Inspect Stripe event, webhook signature result, billing event record, and Team-finalization transaction. Do not create the Team manually until the failure is understood. |
| Customer already belongs to a Team | Do not allow a second active Team under the current model. Explain the existing membership or invitation conflict. |
| Invitation email does not match | Require authentication with the invited email or revoke and reissue the invitation. |
| Pairing code expired | Restart Display registration or issue a new code. Do not reuse an expired code. |
| Pairing attempts are locked | Wait for lock expiration or follow the approved reset procedure. |
| Display is offline | Confirm power, local network, internet reachability, and last heartbeat. Explain that last valid content should remain cached. |
| Display credential is compromised | Rotate or revoke the credential immediately. Do not reset manager accounts unnecessarily. |
| Display shows stale content | Confirm Session Program state, content version, Realtime connectivity, polling, and cache reconciliation. |
| Customer exceeds a quota | Explain the exceeded limit. Reduce usage or upgrade. Do not manually increase entitlements. |
| Customer requests unsupported feature | Record it as a roadmap signal. Provide an honest "not currently supported" answer. |
| Customer requests enterprise deployment | Explain that enterprise SSO, SCIM, dedicated tenancy, and hundreds of Displays are not currently included. |
| Customer requests custom hardware installation | Treat it as a separate scoped service, not part of the standard Scena subscription. |
| Suspected cross-Team access | Treat as Priority 1. Stop normal troubleshooting and begin security escalation. |

---

## 16. Prohibited Workarounds

Personnel must not:

* Manually insert a paid Team because Checkout failed.
* Manually assign paid entitlements without verified billing.
* Share service-role credentials.
* Copy Stripe secrets into messages or tickets.
* Store Display credentials in plaintext.
* Reuse expired pairing codes.
* Change database records without an audit trail.
* Bypass role or quota checks in the UI.
* Promise unreleased features.
* Delete customer resources to make a downgrade fit.
* Use production customer data for informal testing.
* Claim an email was delivered when only an outbox row exists.
* Claim an endpoint is live because source code exists.
* Claim a deployment works merely because deployment succeeded.

---

## 17. Onboarding Record

For each delivered Team, record:

* Customer organization name.
* Team ID.
* Team slug.
* Owner user ID and email reference.
* Selected plan.
* Subscription status.
* Checkout Session ID reference.
* Stripe customer and subscription references.
* Entitlement verification result.
* Invited members and assigned roles.
* Display IDs and names.
* Display location.
* Device type.
* Resolution and orientation.
* Board IDs and names used during onboarding.
* Session IDs and names.
* First-live timestamp.
* Support contact provided.
* Known limitations disclosed.
* Open issues.
* Customer acceptance status.
* Staff member completing onboarding.

Do not record:

* OAuth tokens.
* Stripe secret keys.
* Card details.
* Raw Display credentials.
* Pairing codes.
* Service-role keys.

---

## 18. Service Delivery Definition of Done

Customer delivery is complete only when all applicable checks pass.

### Account and billing

* [ ] Customer can authenticate.
* [ ] Profile and preferences exist.
* [ ] Customer selected the appropriate plan.
* [ ] Checkout completed through Stripe.
* [ ] Signed webhook was processed.
* [ ] Exactly one Team was created.
* [ ] Purchaser is Owner.
* [ ] Subscription record is correct.
* [ ] Entitlements match the selected plan.
* [ ] Billing Portal is accessible to the Owner.
* [ ] No manual paid-Team provisioning occurred.

### Team

* [ ] Team name and timezone are correct.
* [ ] Owner understands their responsibilities.
* [ ] At least one additional role was explained or tested where relevant.
* [ ] Member limits are correctly enforced.
* [ ] Final Owner protection is functioning.

### Content

* [ ] At least one valid Board exists.
* [ ] Board belongs to the correct Team.
* [ ] Content is legible on the physical Display.
* [ ] Customer has the right to use the displayed content.

### Display

* [ ] Display was registered securely.
* [ ] Pairing code was consumed once.
* [ ] Display is associated with the correct Team.
* [ ] Display heartbeat is visible.
* [ ] Display shows the correct live content.
* [ ] Display credential is not exposed.
* [ ] Offline fallback behavior was explained and, where safe, verified.

### Session

* [ ] Session is assigned to the correct Display.
* [ ] Correct Board is in Program state.
* [ ] Session limits are respected.
* [ ] Duplicate command execution was not observed.
* [ ] Operator knows how to start, stop, and inspect the Session.

### Security

* [ ] No cross-Team data or resource access occurred.
* [ ] No secrets were shared.
* [ ] Roles were enforced.
* [ ] Plan limits were enforced.
* [ ] Display and manager credentials remained separate.

### Handoff

* [ ] Customer completed at least one normal operation.
* [ ] Customer knows their plan and relevant limits.
* [ ] Customer knows how to reach support.
* [ ] Known limitations were disclosed.
* [ ] Onboarding record is complete.
* [ ] Customer accepted the service handoff.

---

## 19. SOP Readiness Definition of Done

This SOP may be marked operational only when:

* [ ] Plus Checkout passes end to end.
* [ ] Pro Checkout passes end to end.
* [ ] Max Checkout passes end to end.
* [ ] Webhook replay creates no duplicate Team.
* [ ] Billing Portal is verified.
* [ ] Upgrade is verified.
* [ ] Downgrade preserves resources.
* [ ] Payment-failure behavior is defined and verified.
* [ ] Cancellation behavior is verified.
* [ ] Display registration is deployed.
* [ ] Display pairing is verified.
* [ ] Credential rotation is verified.
* [ ] Credential revocation is verified.
* [ ] First Board workflow is usable.
* [ ] First Session workflow is usable.
* [ ] Offline Display behavior is verified.
* [ ] Support contact is published.
* [ ] Support priorities are approved.
* [ ] Supported-hardware requirements are published.
* [ ] Service capability register is current.
* [ ] Customer onboarding record template exists.
* [ ] Sales and support personnel have reviewed this SOP.

---

## 20. Related Documents

* Scena API v2 Definition of Done
* Scena API v2 Architecture
* Scena Authentication Guide
* Scena Billing and Subscription Policy
* Scena Display Deployment Guide
* Scena Supported Hardware Matrix
* Scena Customer Onboarding Record
* Scena Support and Incident Escalation Policy
* Scena Service Capability Register
* Scena Service Expansion Decision Procedure (`roadmap.md`)
* Scena Data Retention and Team Deletion Policy
* Scena Security Incident Response Procedure