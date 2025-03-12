import { i18n } from "i18n.config";

export abstract class ExtractionError extends Error {
  protected constructor(message: string) {
    super(message);
  }
  public abstract i18n(): string;
}

export class InvalidURLError extends ExtractionError {
  constructor() {
    super(i18n.__("errors.invalidURL"));
  }
  public i18n() {
    return "errors.invalidURL";
  }
}

export class NoDataError extends ExtractionError {
  constructor() {
    super(i18n.__("errors.noData"));
  }
  public i18n() {
    return "errors.noData";
  }
}

export class NothingFoundError extends ExtractionError {
  constructor() {
    super(i18n.__("errors.nothingFound"));
  }
  public i18n() {
    return "errors.nothingFound";
  }
}

export class ServiceUnavailableError extends ExtractionError {
  constructor() {
    super(i18n.__("errors.serviceUnavailable"));
  }
  public i18n() {
    return "errors.serviceUnavailable";
  }
}

export class AgeRestrictedError extends ExtractionError {
  constructor() {
    super(i18n.__("errors.ageRestricted"));
  }
  public i18n() {
    return "errors.ageRestricted";
  }
}
