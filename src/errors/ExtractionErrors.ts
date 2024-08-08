import { i18n } from "../i18n.config.js";

export abstract class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
  }
  public abstract i18n(): string;
}

export class InvalidURLError extends ExtractionError {

  constructor() {
    super(i18n.__mf("errors.invalidURL"));
  }
  public i18n() {
    return "errors.invalidURL";
  }
}

export class NoDataError extends ExtractionError {
  constructor() {
    super(i18n.__mf("errors.noData"));
  }
  public i18n() {
    return "errors.noData";
  }
}

export class NothingFoundError extends ExtractionError {
  constructor() {
    super(i18n.__mf("errors.nothingFound"));
  }
  public i18n() {
    return "errors.nothingFound";
  }
}

export class ServiceUnavailableError extends ExtractionError {
  constructor() {
    super(i18n.__mf("errors.serviceUnavailable"));
  }
  public i18n() {
    return "errors.serviceUnavailable";
  }
}

export class AgeRestrictedError extends ExtractionError {
  constructor() {
    super(i18n.__mf("errors.ageRestricted"));
  }
  public i18n() {
    return "errors.ageRestricted";
  }
}

export class YoutubeMixesError extends ExtractionError {
  constructor() {
    super(i18n.__mf("errors.youtubeMixes"));
  }
  public i18n() {
    return "errors.youtubeMixes";
  }
}