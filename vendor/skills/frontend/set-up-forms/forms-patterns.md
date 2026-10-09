# Forms Patterns

Reference for `set-up-forms`. Schema-first validation, accessibility, and where form state belongs.

## Rule: React Hook Form (React) and VeeValidate (Vue), both driven by Zod
**Why:** React Hook Form registers inputs uncontrolled, so typing does not re-render the form; Formik holds values in React state and re-renders on each change by default. VeeValidate is the form library with first-class Vue composables and field-level validation state. Zod over hand-written validators because one schema gives type, rules, and messages (next rule), and both form libraries accept it.
**How to apply:** React: `react-hook-form` + `@hookform/resolvers` (`zodResolver`). Vue: `vee-validate` + `@vee-validate/zod` (`toTypedSchema`). Both resolvers also accept any other Standard Schema library (below).

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
**How to apply:** Every input has a `<label htmlFor>`; invalid inputs set `aria-invalid` and `aria-describedby` pointing at the error; the error message has `role="alert"`; the `<form>` uses `noValidate` so your validation (not the browser's) drives messaging; inputs for known data carry `autocomplete` tokens (`email`, `username`, `current-password`, `new-password`) and never block paste (WCAG 1.3.5, 3.3.8). (The `configure-accessibility` skill lints this.)

## Rule: form state is UI state — the form lib owns it, not the store
**Why:** In-progress field values, touched/dirty flags, and errors exist only because the user is typing right now — that's UI state. React Hook Form / VeeValidate manage it efficiently (uncontrolled inputs, minimal re-renders). Mirroring it into Zustand/Pinia duplicates a source of truth.
**How to apply:** Let the form library hold form state. Use a store only for cross-step state (a multi-step wizard's accumulated answers). See `../_shared/glossary.md`.

## Rule: submit calls a mutation; the form never fetches
**Why:** The form's job is collect + validate. Persisting is server state — TanStack Query's `useMutation` owns the request, loading/error state, and cache invalidation.
**How to apply:** `onSubmit` → `await mutation.mutateAsync(values)`; read `mutation.isPending`/`isError` for submit UI; the mutation invalidates the relevant query keys.

## When to deviate
- **Bundle-sensitive:** `valibot` is a lighter, tree-shakeable alternative to Zod with a similar API (`@vee-validate/valibot`, `@hookform/resolvers/valibot`). Swap if bundle size matters more than Zod's ecosystem. React Hook Form resolvers 5 also ship `standardSchemaResolver` (`@hookform/resolvers/standard-schema`), which takes any Standard Schema library without a per-library resolver.
- **Zod 3 pinned elsewhere in the repo:** `@vee-validate/zod` 4.15 targets Zod 3 (peer `^3.24`); with Zod 4 it works for the cases checked but is outside its declared range. Pin `zod@^3.25` for Vue until VeeValidate 5 is stable.
- **Trivial forms:** a single uncontrolled input with native `required` doesn't need a form library. Reach for one when there are multiple fields, cross-field rules, or async validation.
- **React 19 actions:** for a one- or two-field form (newsletter, search, rename) `<form action={fn}>` + `useActionState` gives pending and error state without a library — still validate with the same Zod schema (`schema.safeParse(Object.fromEntries(formData))`) and submit through the TanStack mutation. In Next.js the action is a Server Action and `useOptimistic` shows the pending value. Details: `../_shared/framework-idioms.md`.
