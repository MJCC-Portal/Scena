Scena First Release Execution Plan

Release window: Tuesday, July 21, 2026 through Thursday, July 23, 2026

Target: First usable production release on Thursday

Current remote baseline: v1.0.5 at commit 46399b3e3cf32c3558db532d69c1e1cb6511c05e
Baseline authority: SOPs → live database → repository source → deployed Supabase functions → documentation

This is a compressed release plan. Scena will ship a complete core customer loop, not the entire long-term platform.

1. Release Goal

A customer must be able to complete this journey:

Sign in
  ↓
Create or activate a Team
  ↓
Complete subscription checkout
  ↓
Open the dashboard
  ↓
Upload an Asset
  ↓
Create a Board
  ↓
Pair a Display
  ↓
Assign and publish the Board
  ↓
See the content play on the Display

The first release is successful when this path works end to end in production with a clean, usable UI.

2. Release Scope

Must ship

Google authentication.

Optional native email authentication where already supported.

Correct zero-Team account handling.

Team creation or activation flow.

Stripe Checkout.

Stripe Billing Portal.

Stripe webhook-based subscription synchronization.

Main application shell and navigation.

Dashboard with useful summary information.

Asset upload and basic asset library.

Board creation and editing.

Basic layout and tile management.

Display pairing using the existing claim flow.

Assigning published content to a Display.

Display playback through the existing gateway.

Loading, empty, success, and error states.

Basic responsive behavior.

Remote GitHub Actions CI passing.

Production smoke testing.

Rollback instructions.

Explicitly postponed

Full automation engine.

Advanced drag-and-drop design canvas.

Canonical Board and Asset database redesign.

Advanced analytics.

Complex role and permission matrices.

Credential-rotation UI.

Undeployed or source-only Edge Functions.

Advanced presentation-processing callbacks.

Multi-Team switching improvements.

External integrations.

Large documentation encyclopedia.

Nonessential animations and visual effects.

3. Product Vocabulary for This Release

The SOP vocabulary controls the UI. The current database remains the implementation layer until a later schema migration.

Customer-facing term

Current implementation

Board

scenes plus display_layouts

Board element

display_layout_tiles

Asset

presentation_assets

Display

Current screen/display records

Publish

Assign active content or session state to a Display

Team

Current team and membership records

Rules:

Do not pretend a canonical boards or generic assets table already exists.

Use an adapter or domain-mapping layer for the Thursday release.

Document the vocabulary gap.

Do not begin a destructive schema rewrite before launch.

4. Current Verified Runtime Baseline

The currently deployed Supabase Edge Functions are:

mjcc-sso-exchange

presentation-upload

display-gateway

screen-claim

billing-checkout

billing-portal

billing-webhook

Any repository-only function must be labeled source only or planned, not live.

The documentation baseline currently being rebuilt must clearly distinguish:

LIVE

SOURCE ONLY

DATABASE SUPPORTED

PLANNED

NOT IMPLEMENTED

5. Schedule

Tuesday Night, July 21: Truth, Scope, and Release Lock

Objective

Finish the current baseline audit, correct false documentation claims, and convert the findings into a release backlog for Wednesday.

Required work

Finish checking SOPs against the live database.

Finish checking repository source against deployed Edge Functions.

Correct the API inventory and capability matrix.

Record the Board and Asset vocabulary mapping.

Record source-only and undeployed functions accurately.

Identify current frontend routes and existing UI components.

Identify every missing piece in the core customer journey.

Produce a short P0/P1/P2 release issue list.

Freeze Thursday scope.

Stop expanding the documentation tree beyond what helps the release.

Tuesday deliverables

Accurate source-of-truth documentation.

Corrected live-versus-planned inventory.

Release-critical gap list.

Existing-page and missing-page inventory.

Data-model mapping for Board, Asset, Display, Team, and Publish.

No fabricated capability claims.

No production deployment.

No unapproved commit or push.

Tuesday completion gate

Before moving into implementation, the following must be known:

Which UI pages already exist.

Which backend operations already work.

Which deployed functions are usable.

Which missing functions are truly required for Thursday.

Which database tables power each UI feature.

Which P0 issues could block release.

Wednesday, July 22: Build and Integrate the Complete Core Loop

Wednesday is the main implementation day. Work in vertical slices, not isolated layers.

Block A: Authentication, Team, and Billing

UI

Sign-in page.

OAuth callback handling.

Native email sign-in where supported.

Team-required or onboarding page.

Checkout entry point.

Billing settings page.

Billing Portal action.

Clear loading and failure states.

Backend integration

Supabase Auth session restoration.

Correct zero-Team context.

Team access resolution.

Billing Checkout integration.

Billing Portal integration.

Webhook-synchronized subscription state.

No client-side subscription fabrication.

Acceptance test

New user
→ signs in
→ has zero Teams
→ sees onboarding or Team-required UI
→ completes checkout
→ webhook provisions or activates paid Team
→ enters dashboard

Block B: Application Shell and Dashboard

UI

Sidebar or primary navigation.

Header and account controls.

Team context display.

Dashboard summary cards.

Quick actions.

Empty states.

Error boundary.

Toast or inline status system.

Dashboard information

At minimum:

Number of Boards.

Number of Assets.

Number of Displays.

Display online/offline state where available.

Current subscription plan.

Recent or relevant activity where the data already exists.

Do not create fake metrics.

Block C: Assets and Boards

Asset workflow

Upload supported content.

Show upload progress.

Show success and failure.

Display uploaded Assets in a library.

Allow selection of an Asset while editing a Board.

Do not expose storage secrets or raw internal paths unnecessarily.

Board workflow

Create Board.

Rename Board.

Select or create a basic layout.

Add Asset-backed elements or tiles.

Reorder or configure tiles using the current model.

Save.

Preview.

Publish or mark ready for assignment.

Editor scope

The first editor may use:

Forms.

Selectors.

A simple grid.

Basic ordering controls.

A preview panel.

A complex freeform canvas is not required for Thursday.

Acceptance test

Paid Team user
→ uploads an Asset
→ creates a Board
→ selects a layout
→ adds the Asset
→ saves
→ previews
→ returns later and sees the saved Board

Block D: Displays, Assignment, and Playback

Manager UI

Displays list.

Pair Display action.

Pairing-code input.

Claim success and error states.

Display details.

Assign Board to Display.

Publish or activate.

Show basic online/offline or last-seen information where supported.

Kiosk/display UI

Registration or pairing screen where already supported by current source.

Device credential persistence.

Polling through display-gateway.

Loading state.

Offline/retry state.

Content rendering.

Safe fallback when no content is assigned.

Acceptance test

Manager opens Displays
→ enters pairing code
→ claims Display
→ selects Board
→ assigns and publishes
→ physical or test Display polls gateway
→ Board content appears

Wednesday Evening: End-to-End Test and Release Hardening

Run the complete customer journey without manually editing database rows:

Sign in
→ Team and billing
→ Dashboard
→ Upload Asset
→ Create Board
→ Pair Display
→ Assign Board
→ Publish
→ Display plays content

Fix priority

P0: Data loss, security failure, authentication broken, billing broken, upload broken, pairing broken, playback broken, application unusable.

P1: Major workflow confusion, important page broken, severe responsive issue, incorrect subscription state, unreliable display state.

P2: Cosmetic issues, minor spacing, optional enhancements.

Only P0 and P1 issues block the release.

Required verification

npm ci
npx tsc -b
npx vitest run
npm run build
deno check
node scripts/validate-api-contracts.mjs

Also verify:

GitHub Actions passes remotely.

No secret files are committed.

No temporary binaries or copied test directories are committed.

No production mutation occurs from CI.

Build output loads.

Browser console has no release-blocking errors.

Edge Function logs contain no leaked secrets.

Database backup or rollback point exists.

Thursday, July 23: Release Candidate and Production Launch

Thursday Morning: Release Candidate

Final QA

Test:

New account.

Existing account.

Account with no Team.

Paid Team.

Failed or cancelled checkout.

Asset upload.

Board creation and save.

Display pairing.

Board assignment.

Display playback.

Logout and login again.

Desktop browser.

Mobile browser for management basics.

Actual kiosk or display device.

Production-readiness checks

Production domain and HTTPS.

Google OAuth production redirect URLs.

Supabase Auth configuration.

Stripe live products and prices.

Stripe live webhook endpoint.

Required environment variables.

Storage bucket permissions.

Row-level security sanity check.

Edge Functions active and healthy.

Error monitoring or operational logs.

Database backup.

Rollback steps.

Support contact or reporting path.

Thursday Go/No-Go Gate

Release only when all are true:

Authentication works.

Zero-Team handling works.

Paid Team activation works.

Dashboard loads without fabricated information.

Asset upload works.

Board create, edit, save, and preview work.

Display pairing works.

Board assignment works.

Display playback works.

Production build succeeds.

Remote CI is green.

No P0 issues remain.

No unresolved security issue remains.

Rollback procedure is ready.

A small number of documented P2 visual issues may remain.

Thursday Launch Sequence

Confirm the approved release commit identifier.

Commit and push normally.

Confirm the GitHub Actions run belongs to the exact commit.

Wait for every required job to pass.

Deploy the approved production build.

Verify the deployed commit or build version.

Run production smoke tests.

Test one real end-to-end customer journey.

Enable public access.

Publish short release notes.

Monitor authentication, billing, upload, pairing, and playback.

Fix only critical launch issues.

6. Required UI Pages

Route names may be adapted to the repository's existing routing structure. Do not rename working routes solely to match this document.

Page

Purpose

Login

Google and optional email authentication

OAuth callback

Complete authentication and restore session

Team onboarding / Team required

Handle users with no active Team

Dashboard

Product overview and quick actions

Boards

List and create Boards

Board editor

Edit layout, tiles, and Asset selection

Assets

Upload and manage Assets

Displays

List and inspect Displays

Display pairing

Claim a Display using a pairing code

Display details

Assign and publish Board content

Billing settings

Plan, Checkout, and Billing Portal

Kiosk/display

Poll and render assigned content

Account settings

Basic account and logout controls

7. Release Ownership

Claude Code

Audit source, schema, docs, and deployment state.

Implement release-critical code.

Keep UI and backend terminology mapped accurately.

Add and run tests.

Maintain CI.

Produce factual documentation.

Report blockers without inventing completion.

Never commit, push, migrate, or deploy without the required authorization.

Product owner

Freeze scope.

Approve UI direction.

Supply exact Git identifiers.

Approve production deployment.

Verify production Stripe and OAuth configuration.

Perform or witness final customer-flow testing.

Make the final Go/No-Go decision.

8. Fallback Rules

Billing is not production-ready

Do not create a hidden billing bypass.

The safe fallback is an invite-only beta using explicitly provisioned test accounts while paid self-service remains disabled and clearly labeled unavailable.

Board schema blocks development

Use the documented adapter over scenes, display_layouts, and display_layout_tiles. Do not perform a rushed destructive migration.

Presentation processing is unreliable

Limit the release to directly supported upload formats and document the supported types. Do not claim broader conversion support.

Display playback is unreliable

The public release is blocked. Scena's essential purpose is getting content onto a Display.

Documentation is unfinished

Ship the minimum truthful documentation required for operation, support, and rollback. Postpone the 40-plus-file documentation expansion.

9. Definition of Done

Scena's first release is done when:

A real user can authenticate.

A zero-Team user receives a correct onboarding path.

A subscription can activate a Team through verified billing state.

The dashboard and navigation are usable.

The user can upload an Asset.

The user can create and save a Board.

The user can pair a Display.

The user can assign and publish the Board.

The Display renders the assigned content.

The complete journey passes in production.

Remote CI passes for the released commit.

No P0 defect remains.

Documentation accurately separates live, source-only, planned, and unimplemented capabilities.

Monitoring and rollback procedures are ready.

10. Guiding Rule Through Thursday

Work only on something that helps a customer sign in, activate a Team, upload content, build a Board, pair a Display, publish, or see the content play.

Everything else waits until after the first release.