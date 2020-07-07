/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/* eslint-disable */
// Import React and Amplify packages
import { Logger } from '@aws-amplify/core';

// Import packages
import axios from 'axios';

// Import locale JSON file
import localeJson from './locale.json';

// Import custom setting
import { SortBy } from '../components/Enums';

// Declare Amazon Virtual Andon console configuration
declare var andon_config: any;

// Global logging level
export const LOGGING_LEVEL = 'DEBUG';

// Local constant variables
const LOGGER = new Logger('CustomUtil', LOGGING_LEVEL);
const LOCALE = 'en';

// File upload size limit - 10KB
export const FILE_SIZE_LIMIT = 10 * 1024;

/**
 * Custom error class.
 * @class CustomError
 */
export class CustomError extends Error {
  errorType: string;

  constructor(error: {errorType: string, message: string}) {
    super(error.message);
    this.errorType = error.errorType;
  }
}

/**
 * Get the locale string for the source string.
 * If there's no locale string, it will return the provided source string.
 * @param {string} sourceString - Source string to get locale string
 * @return {string} The locale string of the source string
 */
export function getLocaleString(sourceString: string): string {
  try {
    const localeDictionary: any = localeJson;
    if (!localeDictionary[LOCALE]) {
      return sourceString;
    }

    let localeString: string = localeDictionary[LOCALE][sourceString];
    if (!localeString) {
      localeString = sourceString;
    }

    return localeString;
  } catch (error) {
    LOGGER.error('error: ', error);
    return sourceString;
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
 * @return {boolean} Validated result
 */
export function validateGeneralInput(input: string): boolean {
  const regex = /^[a-zA-Z0-9- _/#]{4,40}$/;
  return regex.test(input);
}

/**
 * Validate the phone number.
 * @param {string} phoneNumber - Phone number to validate
 * @return {boolean} Validated result
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  const regex = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
  return regex.test(phoneNumber);
}

/**
 * Validate the E-Mail address.
 * @param {string} emailAddress - E-Mail address to validate
 * @return {boolean} Validated result
 */
export function validateEmailAddress(emailAddress: string): boolean {
  const regex = /^[_a-z0-9-]+(\.[_a-z0-9-]+)*(\+[a-z0-9-]+)?@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(emailAddress);
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
 * Convert seconds to HH hours MM minutes SS seconds format.
 * @param {number} seconds - Seconds to convert to hours, minutes, and seconds
 * @return {string} Converted format string
 */
export function convertSecondsToHms(seconds: number): string {
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor(seconds % 3600 / 60);
  const second = Math.floor(seconds % 3600 % 60);

  const hourString = hour > 0 ? `${hour} hour(s) ` : '';
  const minuteString = minute > 0 ? `${minute} minute(s) ` : '';
  const secondString = second > 0 ? `${second} second(s)` : '';

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
    /Invalid.*password.*format/i.test(message) // Invalid password format
    || /validation.*error.*password.*constraint/i.test(message) // 1 validation error detected: Value at 'password' failed to satisfy constraint: Member must have length greater than or equal to 6
    || /Password.*policy/i.test(message) // Password does not conform to policy: Password not long enough
  ) {
    message = 'Password policy - minimum length 8, uppercase letters, lowercase letters, special characters, numbers';
  } else if (
    /Only.*radix.*supported/i.test(message) // Only radix 2, 4, 8, 16, 32 are supported
    || /validation.*error.*userName.*constraint/i.test(message) // 2 validation errors detected: Value '' at 'userName' failed to satisfy constraint: Member must satisfy regular expression pattern: [\p{L}\p{M}\p{S}\p{N}\p{P}]+; Value '' at 'userAlias' failed to satisfy constraint: Member must satisfy regular expression pattern: [\p{L}\p{M}\p{S}\p{N}\p{P}]+
  ) {
    message = 'Incorrect username or password.';
  }

  return getLocaleString(message);
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