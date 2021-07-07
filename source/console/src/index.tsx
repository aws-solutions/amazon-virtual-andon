// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { CookiesProvider, Cookies } from 'react-cookie';
import ReactDOM from 'react-dom';
import { I18n } from 'aws-amplify';

// Import App
import App from './App';

// Import style sheets
import './assets/css/style.scss';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'chartist/dist/chartist.min.css';

// Import language files
import de from './util/lang/de.json'; // German
import en from './util/lang/en.json'; // English
import es from './util/lang/es.json'; // Spanish (Spain)
import fr from './util/lang/fr.json'; // French (France)
import ja from './util/lang/ja.json'; // Japanese
import ko from './util/lang/ko.json'; // Korean
import zh from './util/lang/zh.json'; // Chinese (Simplified)

const dict: any = {
  de, en, es, fr, ja, ko, zh
};
I18n.putVocabularies(dict);

// Declare Amazon Virtual Andon console configuration
declare var andon_config: any;

// Set the default locale cookie
const cookies = new Cookies();
const locale = cookies.get('ui_locale');
if (locale === undefined) {
  let defaultLanguageConfig = andon_config.default_language;
  let localLanguage = '';

  switch (defaultLanguageConfig) {
    case 'Browser Default':
      localLanguage = navigator.language.slice(0, 2);
      break;
    case 'Chinese (Simplified)':
      localLanguage = 'zh';
      break;
    case 'English':
      localLanguage = 'en';
      break;
    case 'French (France)':
      localLanguage = 'fr';
      break;
    case 'German':
      localLanguage = 'de';
      break;
    case 'Japanese':
      localLanguage = 'ja';
      break;
    case 'Korean':
      localLanguage = 'ko';
      break;
    case 'Spanish (Spain)':
      localLanguage = 'es';
      break;
    default:
      localLanguage = 'en';
      break;
  }

  localLanguage = dict[localLanguage] ? localLanguage : 'en';
  I18n.setLanguage(localLanguage);

  let cookieExpires = new Date();
  cookieExpires.setFullYear(cookieExpires.getFullYear() + 20);
  cookies.set('ui_locale', localLanguage, { expires: cookieExpires, path: '/', secure: true });
  window.location.reload();
} else {
  I18n.setLanguage(locale);
}

ReactDOM.render(
  <CookiesProvider>
    <App />
  </CookiesProvider>,
  document.getElementById('root')
);