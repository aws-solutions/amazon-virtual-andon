/*********************************************************************************************************************
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

// System environment
process.env.AWS_REGION = 'mock-region-1';
process.env.ACCOUNT_ID = 'mock-account';
process.env.API_ENDPOINT = 'https//graphql.com/graphql';

// Mock AppSync
const mockMutation = jest.fn();
jest.mock('aws-appsync', () => {
  return {
    default: jest.fn(() => ({
      mutate: mockMutation
    }))
  };
});

// Mock AWS SDK
const mockSnsPublish = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    SNS: jest.fn(() => ({
      publish: mockSnsPublish
    })),
    config: jest.fn(() => ({
      credentials: jest.fn(() => {
        return null;
      })
    }))
  };
});
// Import index.js
const index = require('./index.js');

describe('index', function() {
  const openEvent = {
    "id": "0012345678",
    "eventId": "eventId",
    "eventDescription":"equipment issue",
    "type": "equipment issue",
    "priority": "low",
    "topicArn": "arn:of:topic",
    "siteName": "lhr14",
    "processName": "packaging",
    "areaName": "floor1",
    "stationName": "station1",
    "deviceName": "device1",
    "created": "2007-04-05T12:30-02:00",
    "acknowledged": "2007-04-05T12:30-02:00",
    "closed": "2007-04-05T12:30-02:00",
    "status": "open"
  };

  const closedEvent = {
    "id": "0012345678",
    "eventId": "eventId",
    "eventDescription":"equipment issue",
    "type": "equipment issue",
    "priority": "low",
    "topicArn": "arn:of:topic",
    "siteName": "lhr14",
    "processName": "packaging",
    "areaName": "floor1",
    "stationName": "station1",
    "deviceName": "device1",
    "created": "2007-04-05T12:30-02:00",
    "acknowledged": "2007-04-05T12:30-02:00",
    "closed": "2007-04-05T12:30-02:00",
    "status": "closed"
  };

  beforeEach(() => {
    mockMutation.mockReset();
    mockSnsPublish.mockReset();
  });

  it('should pass to create an issue', async function() {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    // Mock AWS SDK
    mockSnsPublish.mockImplementation(() => {
      return {
        promise() {
          // sns:Publish
          return Promise.resolve({ MessageId: 'Success' });
        }
      };
    });

    const event = { ...openEvent };
    const result = await index.handler(event);
    expect(result).toEqual('Success');
  });

  it('should pass to update an issue', async function() {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    const event = { ...closedEvent };
    const result = await index.handler(event);
    expect(result).toEqual('Success');
  });

  it('should fail when SNS publishing fails', async function() {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    // Mock AWS SDK
    mockSnsPublish.mockImplementation(() => {
      return {
        promise() {
          // sns:Publish
          return Promise.reject({ message: 'Publish failed.' });
        }
      };
    });

    const event = { ...openEvent };
    const result = await index.handler(event);
    expect(result).toEqual({ message: 'Publish failed.' });
  });

  it('should fail when GraphQL mutation fails', async function() {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.reject({ message: 'GraphQL mutation failed.' });
    });

    const event = { ...closedEvent };
    const result = await index.handler(event);
    expect(result).toEqual({ message: 'GraphQL mutation failed.' });
  });

  it('should pass to create an issue without publishing SNS message', async function() {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    const event = { ...openEvent };
    event.topicArn = '';
    const result = await index.handler(event);
    expect(result).toEqual('Success');
  });
});
