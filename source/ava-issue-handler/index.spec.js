// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
const mockDDBGet = jest.fn();
const mockDDBQuery = jest.fn();
const mockS3GetObject = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(() => ({
      getObject: mockS3GetObject
    })),
    DynamoDB: {
      DocumentClient: jest.fn(() => ({
        get: mockDDBGet,
        query: mockDDBQuery
      }))
    },
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

// Spy on the console messages
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

// Import index.js
const index = require('./index.js');

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

  it('should pass to create an issue without publishing SNS message', async function () {
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

describe('Expected S3 Record Event', function () {
  const OLD_ENV = process.env;

  const s3Event = {
    Records: [
      {
        "eventSource": "aws:s3",
        "eventName": "ObjectCreated:Put",
        "s3": {
          "bucket": {
            "name": "foo-bucket-name"
          },
          "object": {
            "key": "foo.json"
          }
        }
      }
    ]
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };

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

  it('should return successfully if Records array is empty', async function () {
    expect.assertions(3);

    const event = { Records: [] };
    const result = await index.handler(event);
    expect(result).toEqual([]);
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 0 record(s)');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should return AppSync response when a mutation is able to be created', async function () {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              eventProcessId: 'foo-process-id',
              description: 'event-description',
              priority: 'low',
              topicArn: 'arn:of:topic'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'device-name',
              deviceStationId: 'station-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // STATION_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'station-name',
              stationAreaId: 'area-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // AREA_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'area-name',
              areaSiteId: 'site-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // SITE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'site-name'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // PROCESS_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'process-name'
            }
          });
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    mockSnsPublish.mockImplementation(() => {
      return {
        promise() {
          // sns:Publish
          return Promise.resolve({ MessageId: 'Success' });
        }
      };
    });

    expect.assertions(12);

    const result = await index.handler(s3Event);
    expect(result).toEqual([{ data: 'Success' }]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 1 of 1 record(s)');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'foo-event-id' }, TableName: 'event-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'foo-device-id' }, TableName: 'device-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'station-id' }, TableName: 'station-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'area-id' }, TableName: 'area-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'site-id' }, TableName: 'site-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'foo-process-id' }, TableName: 'process-table-name' });
    expect(mockDDBQuery).toHaveBeenCalledWith({
      TableName: 'issue-table-name',
      IndexName: 'ByDeviceEvent-index',
      KeyConditionExpression: '#hashKey = :hashKey',
      FilterExpression: 'attribute_not_exists(#closed)',
      ExpressionAttributeNames: {
        '#hashKey': 'deviceName#eventId',
        '#closed': 'closed'
      },
      ExpressionAttributeValues: {
        ':hashKey': `device-name#foo-event-id`,
      }
    });
    expect(mockSnsPublish).toHaveBeenCalledWith({
      Message: 'event-description has been created at device-name.',
      TopicArn: 'arn:of:topic'
    });
  });

  it('should return AppSync response when a mutation is able to be created and the topic arn is whitespace', async function () {
    // Mock AppSync mutation
    mockMutation.mockImplementation(() => {
      return Promise.resolve({ data: 'Success' });
    });

    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              eventProcessId: 'foo-process-id',
              description: 'event-description',
              priority: 'low',
              topicArn: '  '
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'device-name',
              deviceStationId: 'station-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // STATION_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'station-name',
              stationAreaId: 'area-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // AREA_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'area-name',
              areaSiteId: 'site-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // SITE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'site-name'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // PROCESS_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'process-name'
            }
          });
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    expect.assertions(11);

    const result = await index.handler(s3Event);
    expect(result).toEqual([{ data: 'Success' }]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 1 of 1 record(s)');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'foo-event-id' }, TableName: 'event-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'foo-device-id' }, TableName: 'device-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'station-id' }, TableName: 'station-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'area-id' }, TableName: 'area-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'site-id' }, TableName: 'site-table-name' });
    expect(mockDDBGet).toHaveBeenCalledWith({ Key: { id: 'foo-process-id' }, TableName: 'process-table-name' });
    expect(mockDDBQuery).toHaveBeenCalledWith({
      TableName: 'issue-table-name',
      IndexName: 'ByDeviceEvent-index',
      KeyConditionExpression: '#hashKey = :hashKey',
      FilterExpression: 'attribute_not_exists(#closed)',
      ExpressionAttributeNames: {
        '#hashKey': 'deviceName#eventId',
        '#closed': 'closed'
      },
      ExpressionAttributeValues: {
        ':hashKey': `device-name#foo-event-id`,
      }
    });
  });

  it('should log an error if eventId is missing', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Anomaly data was missing required parameter: eventId'));
  });

  it('should log an error if deviceId is missing', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Anomaly data was missing required parameter: deviceId'));
  });

  it('should log an error if unable to retrieve event data', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Unable to retrieve event data for ID: foo-event-id'));
  });

  it('should log an error if unable to retrieve device data', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({Item: {}});
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Unable to retrieve device data for ID: foo-device-id'));
  });

  it('should log an error if there is already an open issue', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({Item: {}});
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({Item: {}});
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({Items: [{}]});
        }
      };
    });
    
        expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('An unresolved issue exists for this event on this device'));
  });

  it('should log an error if unable to retrieve station data', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              eventProcessId: 'foo-process-id',
              description: 'event-description',
              priority: 'low'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'device-name',
              deviceStationId: 'station-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // STATION_TABLE
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });
    
        expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Unable to retrieve station data for ID: station-id'));
  });

  it('should log an error if unable to retrieve area data', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              eventProcessId: 'foo-process-id',
              description: 'event-description',
              priority: 'low'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'device-name',
              deviceStationId: 'station-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // STATION_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'station-name',
              stationAreaId: 'area-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // AREA_TABLE
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });
    
        expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Unable to retrieve area data for ID: area-id'));
  });

  it('should log an error if unable to retrieve site data', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              eventProcessId: 'foo-process-id',
              description: 'event-description',
              priority: 'low'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'device-name',
              deviceStationId: 'station-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // STATION_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'station-name',
              stationAreaId: 'area-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // AREA_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'area-name',
              areaSiteId: 'site-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // SITE
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });
    
        expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Unable to retrieve site data for ID: site-id'));
  });

  it('should log an error if unable to retrieve process data', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementationOnce(() => {
      return {
        promise() {
          const jsonResponse = {
            eventId: 'foo-event-id',
            deviceId: 'foo-device-id'
          }
          return Promise.resolve({ Body: JSON.stringify(jsonResponse) });
        }
      };
    });

    mockDDBGet.mockImplementationOnce(() => {
      // EVENT_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              eventProcessId: 'foo-process-id',
              description: 'event-description',
              priority: 'low'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // DEVICE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'device-name',
              deviceStationId: 'station-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // STATION_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'station-name',
              stationAreaId: 'area-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // AREA_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'area-name',
              areaSiteId: 'site-id'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // SITE_TABLE
      return {
        promise() {
          return Promise.resolve({
            Item: {
              name: 'site-name'
            }
          });
        }
      };
    }).mockImplementationOnce(() => {
      // PROCESS_TABLE
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });

    mockDDBQuery.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({});
        }
      };
    });
    
        expect.assertions(5);

    const result = await index.handler(s3Event);
    expect(result).toEqual([]);
    expect(mockS3GetObject).toHaveBeenCalledWith({ Bucket: 'foo-bucket-name', Key: 'foo.json' });
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 0 of 1 record(s)');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to process record');
    expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Unable to retrieve process data for ID: foo-process-id'));
  });
});

describe('Misc Records Event', function () {
  const OLD_ENV = process.env;

  const testEvent = {
    Records: [
      {eventSource: 'misc'},
      {eventSource:'aws:s3'},
      {eventSource:'aws:s3', eventName: 'misc'}
    ]
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };

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

  it('should return successfully if Records array is empty', async function () {
    expect.assertions(3);

    const result = await index.handler(testEvent);
    expect(result).toEqual([]);
    expect(consoleLogSpy).toHaveBeenCalledWith('Successfully processed 3 of 3 record(s)');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
