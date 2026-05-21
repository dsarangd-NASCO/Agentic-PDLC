---
applyTo: "src/api/**, src/services/**, src/db/**, src/entities/**, src/use-cases/**"
---

# Backend Source — Engineering Rules

These rules apply to all backend source code. They are enforced during code review by tech-lead
and are non-negotiable without an ADR.

---

## Clean Architecture — Dependency Rule

```
entities/ ← use-cases/ ← interface-adapters/ ← frameworks/
```

**Absolute rule:** no import in an inner layer may reference an outer layer.

| Layer | Directory | Allowed Imports |
|---|---|---|
| Entities | `src/entities/` | Other entities only. Zero framework/DB/HTTP imports. |
| Use Cases | `src/use-cases/` | `entities/` and defined interfaces only |
| Interface Adapters | `src/interface-adapters/` | `entities/`, `use-cases/`, standard lib |
| Frameworks | `src/frameworks/` | Everything — this is the outermost layer |

**Violation examples (blocking in code review):**
- `entities/claim.ts` importing from `typeorm` → VIOLATION
- `use-cases/submit-claim.ts` importing `ClaimsRepository` concrete class → VIOLATION (inject the interface)
- `use-cases/submit-claim.ts` importing `HttpException` from NestJS → VIOLATION

---

## SOLID Enforcement

### SRP — Single Responsibility
- Each class/module has exactly one reason to change.
- Controller classes only map HTTP ↔ use-case. No business logic.
- Use-case classes implement one application scenario. No HTTP/DB concerns.

### OCP — Open/Closed
- Prefer extension via new classes/strategies over modifying existing ones.
- Growing if/else chains based on type are a smell — consider Strategy or Visitor pattern.

### LSP — Liskov Substitution
- Subtypes must be substitutable for their supertypes.
- If overriding a method changes its contract (different exceptions, different return semantics),
  it violates LSP.

### ISP — Interface Segregation
- Repository interfaces must be narrow: `ClaimsReader` and `ClaimsWriter` separately if consumers
  only need one.
- Do not force consumers to depend on methods they don't use.

### DIP — Dependency Inversion
- Business logic depends on abstractions (interfaces), not concretions.
- Use constructor injection. Never `new ConcreteRepository()` inside a use-case.
- NestJS DI container handles injection — register via module providers.

---

## TDD Cycle

1. **Red** — write a failing test asserting the behavior before writing implementation.
2. **Green** — implement minimum code to pass.
3. **Refactor** — clean up. Do not skip. Committed code must have gone through all 3 steps.

**Test quality rules:**
- Tests in `tests/unit/` must run in < 100ms each.
- Tests assert behavior (inputs → outputs), not implementation (function call counts).
- No `// TODO: add tests later` in committed code.

---

## Integration Tests — Testcontainers

Integration tests use real infrastructure. Never mock at the database layer.

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer('postgres:16').start();
  // run migrations, seed minimal test data
});
```

---

## API Contract Compliance

- All implemented endpoints must exist in `docs/architecture/API-CONTRACTS.yaml`.
- Request/response schemas must match OpenAPI definitions exactly.
- Never create an endpoint not in the contract — raise a blocker to solution-architect.

---

## Commit Standards

Format: `<type>(<scope>): <description>`

```
feat(claims): add FNOL submission endpoint
fix(billing): handle null policy number in invoice export
refactor(auth): extract token validation into use-case
test(claims): add integration test for adjuster routing
```

Breaking changes: use `!` → `feat(api)!: rename claim status enum values`

---

## Branch Rules

- Max lifetime: 2 working days.
- Incomplete work ships behind a feature flag — never holds a branch open.
- PR size: ≤ 400 LOC, one concern.

---

## NestJS Conventions

```typescript
// Controller — HTTP mapping only
@Controller('claims')
export class ClaimsController {
  constructor(private readonly submitClaim: SubmitClaimUseCase) {}

  @Post()
  async submit(@Body() dto: SubmitClaimDto) {
    return this.submitClaim.execute(dto);  // delegates immediately
  }
}

// Use Case — application logic
@Injectable()
export class SubmitClaimUseCase {
  constructor(private readonly claims: ClaimsRepository) {}  // interface, not concrete class

  async execute(input: SubmitClaimInput): Promise<SubmitClaimResult> {
    // business logic here — no HTTP, no ORM
  }
}
```
