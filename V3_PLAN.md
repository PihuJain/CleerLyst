# Cleerlyst V3 Roadmap

## Release Goal

Institutional refinement release: elevate admin controls, polish the student experience, and harden stability.

## Primary Focus Areas

### Admin System

- Granular role separation (super-admin vs institute-admin)
- Dataset activity timeline
- Audit log viewer UI
- Clearer dataset state indicators
- Bulk operations refinement
- Stronger destructive action confirmations
- Admin UX consistency pass

### Student Experience

- Visual clarity pass across dashboards
- Micro-interaction refinement
- Empty state improvements
- Error message refinement
- Loading state smoothing
- Accessibility cleanup
- Performance optimization

### Stability & Quality

- Remove dead code and console leftovers
- Tighten type safety
- Review API status codes
- Review rate limiting logic
- Edge case bug elimination

## Not In Scope (→ V4)

- Email manager
- Intake form builder
- White-label configuration
- Major architectural rewrites
- New product modules

## Commit Convention

```
feat(admin): implement granular role permissions
refactor(ui): standardize dashboard spacing and typography
fix(feed): resolve edge case in identifier matching logic
perf(api): reduce feed query round trips
```

## Merge Strategy

1. All work on `v3-admin-control` branch
2. When stable → merge to `main`
3. Tag `v3.0.0`
