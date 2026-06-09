# Glossary

Atomic-design and frontend-specific terms used across these skills, defined to remove ambiguity.

## Atom
A UI element that cannot be broken into smaller meaningful UI parts without losing function. Examples: `Button`, `Input`, `Icon`, `Label`, `Spinner`, `ErrorFallback` (a small message + retry control).

**Test:** if you removed any internal element, would it still be a recognizable, useful UI primitive? If no, it's an atom.

## Molecule
A small, opinionated composition of atoms doing one job. Examples: `SearchInput` (Input + Button), `FormField` (Label + Input + ErrorMessage), `ErrorBoundary` (catch behavior + ErrorFallback atom).

**Test:** does it compose 2–4 atoms with one clear purpose? If yes, molecule. If it reaches into pages/layout, it's an organism.

## Organism
A larger composition that combines molecules and atoms into a meaningful interface region. Examples: `Header`, `ProductCard`, `Sidebar`, `LoginForm`.

**Test:** does it represent a recognizable section of UI a user might point at and name ("the header")? If yes, organism.

## Template
A page layout that arranges organisms into a recognizable page structure, with no specific content. Examples: `MarketingLayout`, `DashboardLayout`, `AuthLayout`.

**Test:** does the file specify *where* organisms go but not *which specific data* they show? If yes, template.

## Page
A specific instance of a template with real content and route binding. Examples: `HomePage`, `ProductDetailPage`, `LoginPage`.

**Test:** does it map to a route and pull real data? If yes, page.

## "Component-level" vs "page-level" boundary
Used in error-boundary placement.
- **Component-level:** wraps a single risky component (third-party widget, data-driven card).
- **Page-level:** wraps an entire page template so a single route's failure stays isolated.
- **App-shell:** wraps the root so a catastrophic error doesn't blank the whole app.

## Server state
State owned by a server and fetched over the network — lists, entities, anything with a canonical copy elsewhere. Managed by TanStack Query, which caches, deduplicates, refetches, and invalidates it.

**Test:** could a server change this value without the user touching the UI? If yes, it's server state.

## Client / UI state
Ephemeral, client-only state with no server copy — toggles, selections, active filters, theme, wizard step. Managed by Zustand (React) or Pinia (Vue).

**Test:** does it exist only because of what the user is doing in the browser right now? If yes, it's UI state.

## Audit-first
Convention used by every skill in this plugin: before installing or modifying anything, the skill reads the current project state and decides what (if anything) needs to change. See spec section 2.5.

## Idempotent
A skill is idempotent if running it twice produces the same final state as running it once. Audit-first is the mechanism that makes skills idempotent.

## When to deviate

Glossary entries are definitions, not rules — there's no "deviate" axis the way rule files have one. Deviate from a definition only when the project's domain language fundamentally redefines a term (e.g., a design system that calls atoms "primitives" — adopt the design-system term locally). When that happens, document the local term right next to the canonical one so cross-domain readers aren't lost.
