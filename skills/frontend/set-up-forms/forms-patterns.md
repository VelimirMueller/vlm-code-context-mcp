# Forms Patterns

Reference for `set-up-forms`. Schema-first validation, accessibility, and where form state belongs.

## Rule: the schema is the single source of truth
**Why:** Declaring the shape (TypeScript type), the rules (validation), and the field list separately means three things that drift apart. A Zod schema is all three at once: `z.infer` gives the type, the resolver gives the validation, and the object keys are the fields.
**How to apply:** Define the schema once; derive the form type with `z.infer`; pass the schema to `zodResolver` (React) / `toTypedSchema` (Vue). Never hand-write a parallel `interface` for form values.

**Anti-example:**
```ts
// bad: type and validation declared separately — they will drift
interface FormValues { email: string }
function validate(v: FormValues) { if (!v.email.includes('@')) /* ... */ }
```

## Rule: validate at the boundary, and reuse the schema
**Why:** The same schema that validates the form can validate the API payload (and, later, the server). One schema, validated wherever untyped data enters.
**How to apply:** Keep schemas in `src/libs/schemas/`. The form resolver and the mutation's input both reference the schema/`z.infer` type, so a field change ripples through types automatically.

## Rule: fields are accessible by default
**Why:** A form that traps keyboard users or hides errors from screen readers is broken, regardless of how it looks. Accessibility is not optional polish.
**How to apply:** Every input has a `<label htmlFor>`; invalid inputs set `aria-invalid` and `aria-describedby` pointing at the error; the error message has `role="alert"`; the `<form>` uses `noValidate` so your validation (not the browser's) drives messaging. (The `configure-accessibility` skill lints this.)

## Rule: form state is UI state — the form lib owns it, not the store
**Why:** In-progress field values, touched/dirty flags, and errors exist only because the user is typing right now — that's UI state. React Hook Form / VeeValidate manage it efficiently (uncontrolled inputs, minimal re-renders). Mirroring it into Zustand/Pinia duplicates a source of truth.
**How to apply:** Let the form library hold form state. Use a store only for cross-step state (a multi-step wizard's accumulated answers). See `../_shared/glossary.md`.

## Rule: submit calls a mutation; the form never fetches
**Why:** The form's job is collect + validate. Persisting is server state — TanStack Query's `useMutation` owns the request, loading/error state, and cache invalidation.
**How to apply:** `onSubmit` → `await mutation.mutateAsync(values)`; read `mutation.isPending`/`isError` for submit UI; the mutation invalidates the relevant query keys.

## When to deviate
- **Bundle-sensitive:** `valibot` is a lighter, tree-shakeable alternative to Zod with a similar API (`@vee-validate/valibot`, `@hookform/resolvers/valibot`). Swap if bundle size matters more than Zod's ecosystem.
- **Trivial forms:** a single uncontrolled input with native `required` doesn't need a form library. Reach for one when there are multiple fields, cross-field rules, or async validation.
