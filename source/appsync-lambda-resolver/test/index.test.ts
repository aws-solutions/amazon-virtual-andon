// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IAppSyncResolverRequest } from '../lib/utils';
import moment from 'moment';

// Mock SNS
const mockSnsSubscribe = jest.fn();
const mockSnsSetSubscriptionAttributes = jest.fn();
jest.mock('aws-sdk/clients/sns', () => {
  return jest.fn(() => ({
    subscribe: mockSnsSubscribe,
    setSubscriptionAttributes: mockSnsSetSubscriptionAttributes
  }));
});

// Mock DynamoDB
const mockDDBGet = jest.fn();
const mockDDBPut = jest.fn();
const mockDDBQuery = jest.fn();
const mockDocumentClient = jest.fn(() => ({
  get: mockDDBGet,
  put: mockDDBPut,
  query: mockDDBQuery
}));

jest.mock('aws-sdk/clients/dynamodb', () => {
  return {
    DocumentClient: mockDocumentClient
  };
});

// Spy on the console messages
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleInfoSpy = jest.spyOn(console, 'info');
const consoleDebugSpy = jest.spyOn(console, 'debug');
const consoleErrorSpy = jest.spyOn(console, 'error');
const consoleWarnSpy = jest.spyOn(console, 'warn');

// Import handler
const index = require('../index');

const testEvent: IAppSyncResolverRequest = {
  arguments: { previousEmail: '', previousSms: '' },
  identity: {},
  info: { parentTypeName: 'Mutation', fieldName: 'createEvent' },
  request: {},
  prev: {
    result: {
      id: 'event-id',
      email: 'email+1@example.com, email+2@example.com',
      sms: '+1, +2'
    }
  }
};

describe('Mutation: Create event', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should exit successfully if no SNS subscriptions are configured', async function () {
    expect.assertions(5);

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.prev.result.email = '';
    testEventCopy.prev.result.sms = '';

    await index.handler(testEventCopy);

    expect(consoleInfoSpy).toHaveBeenCalledTimes(4);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 0');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 0 subscription(s) to clean');
  });

  it('should create subscriptions of both types when the subscriptions didn\'t previously exist', async function () {
    expect.assertions(25);

    mockDDBGet.mockImplementation(() => returnPromiseWith({}));
    mockDDBPut.mockImplementation(() => returnPromiseWith({}));
    mockSnsSubscribe.mockImplementation(() => returnPromiseWith({ SubscriptionArn: 'arn:of:subscription' }));

    const resp = await index.handler(testEvent);

    expect(resp).toEqual(testEvent.prev.result);

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Subscribing to the topic
    expect(mockSnsSubscribe).toHaveBeenCalledWith({ Endpoint: '+1', Protocol: 'sms', Attributes: { FilterPolicy: JSON.stringify({ eventId: ['placeholder-event-id', 'event-id'] }) }, TopicArn: 'arn:of:topic', ReturnSubscriptionArn: true });
    expect(mockSnsSubscribe).toHaveBeenCalledWith({ Endpoint: '+2', Protocol: 'sms', Attributes: { FilterPolicy: JSON.stringify({ eventId: ['placeholder-event-id', 'event-id'] }) }, TopicArn: 'arn:of:topic', ReturnSubscriptionArn: true });
    expect(mockSnsSubscribe).toHaveBeenCalledWith({ Endpoint: 'email+1@example.com', Protocol: 'email', Attributes: { FilterPolicy: JSON.stringify({ eventId: ['placeholder-event-id', 'event-id'] }) }, TopicArn: 'arn:of:topic', ReturnSubscriptionArn: true });
    expect(mockSnsSubscribe).toHaveBeenCalledWith({ Endpoint: 'email+2@example.com', Protocol: 'email', Attributes: { FilterPolicy: JSON.stringify({ eventId: ['placeholder-event-id', 'event-id'] }) }, TopicArn: 'arn:of:topic', ReturnSubscriptionArn: true });

    // Persisting the subscription ARN
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: 'email+1@example.com', protocol: 'email', subscriptionArn: 'arn:of:subscription', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] } } });
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: 'email+2@example.com', protocol: 'email', subscriptionArn: 'arn:of:subscription', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] } } });
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: '+1', protocol: 'sms', subscriptionArn: 'arn:of:subscription', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] } } });
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: '+2', protocol: 'sms', subscriptionArn: 'arn:of:subscription', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] } } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(16);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEvent, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 4');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling subscription #1 of 4 total subscriptions');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Subscription did not exist. It will need to be created');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 0 subscription(s) to clean');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Persisting subscription details in the Data Hierarchy table');

    // Expected misc logging
    expect(consoleDebugSpy).toHaveBeenCalledTimes(28);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
  });

  it('should update subscriptions of both types when the subscriptions previously existed', async function () {
    expect.assertions(18);

    mockDDBGet.mockImplementation(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBPut.mockImplementation(() => returnPromiseWith({}));
    mockSnsSetSubscriptionAttributes.mockImplementation(() => returnPromiseWith({}));

    const resp = await index.handler(testEvent);

    expect(resp).toEqual(testEvent.prev.result);

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Persisting the subscription ARN
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: 'endpoint-from-ddb', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: 'endpoint-from-ddb', protocol: 'protocol-from-ddb', subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] } } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(20);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEvent, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 4');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling subscription #1 of 4 total subscriptions');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Subscription already existed');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 0 subscription(s) to clean');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Persisting subscription details in the Data Hierarchy table');

    // Expected misc logging
    expect(consoleDebugSpy).toHaveBeenCalledTimes(28);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
  });

  it('should exit successfully if no updates need to be performed', async function () {
    expect.assertions(16);

    mockDDBGet.mockImplementation(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));

    const resp = await index.handler(testEvent);

    expect(resp).toEqual(testEvent.prev.result);

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(16);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEvent, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 4');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling subscription #1 of 4 total subscriptions');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Filter policy already included event ID (event-id). No need to update');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 0 subscription(s) to clean');

    // Expected misc logging
    expect(consoleDebugSpy).toHaveBeenCalledTimes(12);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
  });

  it('should clean up old subscriptions that are no longer needed', async function () {
    expect.assertions(20);

    // Checking current event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));

    // Cleaning previous event subscriptions
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'old:arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'old:arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockSnsSetSubscriptionAttributes.mockImplementation(() => returnPromiseWith({}));
    mockDDBPut.mockImplementation(() => returnPromiseWith({}));

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.arguments.previousEmail = 'old.email@example.com, email+1@example.com';
    testEventCopy.arguments.previousSms = '+3, +2';

    const resp = await index.handler(testEventCopy);

    expect(resp).toEqual(testEventCopy.prev.result);

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Cleaning previous subscriptions
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'old.email@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+3', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: 'endpoint-from-ddb', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: 'endpoint-from-ddb', protocol: 'protocol-from-ddb', subscriptionArn: 'old:arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id'] } } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(18);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 4');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling subscription #1 of 4 total subscriptions');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Filter policy already included event ID (event-id). No need to update');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 2 subscription(s) to clean');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling #1 of 2 subscription(s) to clean');

    // Expected misc logging
    expect(consoleDebugSpy).toHaveBeenCalledTimes(24);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
  });

  it('should clean up all subscriptions when the event is deleted', async function () {
    expect.assertions(15);

    // Checking current event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));

    // Cleaning previous event subscriptions
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'old:arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'old:arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockSnsSetSubscriptionAttributes.mockImplementation(() => returnPromiseWith({}));
    mockDDBPut.mockImplementation(() => returnPromiseWith({}));

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.info.fieldName = 'deleteEvent';

    const resp = await index.handler(testEventCopy);

    expect(resp).toEqual(testEventCopy.prev.result);

    // Cleaning previous subscriptions
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: 'endpoint-from-ddb', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: 'endpoint-from-ddb', protocol: 'protocol-from-ddb', subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id'] } } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(7);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 4 subscription(s) to clean');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling #1 of 4 subscription(s) to clean');

    // Expected misc logging
    expect(consoleDebugSpy).toHaveBeenCalledTimes(24);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
  });
});

describe('Query: `getPrevDayIssuesStats`', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should return all zeroes for aggregated stats if no results come from DynamoDB', async function () {
    expect.assertions(7);

    mockDDBQuery.mockImplementation(() => returnPromiseWith({}));

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.info.parentTypeName = 'Query';
    testEventCopy.info.fieldName = 'getPrevDayIssuesStats';

    const resp = await index.handler(testEventCopy);

    expect(resp).toEqual({ open: 0, closed: 0, acknowledged: 0, lastThreeHours: 0 });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(3);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
  });

  it('should return the sum of all categories', async function () {
    expect.assertions(7);

    mockDDBQuery.mockImplementation(() => returnPromiseWith({
      Items: [
        { id: 'id', status: 'open', createdAt: moment.utc().subtract(2, 'seconds').toISOString() },
        { id: 'id', status: 'closed', createdAt: moment.utc().subtract(2, 'seconds').toISOString() },
        { id: 'id', status: 'acknowledged', createdAt: moment.utc().subtract(1, 'day').toISOString() }
      ]
    }));

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.info.parentTypeName = 'Query';
    testEventCopy.info.fieldName = 'getPrevDayIssuesStats';

    const resp = await index.handler(testEventCopy);

    expect(resp).toEqual({ open: 2, closed: 2, acknowledged: 2, lastThreeHours: 4 });
    expect(consoleInfoSpy).toHaveBeenCalledTimes(3);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(2);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(0);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
  });
});

describe('Error checking', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should throw an error if an unexpected fieldName is sent (mutation)', async function () {
    expect.assertions(2);

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.info.fieldName = 'unexpectedFieldName';

    try {
      await index.handler(testEventCopy);
    } catch (err) {
      expect(err.message).toBe('Unsupported Mutation field name: unexpectedFieldName');
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
  });

  it('should throw an error if an unexpected fieldName is sent (query)', async function () {
    expect.assertions(2);

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.info.parentTypeName = 'Query';
    testEventCopy.info.fieldName = 'unexpectedFieldName';

    try {
      await index.handler(testEventCopy);
    } catch (err) {
      expect(err.message).toBe('Unsupported Query field name: unexpectedFieldName');
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
  });

  it('should throw an error if an unexpected parentTypeName is sent', async function () {
    expect.assertions(2);

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.info.parentTypeName = 'unexpected';

    try {
      await index.handler(testEventCopy);
    } catch (err) {
      expect(err.message).toBe('Unsupported parent type name: unexpected');
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
  });

  it('should throw an error if the `prev` item is invalid', async function () {
    expect.assertions(8);

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    delete testEventCopy.prev.result.id;

    try {
      await index.handler(testEventCopy);
    } catch (err) {
      expect(err.message).toBe('Event ID from previous AppSync function was not present');
    }

    delete testEventCopy.prev.result;
    try {
      await index.handler(testEventCopy);
    } catch (err) {
      expect(consoleErrorSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Details from previous AppSync function were not present');
      expect(err.message).toBe('Unable to retrieve new Event details');
    }

    delete testEventCopy.prev;
    try {
      await index.handler(testEventCopy);
    } catch (err) {
      expect(consoleErrorSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Details from previous AppSync function were not present');
      expect(err.message).toBe('Unable to retrieve new Event details');
    }

    try {
      await index.handler(null);
    } catch (err) {
      expect(consoleErrorSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Event input was null or undefined');
      expect(err.message).toBe('Invalid handler input');
    }

    expect(consoleInfoSpy).toHaveBeenCalledTimes(4);
  });

  it('should pass through if old subscriptions to clean did not have valid data', async function () {
    expect.assertions(22);

    // Checking current event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));

    // Cleaning previous event subscriptions
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'old:arn:from:ddb' } }));
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockSnsSetSubscriptionAttributes.mockImplementation(() => returnPromiseWith({}));

    const testEventCopy = JSON.parse(JSON.stringify(testEvent));
    testEventCopy.arguments.previousEmail = 'old.email@example.com, email+1@example.com';
    testEventCopy.arguments.previousSms = '+3, +2, +4';

    const resp = await index.handler(testEventCopy);

    expect(resp).toEqual(testEventCopy.prev.result);

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Cleaning previous subscriptions
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'old.email@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+3', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+4', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(19);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEventCopy, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 4');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling subscription #1 of 4 total subscriptions');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Filter policy already included event ID (event-id). No need to update');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 3 subscription(s) to clean');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling #1 of 3 subscription(s) to clean');

    // Expected misc logging
    expect(consoleDebugSpy).toHaveBeenCalledTimes(21);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Previous subscription either did not exist in the data hierarchy table or there was no filter policy');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Previous subscription from data hierarchy table did not include the current event ID');
  });

  it('should re-throw the error if an unexpected error happens when updating a subscription', async function () {
    expect.assertions(11);

    mockDDBGet.mockImplementation(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBPut.mockImplementation(() => returnPromiseWith({}));
    mockSnsSetSubscriptionAttributes.mockImplementation(() => returnPromiseWith({ statusCode: 500, code: 'InternalError', message: 'unexpected error happened' }, true));

    try {
      await index.handler(testEvent);
    } catch (err) {
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('InternalError');
      expect(err.message).toBe('unexpected error happened');
    }

    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEvent, null, 2));

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Expected misc logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(5);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(4);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Unable to update subscription', { statusCode: 500, code: 'InternalError', message: 'unexpected error happened' });
  });

  it('should create a new subscription if updating a previous one fails due to a \'NotFound\' (404) error', async function () {
    expect.assertions(20);

    mockDDBGet.mockImplementation(() => returnPromiseWith({ Item: { subscriptionArn: 'arn:from:ddb', filterPolicy: { eventId: ['placeholder-event-id'] }, protocol: 'protocol-from-ddb', endpoint: 'endpoint-from-ddb' } }));
    mockDDBPut.mockImplementation(() => returnPromiseWith({}));
    mockSnsSetSubscriptionAttributes.mockImplementation(() => returnPromiseWith({ statusCode: 404, code: 'NotFound', message: 'Subscription was not found' }, true));
    mockSnsSubscribe.mockImplementation(() => returnPromiseWith({ SubscriptionArn: 'arn:of:new:subscription' }));

    const resp = await index.handler(testEvent);

    expect(resp).toEqual(testEvent.prev.result);

    // Checking if subscriptions previously existed
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+1@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: 'email+2@example.com', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+1', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });
    expect(mockDDBGet).toHaveBeenCalledWith({ TableName: 'data-table', Key: { id: '+2', type: 'ISSUE_TOPIC_SUBSCRIPTION' } });

    // Persisting the subscription ARN
    expect(mockDDBPut).toHaveBeenCalledWith({ TableName: 'data-table', Item: { id: 'endpoint-from-ddb', type: 'ISSUE_TOPIC_SUBSCRIPTION', endpoint: 'endpoint-from-ddb', protocol: 'protocol-from-ddb', subscriptionArn: 'arn:of:new:subscription', filterPolicy: { eventId: ['placeholder-event-id', 'event-id'] } } });

    // Expected info logging
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Received event', JSON.stringify(testEvent, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Total number of subscriptions for event: 4');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Handling subscription #1 of 4 total subscriptions');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Subscription already existed');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Checking if event had previous subscriptions that need to be cleaned');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Found 0 subscription(s) to clean');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Persisting subscription details in the Data Hierarchy table');
    expect(consoleInfoSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Unable to update the previous subscription filter. Creating a new subscription with the new filter policy');

    // Expected misc logging
    expect(consoleInfoSpy).toHaveBeenCalledTimes(24);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(32);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(4);
    expect(consoleWarnSpy).toHaveBeenCalledWith('[appsync-lambda-resolver-fn-name]', 'Encountered an error while updating the subscription\'s filter policy', JSON.stringify({ statusCode: 404, code: 'NotFound', message: 'Subscription was not found' }, null, 2));
  });
});

function returnPromiseWith(payload: any, reject = false) {
  return {
    promise() {
      if (reject) { return Promise.reject(payload); }
      return Promise.resolve(payload);
    }
  };
}
