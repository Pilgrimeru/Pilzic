export abstract class ExtractionException {
  public abstract i18n() : string;
}

export class InvalidURLException extends ExtractionException {

  public i18n() {
    return "errors.invalidURL";
  }
}

export class NoDataException  extends ExtractionException {
  
  public i18n() {
    return "errors.noData";
  }
}

export class NothingFoundException extends ExtractionException {

  public i18n() {
    return "errors.nothingFound";
  }
}

export class ServiceUnavailableException  extends ExtractionException {
  
  public i18n() {
    return "errors.serviceUnavailable";
  }
}

export class YoutubeMixesException extends ExtractionException {

  public i18n() {
    return "errors.youtubeMixes";
  }
}