// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CognitoTriggerSource, CognitoUserStatus, IHandlerInput } from '../lib/utils';

// Mock context
const context = {
  logStreamName: 'log-stream'
};

// Spy on the console messages
const consoleInfoSpy = jest.spyOn(console, 'info');
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

describe('cognito-trigger', function () {
  it('should log the event and return it for non federated users', async function () {
    expect.assertions(2);

    // Import handler
    const index = require('../index');

    const event: IHandlerInput = {
      userPoolId: 'user-pool-id',
      userName: 'user-name',
      triggerSource: 'trigger-src',
      request: {
        userAttributes: {
          "cognito:user_status": 'CONFIRMED',
          email_verified: 'false',
          identities: '',
          sub: 'user-uuid'
        }
      }
    };

    const result = await index.handler(event, context);
    expect(result).toEqual(event);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Received event', JSON.stringify(event, null, 2));
  });

  it('should log the event and return it for federated users', async function () {
    expect.assertions(3);

    // Import handler
    const index = require('../index');

    const event: IHandlerInput = {
      userPoolId: 'user-pool-id',
      userName: 'user-name',
      triggerSource: CognitoTriggerSource.POST_CONFIRM,
      request: {
        userAttributes: {
          "cognito:user_status": CognitoUserStatus.EXTERNAL_PROVIDER,
          email_verified: 'false',
          identities: '',
          sub: 'user-uuid'
        }
      }
    };

    const result = await index.handler(event, context);
    expect(result).toEqual(event);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Received event', JSON.stringify(event, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Handling federated user');
  });
});