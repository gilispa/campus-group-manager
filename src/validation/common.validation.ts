import type {
  CareerCreateInput,
  CareerUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  GiroCreateInput,
  GiroUpdateInput,
  PortfolioCreateInput,
  PortfolioUpdateInput,
  PrepaProgramCreateInput,
  PrepaProgramUpdateInput,
  RoleCreateInput,
  RoleUpdateInput
} from "../types/domain";
import { assertNonEmptyString, assertOptionalString } from "../utils/guards";

export function validateCategoryCreate(input: CategoryCreateInput): CategoryCreateInput {
  return validateGiroCreate(input);
}

export function validateCategoryUpdate(input: CategoryUpdateInput): CategoryUpdateInput {
  return validateGiroUpdate(input);
}

export function validateGiroCreate(input: GiroCreateInput): GiroCreateInput {
  return {
    ...input,
    name: assertNonEmptyString(input.name, "El nombre del giro"),
    description: assertOptionalString(input.description)
  };
}

export function validateGiroUpdate(input: GiroUpdateInput): GiroUpdateInput {
  return {
    ...input,
    ...(input.name !== undefined ? { name: assertNonEmptyString(input.name, "El nombre del giro") } : {}),
    ...(input.description !== undefined ? { description: assertOptionalString(input.description) } : {})
  };
}

export function validatePortfolioCreate(input: PortfolioCreateInput): PortfolioCreateInput {
  return {
    ...input,
    name: assertNonEmptyString(input.name, "El nombre del portafolio"),
    description: assertOptionalString(input.description)
  };
}

export function validatePortfolioUpdate(input: PortfolioUpdateInput): PortfolioUpdateInput {
  return {
    ...input,
    ...(input.name !== undefined ? { name: assertNonEmptyString(input.name, "El nombre del portafolio") } : {}),
    ...(input.description !== undefined ? { description: assertOptionalString(input.description) } : {})
  };
}

export function validateRoleCreate(input: RoleCreateInput): RoleCreateInput {
  return {
    ...input,
    name: assertNonEmptyString(input.name, "El nombre del rol"),
    description: assertOptionalString(input.description)
  };
}

export function validateRoleUpdate(input: RoleUpdateInput): RoleUpdateInput {
  return {
    ...input,
    ...(input.name !== undefined ? { name: assertNonEmptyString(input.name, "El nombre del rol") } : {}),
    ...(input.description !== undefined ? { description: assertOptionalString(input.description) } : {})
  };
}

export function validateCareerCreate(input: CareerCreateInput): CareerCreateInput {
  return {
    ...input,
    name: assertNonEmptyString(input.name, "El nombre de la carrera"),
    description: assertOptionalString(input.description)
  };
}

export function validateCareerUpdate(input: CareerUpdateInput): CareerUpdateInput {
  return {
    ...input,
    ...(input.name !== undefined ? { name: assertNonEmptyString(input.name, "El nombre de la carrera") } : {}),
    ...(input.description !== undefined ? { description: assertOptionalString(input.description) } : {})
  };
}

export function validatePrepaProgramCreate(input: PrepaProgramCreateInput): PrepaProgramCreateInput {
  return {
    ...input,
    name: assertNonEmptyString(input.name, "El nombre del programa"),
    description: assertOptionalString(input.description)
  };
}

export function validatePrepaProgramUpdate(input: PrepaProgramUpdateInput): PrepaProgramUpdateInput {
  return {
    ...input,
    ...(input.name !== undefined ? { name: assertNonEmptyString(input.name, "El nombre del programa") } : {}),
    ...(input.description !== undefined ? { description: assertOptionalString(input.description) } : {})
  };
}
