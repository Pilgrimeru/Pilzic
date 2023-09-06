export abstract class ExtractionError {
  public abstract i18n() : string;
}

export class InvalidURLError extends ExtractionError {

  public i18n() {
    return "errors.invalidURL";
  }
}

export class NoDataError  extends ExtractionError {
  
  public i18n() {
    return "errors.noData";
  }
}

export class NothingFoundError extends ExtractionError {

  public i18n() {
    return "errors.nothingFound";
  }
}

export class ServiceUnavailableError  extends ExtractionError {
  
  public i18n() {
    return "errors.serviceUnavailable";
  }
}

export class YoutubeMixesError extends ExtractionError {

  public i18n() {
    return "errors.youtubeMixes";
  }
}