// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
import Logger, { LoggingLevel as LogLevel } from '../solution-utils/logger';
import { CognitoTriggerSource, CognitoUserStatus, IHandlerInput } from './lib/utils';

const { AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL } = process.env;

const logger = new Logger(AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL);

/**
 * Request handler.
 */
export async function handler(event: IHandlerInput): Promise<any> {
  logger.log(LogLevel.INFO, 'Received event', JSON.stringify(event, null, 2));

  if (event.triggerSource === CognitoTriggerSource.POST_CONFIRM && event.request.userAttributes['cognito:user_status'] === CognitoUserStatus.EXTERNAL_PROVIDER) {
    // Add your implementation here to handle users that came from an external provider. For example, add them to
    // default groups or set permissions in Amazon Virtual Andon 
    logger.log(LogLevel.INFO, 'Handling federated user');
  }

  return event;
}
