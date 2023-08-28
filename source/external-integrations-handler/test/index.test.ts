// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { IIotMessage, IS3Request } from "../lib/utils";

// Mock context
const context = {
  logStreamName: 'log-stream'
};

// Mock JS Date
const FIXED_DATE = '2021-01-01T00:00:00Z';

// Mock UUID
jest.mock('uuid', () => {
  return {
    v4: jest.fn(() => 'mock-uuid')
  };
});

// Mock S3
const mockS3GetObject = jest.fn();
jest.mock('aws-sdk/clients/s3', () => {
  return jest.fn(() => ({
    getObject: mockS3GetObject
  }));
});

// Mock IoT Data
const mockIotPublish = jest.fn();
jest.mock('aws-sdk/clients/iotdata', () => {
  return jest.fn(() => ({
    publish: mockIotPublish
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
const consoleInfoSpy = jest.spyOn(console, 'info');
const consoleDebugSpy = jest.spyOn(console, 'debug');
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');

const mockDiagnostics1 = { "timestamp": "2021-03-11T22:25:00.000000", "prediction": 1, "diagnostics": [{ "name": "sensor_5feceb66\\feature0", "value": 0.02346 }, { "name": "sensor_5feceb66\\feature1", "value": 0.10011 }, { "name": "sensor_5feceb66\\feature2", "value": 0.11162 }, { "name": "sensor_5feceb66\\feature3", "value": 0.14419 }, { "name": "sensor_5feceb66\\feature4", "value": 0.12219 }, { "name": "sensor_5feceb66\\feature5", "value": 0.14936 }, { "name": "sensor_5feceb66\\feature6", "value": 0.17829 }, { "name": "sensor_5feceb66\\feature7", "value": 0.00194 }, { "name": "sensor_5feceb66\\feature8", "value": 0.05446 }, { "name": "sensor_5feceb66\\feature9", "value": 0.11437 }] };
const mockDiagnostics2 = { "timestamp": "2021-03-11T22:28:00.000000", "prediction": 0 };
const mockDiagnostics3 = { "timestamp": "2021-03-11T22:29:00.000000", "prediction": 1, "diagnostics": [{ "name": "sensor_5feceb66\\feature0", "value": 0.04533 }, { "name": "sensor_5feceb66\\feature1", "value": 0.14063 }, { "name": "sensor_5feceb66\\feature2", "value": 0.08327 }, { "name": "sensor_5feceb66\\feature3", "value": 0.07303 }, { "name": "sensor_5feceb66\\feature4", "value": 0.18598 }, { "name": "sensor_5feceb66\\feature5", "value": 0.10839 }, { "name": "sensor_5feceb66\\feature6", "value": 0.08721 }, { "name": "sensor_5feceb66\\feature7", "value": 0.06792 }, { "name": "sensor_5feceb66\\feature8", "value": 0.1309 }, { "name": "sensor_5feceb66\\feature9", "value": 0.07735 }] };
const mockDiagnostics4 = { "timestamp": "2021-03-11T22:29:00.000000", "prediction": 1, "diagnostics": [{ "name": "", "value": 0.04533 }] };

describe('S3 Event', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(FIXED_DATE));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should process S3 records successfully', async function () {
    expect.assertions(7);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'station-id', name: 'device-name' } }));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'area-id', name: 'station-name' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'site-id', name: 'area-name' } }));

    // Get Site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'site-name' } }));

    // Get Processes
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ parentId: 'area-id', name: 'process-name', id: 'process-id' }] }));

    // Get Events
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ eventType: 'automated', parentId: 'process-id', name: 'event-name' }] }));

    // Check for existing issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    mockIotPublish.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleInfoSpy).toHaveBeenCalledTimes(11);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(16);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Received event', JSON.stringify(event, null, 2));
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Successfully processed all record(s)');
    expect(consoleDebugSpy).toHaveBeenCalledWith('[fn-name]', 'Publish params', JSON.stringify({
      payload: JSON.stringify({
        id: 'mock-uuid',
        eventDescription: 'event-name',
        deviceName: 'device-name',
        stationName: 'station-name',
        areaName: 'area-name',
        siteName: 'site-name',
        processName: 'process-name',
        status: 'open',
        created: '2021-01-01T00:00:00.000Z',
        issueSource: 's3File',
        createdBy: 'automatic-issue-detection',
        additionalDetails: JSON.stringify(mockDiagnostics3)
      })
    }, null, 2));
  });
});

describe('S3 Event - Error checking', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(FIXED_DATE));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('Existing issue is present', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'station-id', name: 'device-name' } }));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'area-id', name: 'station-name' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'site-id', name: 'area-name' } }));

    // Get Site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'site-name' } }));

    // Get Processes
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ parentId: 'area-id', name: 'process-name', id: 'process-id' }] }));

    // Get Events
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ eventType: 'automated', parentId: 'process-id', name: 'event-name' }] }));

    // Check for existing issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ id: 'issue-id' }] }));

    mockIotPublish.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('An unresolved issue exists for this event on this device'));
  });

  it('Automated event not found', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'station-id', name: 'device-name' } }));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'area-id', name: 'station-name' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'site-id', name: 'area-name', description: 'area-desc' } }));

    // Get Site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'site-name' } }));

    // Get Processes
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ parentId: 'area-id', name: 'process-name', id: 'process-id' }] }));

    // Get Events
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    mockIotPublish.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Unable to find any automated events under Area (area-name: area-desc)'));
  });

  it('Process not found', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'station-id', name: 'device-name' } }));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'area-id', name: 'station-name' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'site-id', name: 'area-name', description: 'area-desc' } }));

    // Get Site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'site-name' } }));

    // Get Processes
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Unable to find any processes under Area (area-name: area-desc)'));
  });

  it('Site not found', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ parentId: 'station-id', name: 'device-name' }] }))

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'area-id', name: 'station-name' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'site-id', name: 'area-name', description: 'area-desc' } }));

    // Get Site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Unable to find site by ID (site-id)'));
  });

  it('Area not found', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'station-id', name: 'device-name' } }));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'area-id', name: 'station-name' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Unable to find area by ID (area-id)'));
  });

  it('Station not found', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { parentId: 'station-id', name: 'device-name' } }));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Unable to find station by ID (station-id)'));
  });

  it('Device not found', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify(mockDiagnostics3)}`
    }));

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Unable to match machine ID (sensor_5feceb66) to a Device in Amazon Virtual Andon'));
  });

  it('No diagnostic information', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify({ ...mockDiagnostics3, diagnostics: undefined })}`
    }));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Anomaly data did not contain diagnostic information'));
  });

  it('No anomaly detected', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}`
    }));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'No anomaly detected');
  });

  it('No prediction score', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `
      ${JSON.stringify(mockDiagnostics1)}
      ${JSON.stringify(mockDiagnostics2)}
      ${JSON.stringify({ ...mockDiagnostics3, prediction: undefined })}`
    }));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Anomaly data did not contain a prediction score'));
  });

  it('No machine ID', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `${JSON.stringify(mockDiagnostics4)}`
    }));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process record', new Error('Machine ID was not supplied'));
  });

  it('No records had diagnostics', async function () {
    expect.assertions(1);

    mockS3GetObject.mockImplementationOnce(() => returnPromiseWith({
      Body: `${JSON.stringify(mockDiagnostics2)}`
    }));

    // Import handler
    const index = require('../index');

    const event: IS3Request = {
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:s3',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    };

    await index.handler(event, context);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Skipping record as none of the objects had any diagnostic information');
  });
});

describe('S3 Event - Error checking', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(FIXED_DATE));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should ignore non-s3 records', async function () {
    expect.assertions(1);

    // Import handler
    const index = require('../index');

    await index.handler({
      Records: [
        {
          eventName: 'ObjectCreated:PutObject',
          eventSource: 'aws:foo',
          s3: { bucket: { name: 'bucket-name' }, object: { key: 'object-key' } }
        }
      ]
    }, context);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Successfully processed all record(s)');
  });
});

describe('IoT Event', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(FIXED_DATE));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should process IoT records successfully', async function () {
    expect.assertions(7);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'event-name', id: 'event-id', parentId: 'process-id', alias: 'tag_001' }] }));

    // Check for unresolved issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'station-name', id: 'station-id', parentId: 'area-id' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'area-name', id: 'area-id', parentId: 'site-id' } }));

    // site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'site-name', id: 'site-id' } }));

    // process
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'process-name', id: 'process-id', parentId: 'area-id' } }));

    mockIotPublish.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
    expect(consoleInfoSpy).toHaveBeenCalledTimes(9);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(18);
    expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    expect(consoleInfoSpy).toHaveBeenCalledWith('[fn-name]', 'Received event', JSON.stringify(event, null, 2));
    expect(consoleDebugSpy).toHaveBeenCalledWith('[fn-name]', 'Derived tag name (tag) and machine name (machine-id) from the message');
    expect(consoleDebugSpy).toHaveBeenCalledWith('[fn-name]', 'Publish params', JSON.stringify({
      payload: JSON.stringify({
        id: 'mock-uuid',
        eventId: 'event-id',
        eventDescription: 'event-name',
        deviceName: 'device-name',
        stationName: 'station-name',
        areaName: 'area-name',
        siteName: 'site-name',
        processName: 'process-name',
        status: 'open',
        created: '2021-01-01T00:00:00.000Z',
        issueSource: 'device',
        createdBy: 'device'
      })
    }, null, 2));
  });

  it('error checking', async function () {
    expect.assertions(1);
    let count = 1;

    mockDDBGet.mockImplementation(() => returnPromiseWith({ Item: { id: `id- ${count++}`, name: `name - ${count++}`, parentId: `parent - ${count++}` } }));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Process and Station must be under the same Area'));
  });
});

describe('IoT Event - Error checking', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(FIXED_DATE));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('Proceess not found', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'event-name', id: 'event-id', parentId: 'process-id', alias: 'tag_001' }] }));

    // Check for unresolved issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'station-name', id: 'station-id', parentId: 'area-id' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'area-name', id: 'area-id', parentId: 'site-id' } }));

    // site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'site-name', id: 'site-id' } }));

    // process
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Unable to find process by ID (process-id)'));
  });

  it('Site not found', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'event-name', id: 'event-id', parentId: 'process-id', alias: 'tag_001' }] }));

    // Check for unresolved issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'station-name', id: 'station-id', parentId: 'area-id' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'area-name', id: 'area-id', parentId: 'site-id' } }));

    // site
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Unable to find site by ID (site-id)'));
  });

  it('Area not found', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'event-name', id: 'event-id', parentId: 'process-id', alias: 'tag_001' }] }));

    // Check for unresolved issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({ Item: { name: 'station-name', id: 'station-id', parentId: 'area-id' } }));

    // Get Area
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Unable to find area by ID (area-id)'));
  });

  it('Station not found', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'event-name', id: 'event-id', parentId: 'process-id', alias: 'tag_001' }] }));

    // Check for unresolved issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Get Station
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Unable to find station by ID (station-id)'));
  });

  it('Unresolved issue exists', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'event-name', id: 'event-id', parentId: 'process-id', alias: 'tag_001' }] }));

    // Check for unresolved issues
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{}] }));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('An unresolved issue exists for this event on this device'));
  });

  it('Event not found', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [{ name: 'device-name', id: 'device-id', parentId: 'station-id', alias: 'machine-id' }] }));

    // Get Event
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({}));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Unable to match \'tag_001\' to an Event in Amazon Virtual Andon'));
  });

  it('Device not found', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id/tag',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    await index.handler(JSON.parse(JSON.stringify(event)), context);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Unable to process message', new Error('Unable to match machine name (machine-id) to a Device in Amazon Virtual Andon'));
  });

  it('Unable to parse message name', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    // Import handler
    const index = require('../index');

    const event: IIotMessage = {
      messages: [{
        name: 'machine-id',
        value: '001',
        quality: 'GOOD',
        timestamp: FIXED_DATE
      }]
    };

    try {
      await index.handler(JSON.parse(JSON.stringify(event)), context);
    } catch (err) {
      expect(err.message).toBe('Message name could not be split by the \'/\' character');
    }
  });

  it('Message did not include a required property', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    // Import handler
    const index = require('../index');

    try {
      await index.handler({
        messages: [{
          name: 'machine-id/tag',
          quality: 'GOOD',
          timestamp: FIXED_DATE
        }]
      }, context);
    } catch (err) {
      expect(err.message).toBe('Message was missing the \'value\' property');
    }
  });

  it('Event did not include messages', async function () {
    expect.assertions(1);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    // Import handler
    const index = require('../index');

    try {
      await index.handler({}, context);
    } catch (err) {
      expect(err.message).toBe('Event did not include an array of messages');
    }
  });

  it('Event was null', async function () {
    expect.assertions(2);

    // Get Device
    mockDDBGet.mockImplementationOnce(() => returnPromiseWith({}));
    mockDDBQuery.mockImplementationOnce(() => returnPromiseWith({ Items: [] }));

    // Import handler
    const index = require('../index');

    try {
      await index.handler(null, context);
    } catch (err) {
      expect(consoleErrorSpy).toHaveBeenCalledWith('[fn-name]', 'Event input was null or undefined');
      expect(err.message).toBe('Invalid handler input');
    }
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