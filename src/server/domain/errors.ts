/** Base class for expected failures that are safe to show the user. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found`)
  }
}

export class InvariantViolation extends DomainError {}

export class ValidationError extends DomainError {}
