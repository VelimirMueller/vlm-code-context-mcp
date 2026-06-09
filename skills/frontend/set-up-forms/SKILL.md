---
name: set-up-forms
description: Use when adding forms and validation to a frontend project — wires React Hook Form (React) or VeeValidate (Vue) with Zod schema-first validation, where one schema is the single source of truth for shape, rules, and inferred types, with accessible fields and submit wired to a TanStack Query mutation.
---

# Set Up Forms

## 1. Audit current state

```bash
grep -E '"(react-hook-form|vee-validate|formik|zod|valibot|@hookform/resolvers|@vee-validate/zod)"' package.json 2>/dev/null
```

Detect an existing form/validation lib. **Prerequisites:** `set-up-state-management` (form submit calls its `useMutation` hook) and `@/` alias.

## 2. Decide what to do
- No form lib → full setup.
- Formik or uncontrolled ad-hoc forms → migrate deliberately to the schema-first pattern below.
- Form lib + Zod present → confirm the schema-first + accessibility rules (`forms-patterns.md`).

## 3. Detect framework
React → **React Hook Form** + `@hookform/resolvers`. Vue → **VeeValidate** + `@vee-validate/zod`. Both validate with **Zod**.

## 4. Install

### React
```bash
pnpm add react-hook-form zod @hookform/resolvers
```

### Vue
```bash
pnpm add vee-validate zod @vee-validate/zod
```

## 5. Schema first — one source of truth

The Zod schema defines the shape, the rules, and (via `z.infer`) the type. Nothing is declared twice.

```ts
// src/libs/schemas/todo.ts
import { z } from 'zod';

export const createTodoSchema = z.object({
  text: z.string().min(1, 'Enter a todo').max(280, 'Keep it under 280 chars'),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
```

## 6. React — React Hook Form + zodResolver

```tsx
// src/components/molecules/CreateTodoForm/CreateTodoForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTodoSchema, type CreateTodoInput } from '@/libs/schemas/todo';
import { useCreateTodo } from '@/hooks/useCreateTodo';

export function CreateTodoForm() {
  const createTodo = useCreateTodo();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTodoInput>({ resolver: zodResolver(createTodoSchema) });

  const onSubmit = handleSubmit(async (data) => {
    await createTodo.mutateAsync(data); // server state via TanStack Query
    reset();
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="todo-text">Todo</label>
      <input
        id="todo-text"
        aria-invalid={errors.text ? true : undefined}
        aria-describedby={errors.text ? 'todo-text-error' : undefined}
        {...register('text')}
      />
      {errors.text && (
        <p id="todo-text-error" role="alert" className="text-sm text-red-600">
          {errors.text.message}
        </p>
      )}
      <button type="submit" disabled={isSubmitting}>Add</button>
    </form>
  );
}
```

## 7. Vue — VeeValidate + toTypedSchema

```vue
<!-- src/components/molecules/CreateTodoForm/CreateTodoForm.vue -->
<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { createTodoSchema } from '@/libs/schemas/todo';
import { useCreateTodo } from '@/composables/useCreateTodo';

const createTodo = useCreateTodo();
const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(createTodoSchema),
});
const [text, textAttrs] = defineField('text');

const onSubmit = handleSubmit(async (values) => {
  await createTodo.mutateAsync(values);
});
</script>

<template>
  <form novalidate @submit="onSubmit">
    <label for="todo-text">Todo</label>
    <input
      id="todo-text"
      v-model="text"
      v-bind="textAttrs"
      :aria-invalid="errors.text ? true : undefined"
      :aria-describedby="errors.text ? 'todo-text-error' : undefined"
    />
    <p v-if="errors.text" id="todo-text-error" role="alert" class="text-sm text-red-600">
      {{ errors.text }}
    </p>
    <button type="submit" :disabled="isSubmitting">Add</button>
  </form>
</template>
```

## 8. Verify
```bash
pnpm tsc --noEmit
```
Expected: 0 errors — the form's values type is inferred from the schema and matches the mutation input. Submitting an empty field shows the schema's message; a valid submit calls the mutation and resets.

## References
- ./forms-patterns.md — schema-first rationale, accessibility rules, form-state-is-UI-state, submit→mutation, Valibot alternative.
- ../_shared/glossary.md — server state vs UI state (a form's in-progress values are UI state).
- ../_shared/conventions.md — `@/` alias, molecule classification.
