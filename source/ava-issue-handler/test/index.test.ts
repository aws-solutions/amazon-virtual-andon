// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Mock AppSync
const mockMutation = jest.fn();
jest.mock('aws-appsync', () => {
  return {
    AUTH_TYPE: { AWS_IAM: 'AWS_IAM' },
    AWSAppSyncClient: jest.fn(() => ({ mutate: mockMutation }))
  };
});

// Mock S3
const mockS3GetObject = jest.fn();
jest.mock('aws-sdk/clients/s3', () => {
  return jest.fn(() => ({
    getObject: mockS3GetObject
  }));
});

// Mock SNS
const mockSnsPublish = jest.fn();
jest.mock('aws-sdk/clients/sns', () => {
  return jest.fn(() => ({
    publish: mockSnsPublish
  }));
});

// Mock DynamoDB
const mockDDBGet = jest.fn();
const mockDDBQuery = jest.fn();
const mockDocumentClient = jest.fn(() => ({
  get: mockDDBGet,
  query: mockDDBQuery
}));

jest.mock('aws-sdk/clients/dynamodb', () => {
  return {
    DocumentClient: mockDocumentClient
  };
});

// Spy on the console messages
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

// Import handler
const index = require('../index');

describe('IoT Topic Events', function () {
  const OLD_ENV = process.env;

  const openEvent = {
    "id": "0012345678",
    "eventId": "eventId",
    "eventDescription": "equipment issue",
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
    "eventDescription": "equipment issue",
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
    process.env = { ...OLD_ENV };
    jest.resetModules();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    mockMutation.mockReset();
    mockSnsPublish.mockReset();
    mockDDBGet.mockReset();
    mockDDBQuery.mockReset();
    mockS3GetObject.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should pass to create an issue', async function () {
    expect.assertions(2);

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
    expect(mockSnsPublish).toHaveBeenCalledWith({
      MessageAttributes: {
        eventId: {
          DataType: 'String',
          StringValue: 'eventId'
        }
      },
      Message: [
        'The following Issue has been raised:',
        'Event: equipment issue',
        'Device: device1',
        '', 'Additional Details', '-----',
        'Site: lhr14',
        'Area: floor1',
        'Process: packaging',
        'Station: station1'
      ].join('\n'),
      TopicArn: 'arn:of:topic'
    })
  });

  it('should pass to update an issue', async function () {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    const event = { ...closedEvent };
    const result = await index.handler(event);
    expect(result).toEqual('Success');
  });

  it('should fail when SNS publishing fails', async function () {
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

  it('should fail when GraphQL mutation fails', async function () {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.reject({ message: 'GraphQL mutation failed.' });
    });

    const event = { ...closedEvent };
    const result = await index.handler(event);
    expect(result).toEqual({ message: 'GraphQL mutation failed.' });
  });
});
