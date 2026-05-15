import type { AddStudentToGroupInput, RemoveStudentFromGroupInput } from "../types/domain";
import { ValidationError } from "../utils/errors";

export function validateAddStudentToGroupInput(input: AddStudentToGroupInput): AddStudentToGroupInput {
  if (input.joinedAt && Number.isNaN(input.joinedAt.getTime())) {
    throw new ValidationError("La fecha de ingreso es invalida.");
  }

  return input;
}

export function validateMembershipRemoval(
  input: RemoveStudentFromGroupInput,
  joinedAt: Date
): RemoveStudentFromGroupInput {
  const leftAt = input.leftAt ?? new Date();
  if (Number.isNaN(leftAt.getTime())) {
    throw new ValidationError("La fecha de salida es invalida.");
  }

  if (leftAt < joinedAt) {
    throw new ValidationError("La fecha de salida no puede ser anterior a la fecha de ingreso.");
  }

  return {
    ...input,
    leftAt
  };
}
