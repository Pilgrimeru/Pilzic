import i18n from 'i18n';
import path from 'path';
import { config } from './config.js';

const __dirname = path.dirname(import.meta.filename);

i18n.configure({

  locales: ['en', 'fr'],

  defaultLocale: 'en',

  queryParameter: 'lang',

  retryInDefaultLocale: true,

  objectNotation: true,

  register: global,

  directory: path.join(__dirname, "locales"),

});

i18n.setLocale(config.LOCALE);

export { i18n };

