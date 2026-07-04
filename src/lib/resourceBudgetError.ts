import { ApiError } from './apiError'
import type { ResourceBudgetErrorResponse } from './sumDesignBudget'

export class ResourceBudgetApiError extends ApiError {
  readonly budget: ResourceBudgetErrorResponse

  constructor(budget: ResourceBudgetErrorResponse) {
    super(422, budget.error)
    this.name = 'ResourceBudgetApiError'
    this.budget = budget
  }
}

export function isResourceBudgetApiError(
  error: unknown,
): error is ResourceBudgetApiError {
  return error instanceof ResourceBudgetApiError
}
