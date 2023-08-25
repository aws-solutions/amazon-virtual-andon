// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
// Import Amplify packages
import { I18n } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import packages
import axios from 'axios';

// Import custom setting
import { SortBy } from '../components/Enums';

// Import Subscription types for the application and various views
import { AppSubscriptionTypes } from '../App';
import { ClientSubscriptionTypes } from '../views/Client';
import { EventSubscriptionTypes } from '../views/Event';
import { ObserverSubscriptionTypes } from '../views/Observer';

// Declare Amazon Virtual Andon console configuration
declare let andon_config: any;

// Global logging level
export const LOGGING_LEVEL = 'DEBUG';

// Local constant variables
const LOGGER = new Logger('CustomUtil', LOGGING_LEVEL);

// File upload size limit - 10KB
export const FILE_SIZE_LIMIT = 10 * 1024;

/**
 * Custom error class.
 * @class CustomError
 */
export class CustomError extends Error {
  errorType: string;

  constructor(error: { errorType: string, message: string }) {
    super(error.message);
    this.errorType = error.errorType;
  }
}

/**
 * Send an anonymous metirc.
 * @param {object} data - Data to send an anonymous metric
 */
export async function sendMetrics(data: object) {
  if (andon_config.solutions_send_metrics === 'Yes') {
    const uuid = andon_config.solutions_solutionUuId;
    const body = {
      Data: {
        Resource: data,
        Region: andon_config.aws_project_region
      },
      Version: andon_config.solutions_version,
      Solution: andon_config.solutions_solutionId,
      TimeStamp: `${new Date().toISOString().replace(/T/, ' ')}`,
      UUID: uuid
    };
    const headers = { headers: { 'Content-Type': 'application/json' } };

    try {
      await axios.post(andon_config.solutions_metrics_endpoint, body, headers);
    } catch (error) {
      LOGGER.error('Error in sending anonymous metrics.', error);
    }
  }
}

/**
 * Validate the general input string.
 * @param {string} input - String to validate
 * @param {number} minLength - Minimum input length
 * @param {number} maxLength - Maximum input length
 * @param {string} allowedSpecialCharacters - Allowed special characters
 * @return {boolean} Validated result
 */
export function validateGeneralInput(input: string, minLength: number, maxLength: number, allowedSpecialCharacters: string): boolean {
  if (input === '' && minLength === 0) { return true; }

  // Due to supporting multi-languages since v2.1, removed alphanumeric validation.
  if (input.length > maxLength || input.length < minLength || input.trimStart().trimEnd() === '') {
    return false;
  }

  let allowedSpecialCharactersCode: number[] = [];
  for (let i = 0, length = allowedSpecialCharacters.length; i < length; i++) {
    allowedSpecialCharactersCode.push(allowedSpecialCharacters.charCodeAt(i));
  }

  if (allowedSpecialCharactersCode.length > 0) {
    for (let i = 0, length = input.length; i < length; i++) {
      let ch = input.charCodeAt(i);
      if (
        (ch >= 32 && ch <= 47) || // [space] to "/"
        (ch >= 58 && ch <= 64) || // ":" to "@"
        (ch >= 91 && ch <= 96) || // "[" to "`"
        (ch >= 123 && ch <= 127) // "{" to the end of ASCII
      ) {
        if (!allowedSpecialCharactersCode.includes(ch)) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Validates a phone number
 * @param phoneNumber Phone number to validate
 * @param emptyStringIsValid Flag for whether an empty string should evaluate to true
 * @returns Boolean indicating whether the supplied string is a valid phone number
 */
export function validatePhoneNumber(phoneNumber: string, emptyStringIsValid = false): boolean {
  if (emptyStringIsValid && phoneNumber === '') { return true; }

  const regex = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;  // NOSONAR: typescript:S4784 - Valid regex for phone number
  return validateUniqueListAndRegex(phoneNumber, ',', regex);
}

/**
 * Validate an E-Mail address
 * @param emailAddress E-Mail address to validate
 * @param emptyStringIsValid Flag for whether an empty string should evaluate to true
 * @returns Boolean indicating whether the supplied string is a valid email address
 */
export function validateEmailAddress(emailAddress: string, emptyStringIsValid = false): boolean {
  if (emptyStringIsValid && emailAddress === '') { return true; }

  const regex = /^[_a-z0-9-]+(\.[_a-z0-9-]+)*(\+[a-z0-9-]+)?@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // NOSONAR: typescript:S4784 - Valid regex for email
  return validateUniqueListAndRegex(emailAddress, ',', regex);
}

/**
 * Splits `testStr` by the `delimiter` and returns whether each value passes the RegEx test
 * @param testStr The string with the list of strings to evaluate
 * @param delimiter The delimiter to split `testStr` by
 * @param regexStr The RegExp to validate each item in the testStr againist
 * @param trimWhitespace Boolean indicating whether each token after splitting `testStr` by the `delimiter` should be trimmed of whitespace
 * @returns booolean
 */
function validateUniqueListAndRegex(testStr: string, delimiter: string, regexStr: RegExp, trimWhitespace: boolean = true): boolean {
  // Split by the delimiter
  let splitTestStr = testStr.split(delimiter);

  if (trimWhitespace) {
    splitTestStr = splitTestStr.map(s => s.trim());
  }

  for (const token of splitTestStr) {
    if (!regexStr.test(token)) {
      return false;
    }
  }

  // Ensure there are no duplicates
  if (new Set<string>(splitTestStr).size !== splitTestStr.length) {
    return false;
  }

  return true;
}

/**
 * Add ISO time offset to the provided date.
 * @param {Date} date - Date to add ISO time offset
 * @return {string} ISO time offset added date
 */
export function addISOTimeOffset(date: Date): string {
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
}

/**
 * Get previous day.
 * @param {Date} date - Source date
 * @param {number} day - Days
 * @param {number} hours - Hours
 * @param {number} minutes - Minutes
 * @param {number} seconds - Seconds
 * @param {number} milliseconds - Milliseconds
 */
export function getPreviousDays(date: Date, day: number, hours: number, minutes: number, seconds: number, milliseconds: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + day,
    hours,
    minutes,
    seconds,
    milliseconds
  );
}

/**
 * Convert seconds to HH hours MM minutes SS seconds format in selected language.
 * @param {number} seconds - Seconds to convert to hours, minutes, and seconds
 * @return {string} Converted format string
 */
export function convertSecondsToHms(seconds: number): string {
  if (seconds < 1) { return 'Just now'; }
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor(seconds % 3600 / 60);
  const second = Math.floor(seconds % 3600 % 60);

  const hourString = hour > 0 ? `${hour} ${I18n.get('text.time.hours')} ` : '';
  const minuteString = minute > 0 ? `${minute} ${I18n.get('text.time.minutes')} ` : '';
  const secondString = second > 0 ? `${second} ${I18n.get('text.time.seconds')}` : '';

  return hourString.concat(minuteString, secondString);
}

/**
 * Sort a data ascending or descending order.
 * @param {any[]} data - Data to sort
 * @param {SoryBy} sortBy - Sort by ascending or descending
 * @param {string} sortKey - Sort key
 * @param {string | undefined} keyType - Sort key type
 * @return {any[]} Sorted data
 */
export function sortByName(data: any[], sortBy: SortBy, sortKey: string, keyType?: string): any[] {
  if (sortBy === SortBy.Asc) {
    if (keyType === 'number') {
      return data.sort((a, b) => (a[sortKey] ? a[sortKey] : 0) - (b[sortKey] ? b[sortKey] : 0));
    } else {
      return data.sort((a, b) => (a[sortKey] ? a[sortKey] : '').localeCompare(b[sortKey] ? b[sortKey] : ''));
    }
  } else {
    if (keyType === 'number') {
      return data.sort((a, b) => (b[sortKey] ? b[sortKey] : 0) - (a[sortKey] ? a[sortKey] : 0));
    } else {
      return data.sort((a, b) => (b[sortKey] ? b[sortKey] : '').localeCompare(a[sortKey] ? a[sortKey] : ''));
    }
  }
}

/**
 * Amplify provides some translated error messages, so some messages needs to be translated.
 * @param {string} message - Error message
 * @return {string} Custom error message
 */
export function getAmplifyCustomErrorMessage(message: string): string {
  if (
    /Invalid.*password.*format/i.test(message) // NOSONAR: typescript:S4784 - Invalid password format
    || /validation.*error.*password.*constraint/i.test(message) // NOSONAR: typescript:S4784 - 1 validation error detected: Value at 'password' failed to satisfy constraint: Member must have length greater than or equal to 6
    || /Password.*policy/i.test(message) // Password does not conform to policy: Password not long enough
  ) {
    message = 'error.cognito.password.policy';
  } else if (
    /Only.*radix.*supported/i.test(message) // NOSONAR: typescript:S4784 - Only radix 2, 4, 8, 16, 32 are supported
    || /validation.*error.*userName.*constraint/i.test(message) // NOSONAR: typescript:S4784 - 2 validation errors detected: Value '' at 'userName' failed to satisfy constraint: Member must satisfy regular expression pattern: [\p{L}\p{M}\p{S}\p{N}\p{P}]+; Value '' at 'userAlias' failed to satisfy constraint: Member must satisfy regular expression pattern: [\p{L}\p{M}\p{S}\p{N}\p{P}]+
  ) {
    message = 'error.cognito.incorrect.username.password';
  }

  return I18n.get(message);
}

/**
 * This returns the validation class name for input form.
 * @param {string} value - String value to check if it is empty
 * @param {boolean} isValid - Boolean value to check if the value is valid
 */
export function getInputFormValidationClassName(value: string, isValid: boolean): string {
  if (value === '') {
    return '';
  } else {
    return isValid ? 'is-valid' : 'is-invalid';
  }
}

/**
 * Make every data visible.
 * @param {any[]} data - Data to make visible
 */
export function makeAllVisible(data: any[]) {
  for (const datum of data) {
    datum.visible = true;
  }
}

/**
 * Make data visible when it matches search keyword.
 * @param {any[]} data - Data to filter by search keyword
 * @param {string} searchKey - Search key
 * @param {string} searchKeyword - Search keyword
 */
export function makeVisibleBySearchKeyword(data: any[], searchKey: string, searchKeyword: string) {
  for (const datum of data) {
    if (searchKeyword === '' || datum[searchKey].toLowerCase().includes(searchKeyword.toLowerCase())) {
      datum.visible = true;
    } else {
      datum.visible = false;
    }
  }
}

type SubscriptionTypes = AppSubscriptionTypes | ClientSubscriptionTypes | EventSubscriptionTypes | ObserverSubscriptionTypes;
type ConfigureSubscriptionFn = (subscriptionType: any, delayMS: number) => Promise<void>;

/**
 * Will attempt to reestablish the subscription if the error was due to a socket closing. If the max delay (1000ms) is reached or there was a different error, the page will be reloaded
 * @param err The error that was caught from the subscription
 * @param subscriptionType The type of subscription
 * @param configureSubscriptionFn The function from within the App/View that will handle configuring the subscription
 * @param delayMS Amount of time to wait before reestablishing the subscription if the socket connection is lost
 */
export async function handleSubscriptionError(err: any, subscriptionType: SubscriptionTypes, configureSubscriptionFn: ConfigureSubscriptionFn, delayMS: number) {
  console.error(err);

  const MAX_DELAY_MS = 1000;
  if (delayMS > MAX_DELAY_MS) {
    // Exponential backoff has reached the limit we've defined; reload the page
    window.location.reload();
  } else if (err.error && err.error.errors && err.error.errors[0] && err.error.errors[0].message === 'Connection closed') {
    // An AppSync subscription has lost its connection
    setTimeout(async () => { await configureSubscriptionFn(subscriptionType, delayMS * 2) }, delayMS);
  } else if (delayMS <= MAX_DELAY_MS && err.error && typeof err.error === 'string' && err.error.toLowerCase().includes('disconnected')) {
    // An IoT subscription has lost its connection
    setTimeout(async () => { await configureSubscriptionFn(subscriptionType, delayMS * 2) }, delayMS);
  } else {
    // Otherwise, reload the page
    window.location.reload();
  }
}
